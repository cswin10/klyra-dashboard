import os
import asyncio
from pathlib import Path
from typing import List, Tuple, Optional, Dict
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
import re
from config import settings, CHROMA_DIR, UPLOADS_DIR
from ollama import generate_embedding
from logging_config import get_logger

logger = get_logger("rag")

# Maximum number of chunks to include in LLM context (prevents context overflow)
MAX_CONTEXT_CHUNKS = 8

# Confidence thresholds
HIGH_CONFIDENCE_THRESHOLD = 0.75  # Very confident in retrieval
MEDIUM_CONFIDENCE_THRESHOLD = 0.60  # Reasonably confident
LOW_CONFIDENCE_THRESHOLD = 0.45  # Low confidence, add disclaimer

# Document categories for filtering
DOCUMENT_CATEGORIES = {
    "sales": ["pitch", "script", "sales", "objection", "closing", "prospect"],
    "legal": ["compliance", "regulation", "sra", "gdpr", "contract", "terms"],
    "technical": ["hardware", "specs", "technical", "system", "install", "setup"],
    "hr": ["onboarding", "process", "policy", "employee", "handbook"],
    "case_study": ["case", "study", "client", "success", "testimonial"],
    "company": ["about", "company", "team", "founder", "mission", "vision"]
}

# Initialize ChromaDB client
# Use HTTP client when CHROMA_HOST is set (Docker/production), otherwise local persistent client
if settings.CHROMA_HOST:
    chroma_client = chromadb.HttpClient(
        host=settings.CHROMA_HOST,
        port=settings.CHROMA_PORT,
        settings=ChromaSettings(anonymized_telemetry=False)
    )
    logger.info(f"Using ChromaDB HTTP client: {settings.CHROMA_HOST}:{settings.CHROMA_PORT}")
else:
    chroma_client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=ChromaSettings(anonymized_telemetry=False)
    )
    logger.info(f"Using ChromaDB persistent client: {CHROMA_DIR}")

# Get or create the documents collection
collection = chroma_client.get_or_create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"}
)


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text content from a PDF file."""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

    # Clean up common PDF extraction issues
    # 1. Replace single newlines with spaces (preserves paragraphs marked by double newlines)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    # 2. Collapse multiple spaces into single space
    text = re.sub(r' +', ' ', text)
    # 3. Collapse multiple newlines into double newline (paragraph break)
    text = re.sub(r'\n{2,}', '\n\n', text)
    # 4. Clean up spaces around newlines
    text = re.sub(r' *\n *', '\n', text)

    return text.strip()


def extract_text_from_docx(file_path: str) -> str:
    """Extract text content from a DOCX file."""
    doc = DocxDocument(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text.strip()


def extract_text_from_txt(file_path: str) -> str:
    """Extract text content from a TXT file."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read().strip()


def extract_text(file_path: str, file_type: str) -> str:
    """Extract text from a file based on its type."""
    file_type = file_type.lower()
    if file_type == "pdf":
        return extract_text_from_pdf(file_path)
    elif file_type in ["docx", "doc"]:
        return extract_text_from_docx(file_path)
    elif file_type in ["txt", "md"]:
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def chunk_text(text: str, file_type: str = "txt") -> List[str]:
    """Split text into chunks for embedding with context preservation."""

    # For markdown files, use header-aware chunking
    if file_type == "md":
        return chunk_markdown_with_headers(text)

    # Default chunking for other file types
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    return splitter.split_text(text)


def chunk_markdown_with_headers(text: str) -> List[str]:
    """
    Smart markdown chunking that preserves section context.
    Each chunk includes its parent headers so embeddings understand context.
    """
    import re

    lines = text.split('\n')
    chunks = []
    current_headers = {}  # level -> header text
    current_content = []
    current_length = 0

    def get_header_context():
        """Build header context string from current headers."""
        if not current_headers:
            return ""
        # Include headers in order (h1, h2, h3, etc.)
        sorted_levels = sorted(current_headers.keys())
        headers = [current_headers[level] for level in sorted_levels]
        return " > ".join(headers) + "\n\n"

    def flush_chunk():
        """Save current content as a chunk with header context."""
        nonlocal current_content, current_length
        if current_content:
            content = '\n'.join(current_content).strip()
            if content:
                header_context = get_header_context()
                chunk = header_context + content
                chunks.append(chunk)
        current_content = []
        current_length = 0

    for line in lines:
        # Check if line is a header
        header_match = re.match(r'^(#{1,6})\s+(.+)$', line)

        if header_match:
            # Save current chunk before starting new section
            flush_chunk()

            level = len(header_match.group(1))
            header_text = header_match.group(2).strip()

            # Update header hierarchy (clear lower-level headers)
            current_headers[level] = header_text
            for l in list(current_headers.keys()):
                if l > level:
                    del current_headers[l]

            continue

        # Add line to current content
        line_len = len(line) + 1  # +1 for newline
        if current_length + line_len > settings.CHUNK_SIZE and current_content:
            flush_chunk()

        current_content.append(line)
        current_length += line_len

    # Don't forget the last chunk
    flush_chunk()

    return chunks


async def process_document(
    document_id: str,
    file_path: str,
    file_name: str,
    file_type: str,
    category: str = "general"
) -> int:
    """
    Process a document: extract text, chunk it, generate embeddings, and store in ChromaDB.
    Returns the number of chunks created.
    """
    # Extract text
    text = extract_text(file_path, file_type)
    if not text:
        raise ValueError("No text could be extracted from the document")

    # Split into chunks (pass file_type for format-aware chunking)
    chunks = chunk_text(text, file_type)
    if not chunks:
        raise ValueError("No chunks could be created from the document")

    # Generate embeddings and store in ChromaDB
    ids = []
    embeddings = []
    documents = []
    metadatas = []

    for i, chunk in enumerate(chunks):
        chunk_id = f"{document_id}_chunk_{i}"

        # Create a clean document title for embedding context
        # Remove file extension and clean up the name
        doc_title = file_name.rsplit('.', 1)[0]  # Remove extension
        doc_title = doc_title.replace('-', ' ').replace('_', ' ')  # Clean separators

        # Create embedding text with document context
        # This helps semantic search match queries about document topics
        embedding_text = f"[From: {doc_title}]\n{chunk}"
        embedding = await generate_embedding(embedding_text)

        ids.append(chunk_id)
        embeddings.append(embedding)
        documents.append(chunk)  # Store original chunk for display
        metadatas.append({
            "document_id": document_id,
            "document_name": file_name,
            "category": category,
            "chunk_index": i
        })

    # Add to ChromaDB collection
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )

    return len(chunks)


def delete_document_chunks(document_id: str) -> None:
    """Delete all chunks associated with a document from ChromaDB."""
    # Get all chunk IDs for this document
    results = collection.get(
        where={"document_id": document_id}
    )

    if results and results["ids"]:
        collection.delete(ids=results["ids"])


def detect_category(text: str) -> str:
    """
    Auto-detect document category based on content and filename.
    Returns the best matching category or 'general'.
    """
    text_lower = text.lower()

    category_scores = {}
    for category, keywords in DOCUMENT_CATEGORIES.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            category_scores[category] = score

    if category_scores:
        return max(category_scores, key=category_scores.get)
    return "general"


def detect_query_category(query: str) -> Optional[str]:
    """
    Detect what category a query is asking about.
    Returns category name or None if general/unclear.
    """
    query_lower = query.lower()

    # Direct category detection
    category_signals = {
        "sales": ["pitch", "sell", "sales", "close", "objection", "prospect", "deal"],
        "legal": ["compliance", "regulation", "legal", "sra", "gdpr", "contract"],
        "technical": ["hardware", "specs", "technical", "install", "system", "gpu"],
        "hr": ["onboarding", "onboard", "process", "policy", "employee"],
        "case_study": ["case study", "client success", "testimonial", "example"],
        "company": ["who works", "team", "founder", "ceo", "about klyra", "company"]
    }

    for category, signals in category_signals.items():
        if any(signal in query_lower for signal in signals):
            return category

    return None


def calculate_confidence(chunks: List[Tuple[str, str, float]]) -> Tuple[float, str]:
    """
    Calculate confidence score based on retrieval quality.

    Returns: (confidence_score, confidence_level)
    - confidence_score: 0.0 to 1.0
    - confidence_level: "high", "medium", "low", or "none"
    """
    if not chunks:
        return 0.0, "none"

    scores = [score for _, _, score in chunks]
    top_score = max(scores)
    avg_score = sum(scores) / len(scores)

    # Check score distribution - if top scores are close, more confident
    top_3_scores = sorted(scores, reverse=True)[:3]
    score_variance = max(top_3_scores) - min(top_3_scores) if len(top_3_scores) > 1 else 0

    # Calculate confidence based on:
    # 1. Top score (higher = better)
    # 2. Score clustering (if top scores are similar, more confident about topic)
    # 3. Number of relevant results

    if top_score >= HIGH_CONFIDENCE_THRESHOLD:
        confidence = 0.9 + (top_score - HIGH_CONFIDENCE_THRESHOLD) * 0.4
        level = "high"
    elif top_score >= MEDIUM_CONFIDENCE_THRESHOLD:
        confidence = 0.6 + (top_score - MEDIUM_CONFIDENCE_THRESHOLD) * 2
        level = "medium"
    elif top_score >= LOW_CONFIDENCE_THRESHOLD:
        confidence = 0.3 + (top_score - LOW_CONFIDENCE_THRESHOLD) * 2
        level = "low"
    else:
        confidence = top_score
        level = "none"

    # Boost confidence if multiple relevant chunks found
    relevant_count = sum(1 for s in scores if s >= MEDIUM_CONFIDENCE_THRESHOLD)
    if relevant_count >= 3:
        confidence = min(1.0, confidence + 0.1)

    logger.info(f"Confidence: {confidence:.2f} ({level}) - top={top_score:.3f}, avg={avg_score:.3f}, relevant_count={relevant_count}")

    return min(1.0, confidence), level


def detect_ambiguous_query(query: str, chunks: List[Tuple[str, str, float]]) -> Optional[Dict]:
    """
    Detect if a query is ambiguous (multiple documents match similarly).

    Returns dict with clarification info if ambiguous, None otherwise.
    """
    if not chunks or len(chunks) < 2:
        return None

    # Group chunks by document
    doc_scores: Dict[str, List[float]] = {}
    for doc_name, _, score in chunks:
        if doc_name not in doc_scores:
            doc_scores[doc_name] = []
        doc_scores[doc_name].append(score)

    # Get best score per document
    doc_best_scores = {doc: max(scores) for doc, scores in doc_scores.items()}

    if len(doc_best_scores) < 2:
        return None

    # Sort by score
    sorted_docs = sorted(doc_best_scores.items(), key=lambda x: x[1], reverse=True)

    # Check if top 2-3 docs have very similar scores (within 10%)
    top_score = sorted_docs[0][1]
    similar_docs = [(doc, score) for doc, score in sorted_docs if score >= top_score * 0.9]

    if len(similar_docs) >= 2 and top_score >= LOW_CONFIDENCE_THRESHOLD:
        # Query is ambiguous - multiple docs match equally well
        logger.info(f"Ambiguous query detected: {len(similar_docs)} docs with similar scores")
        return {
            "is_ambiguous": True,
            "matching_docs": [doc for doc, _ in similar_docs[:3]],
            "top_score": top_score
        }

    return None


def get_low_confidence_disclaimer(confidence_level: str, query: str) -> Optional[str]:
    """
    Generate a disclaimer for low-confidence responses.
    """
    if confidence_level == "none":
        return "\n\n---\n*I couldn't find specific information about this in the uploaded documents. This answer is based on general knowledge.*"
    elif confidence_level == "low":
        return "\n\n---\n*Note: I found some related information, but I'm not fully confident this answers your question. You may want to check the source document directly or rephrase your question.*"
    return None


def get_ambiguity_clarification(ambiguous_docs: List[str], query: str) -> Optional[str]:
    """
    Generate a clarification request when multiple documents match equally.
    """
    if not ambiguous_docs or len(ambiguous_docs) < 2:
        return None

    # Clean up document names for display
    clean_names = []
    for doc in ambiguous_docs[:3]:
        # Remove file extension and clean up
        name = doc.rsplit('.', 1)[0]
        name = name.replace('-', ' ').replace('_', ' ')
        clean_names.append(name)

    docs_list = ", ".join(f"**{name}**" for name in clean_names[:-1])
    if len(clean_names) > 1:
        docs_list += f" and **{clean_names[-1]}**"
    else:
        docs_list = f"**{clean_names[0]}**"

    return f"\n\n---\n*I found relevant information in multiple documents ({docs_list}). If you need information from a specific document, please mention it in your question.*"


def expand_query(query: str) -> str:
    """
    Expand a query with related terms to improve semantic search matching.
    This helps bridge the semantic gap between user questions and document content.
    """
    query_lower = query.lower()
    expansions = []

    # People/team related queries
    if any(term in query_lower for term in ["who works", "who is at", "employees", "staff", "team"]):
        expansions.append("founding team members employees staff founders")

    # Leadership queries
    if any(term in query_lower for term in ["ceo", "cto", "founder", "leader", "management"]):
        expansions.append("founding team CEO CTO founder leadership executive")

    # About/company queries - only expand when asking about Klyra specifically
    if any(term in query_lower for term in ["about klyra", "what is klyra", "what does klyra", "klyra company"]):
        expansions.append("about company mission vision overview")

    # Contact queries
    if any(term in query_lower for term in ["contact", "email", "phone", "address", "reach"]):
        expansions.append("contact information email phone address")

    # Product queries
    if any(term in query_lower for term in ["product", "service", "offer", "solution"]):
        expansions.append("products services solutions offerings")

    # Technical/hardware queries
    if any(term in query_lower for term in ["hardware", "specs", "specification", "technical", "system", "requirements"]):
        expansions.append("technical specifications hardware requirements system specs")

    # Klyra Box specific
    if "klyra box" in query_lower or "hardware" in query_lower:
        expansions.append("Klyra Box hardware Intel NUC specifications")

    # Sales/pitch queries - exclude product names like "Salesforce"
    # Use word boundary check for "sales" to avoid matching "Salesforce"
    import re
    sales_terms = ["pitch", "sell", "script", "opening line", "talk track"]
    has_sales_word = re.search(r'\bsales\b', query_lower) and "salesforce" not in query_lower
    if has_sales_word or any(term in query_lower for term in sales_terms):
        expansions.append("pitch script sales presentation opening talk track objections")

    if expansions:
        expanded = f"{query} {' '.join(expansions)}"
        logger.info(f"Query expanded: '{query}' -> '{expanded}'")
        return expanded

    return query


def enhance_query_with_context(query: str, conversation_history: List[dict] = None) -> str:
    """
    Enhance a short/vague query using conversation context.

    For example, if user asks "who is kieren" after discussing Klyra Labs,
    this adds context like "kieren Klyra Labs" to improve search results.
    """
    if not conversation_history:
        return query

    query_lower = query.lower()
    query_words = set(query_lower.split())

    # Only enhance short/vague queries (less than 6 words, or asking about a person)
    is_short_query = len(query_words) <= 6
    is_person_query = any(term in query_lower for term in ["who is", "who's", "tell me about", "what about"])

    if not (is_short_query or is_person_query):
        return query

    # Extract context entities from recent conversation
    context_entities = set()

    # Look at last 6 messages for context
    recent_messages = conversation_history[-6:] if conversation_history else []

    for msg in recent_messages:
        content = msg.get("content", "").lower()

        # Add "Klyra" context if mentioned
        if "klyra" in content:
            context_entities.add("Klyra Labs")

        # Add specific document/entity mentions
        if "thompson" in content:
            context_entities.add("Thompson")
        if "brand" in content or "color" in content or "colour" in content:
            context_entities.add("brand guidelines")
        if "script" in content or "pitch" in content:
            context_entities.add("sales script")

    # Don't duplicate if already in query
    new_context = [e for e in context_entities if e.lower() not in query_lower]

    if new_context:
        enhanced = f"{query} {' '.join(new_context)}"
        logger.info(f"Query enhanced with context: '{query}' -> '{enhanced}'")
        return enhanced

    return query


def keyword_search_chunks(query: str, top_k: int = 5) -> List[Tuple[str, str, float]]:
    """
    Enhanced keyword-based search with phrase matching and TF-IDF style weighting.
    Returns list of tuples: (document_name, chunk_text, score)
    """
    query_lower = query.lower()

    # Extract important phrases (2-3 word combinations)
    important_phrases = []
    phrase_patterns = [
        r'opening line', r'sales pitch', r'pitch script', r'case study',
        r'who works', r'who is', r'how do', r'how to', r'what is',
        r'klyra box', r'klyra labs', r'closing technique', r'objection handling'
    ]
    for pattern in phrase_patterns:
        if pattern in query_lower:
            important_phrases.append(pattern)

    # Extract keywords from query
    words = re.findall(r'\b\w+\b', query_lower)
    stop_words = {'what', 'who', 'where', 'when', 'how', 'why', 'is', 'are', 'the', 'a', 'an',
                  'does', 'do', 'at', 'in', 'on', 'for', 'to', 'of', 'and', 'or', 'me', 'tell',
                  'about', 'can', 'could', 'would', 'should', 'our', 'my', 'your', 'i', 'we'}
    keywords = [w for w in words if w not in stop_words and len(w) > 2]

    # Add high-value keywords based on query type
    if any(term in query_lower for term in ["who works", "team", "employees", "staff", "people"]):
        keywords.extend(["team", "founder", "ceo", "cto", "head", "charlie", "joe", "jack", "kieren"])
    if any(term in query_lower for term in ["pitch", "sales", "sell", "script"]):
        keywords.extend(["pitch", "script", "objection", "closing", "prospect"])
    if any(term in query_lower for term in ["hardware", "specs", "technical", "gpu"]):
        keywords.extend(["gpu", "rtx", "hardware", "vram", "server"])

    if not keywords and not important_phrases:
        return []

    # Get all chunks
    all_chunks = collection.get(include=["documents", "metadatas"])
    if not all_chunks or not all_chunks["documents"]:
        return []

    matches = []
    for i, doc in enumerate(all_chunks["documents"]):
        doc_lower = doc.lower()
        metadata = all_chunks["metadatas"][i]
        doc_name_lower = metadata["document_name"].lower()

        score = 0.0
        match_details = []

        # Phrase matching (highest weight - exact phrase matches are very valuable)
        phrase_matches = sum(1 for phrase in important_phrases if phrase in doc_lower)
        if phrase_matches > 0:
            score += phrase_matches * 0.4  # High weight for phrase matches
            match_details.append(f"phrases:{phrase_matches}")

        # Keyword matching in content
        keyword_matches = sum(1 for kw in keywords if kw in doc_lower)
        if keyword_matches > 0:
            # TF-IDF style: more keywords matched = higher score, but diminishing returns
            keyword_score = min(keyword_matches / len(keywords), 1.0) * 0.3
            score += keyword_score
            match_details.append(f"keywords:{keyword_matches}/{len(keywords)}")

        # Document name matching (boost if query keywords appear in doc name)
        name_matches = sum(1 for kw in keywords if kw in doc_name_lower)
        if name_matches > 0:
            score += name_matches * 0.15  # Bonus for matching document name
            match_details.append(f"name:{name_matches}")

        # Category matching (if document category matches query intent)
        doc_category = metadata.get("category", "general")
        query_category = detect_query_category(query)
        if query_category and doc_category == query_category:
            score += 0.1  # Small boost for category match
            match_details.append(f"category:{doc_category}")

        if score > 0:
            logger.debug(f"Keyword match: {metadata['document_name']} score={score:.3f} ({', '.join(match_details)})")
            matches.append((metadata["document_name"], doc, score, sum([phrase_matches * 3, keyword_matches, name_matches])))

    matches.sort(key=lambda x: (x[2], x[3]), reverse=True)
    return [(m[0], m[1], m[2]) for m in matches[:top_k]]


async def search_similar_chunks(
    query: str,
    top_k: int = None
) -> List[Tuple[str, str, float]]:
    """
    Hybrid search: semantic similarity + keyword matching.
    Returns list of tuples: (document_name, chunk_text, score)
    """
    top_k = top_k or settings.TOP_K_RESULTS

    # Expand query with related terms for better matching
    expanded_query = expand_query(query)

    # Generate query embedding from expanded query
    query_embedding = await generate_embedding(expanded_query)

    # Semantic search with ChromaDB
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )

    # Format semantic search results
    formatted_results = []
    seen_chunks = set()

    if results and results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            metadata = results["metadatas"][0][i]
            distance = results["distances"][0][i]
            score = 1 - distance
            formatted_results.append((
                metadata["document_name"],
                doc,
                score
            ))
            seen_chunks.add(doc[:100])  # Track by first 100 chars

    # Add keyword search results - low threshold to catch team info etc
    keyword_results = keyword_search_chunks(query, top_k=10)
    for doc_name, doc, kw_score in keyword_results:
        if doc[:100] not in seen_chunks:
            # Low threshold - include if any meaningful keywords match
            if kw_score >= 0.15:
                # Boost keyword matches to ensure they're included
                boosted_score = 0.4 + (kw_score * 0.4)
                formatted_results.append((doc_name, doc, boosted_score))
                seen_chunks.add(doc[:100])
                logger.info(f"Keyword match added: score={boosted_score:.3f} (kw={kw_score:.2f}) | '{doc[:60]}...'")

    # Re-sort by score and return top_k
    formatted_results.sort(key=lambda x: x[2], reverse=True)
    return formatted_results[:top_k]


def build_rag_prompt(query: str, context_chunks: List[Tuple[str, str, float]], conversation_history: List[dict] = None) -> Tuple[str, List[str]]:
    """
    Build a prompt with RAG context and conversation history.
    Returns the prompt and empty list (LLM handles citations inline).

    conversation_history: List of {"role": "user"|"assistant", "content": "..."} dicts
    """
    # Klyra's core identity - consistent across all deployments
    klyra_identity = """You are Klyra, a helpful AI assistant.

YOUR JOB:
- Answer questions using the company documents provided below
- For general knowledge questions (history, science, etc.), use your training data
- Be helpful and informative

IMPORTANT:
- Use the document content provided to answer company-related questions
- If documents contain the answer, use that information
- Add "Sources: [filename]" at the end when you use document info"""

    # Build conversation history string
    history_str = ""
    if conversation_history and len(conversation_history) > 0:
        history_parts = []
        # Only include last 10 messages to avoid context overflow
        recent_history = conversation_history[-10:]
        for msg in recent_history:
            role = "User" if msg["role"] == "user" else "Klyra"
            history_parts.append(f"{role}: {msg['content']}")
        history_str = "\n\n".join(history_parts)

    # Low threshold - let the LLM see more context and decide what's relevant
    CONTEXT_THRESHOLD = 0.2

    # Log retrieved chunks for debugging
    total_chunks = collection.count()
    logger.info(f"ChromaDB has {total_chunks} total chunks")

    if context_chunks:
        logger.info(f"RAG search for query: '{query[:50]}...'")
        for doc, text, score in context_chunks:
            logger.info(f"  - {doc}: score={score:.3f} | '{text[:60]}...'")
    else:
        logger.info(f"RAG search found no chunks for: '{query[:50]}...'")

    # Filter chunks that meet minimum relevance AND limit to prevent context overflow
    relevant_chunks = [(doc, text, score) for doc, text, score in context_chunks if score > CONTEXT_THRESHOLD]
    relevant_chunks = relevant_chunks[:MAX_CONTEXT_CHUNKS]  # Limit context size

    if relevant_chunks:
        logger.info(f"Including {len(relevant_chunks)} chunks in context (>{CONTEXT_THRESHOLD}, max {MAX_CONTEXT_CHUNKS})")
    else:
        logger.info(f"No chunks above threshold {CONTEXT_THRESHOLD}, using general knowledge only")

    # Get list of document names actually provided (for validation later)
    provided_docs = list(set(doc for doc, _, _ in relevant_chunks))

    # Simple citation instructions
    citation_instructions = """When answering:
- Use the document content below to answer the question
- Add "Sources: [filename]" at the end if you used document info
- For general knowledge questions, just answer normally without sources"""

    if not relevant_chunks:
        # No relevant documents - pure general knowledge
        base_prompt = f"""{klyra_identity}

Answer the user's question using your general knowledge. Give a complete, helpful response.
Do NOT mention sources or documents since none are relevant to this question."""

        if history_str:
            prompt = f"""{base_prompt}

CONVERSATION SO FAR:
{history_str}

User: {query}

Klyra:"""
        else:
            prompt = f"""{base_prompt}

User: {query}

Klyra:"""
        return prompt, []

    # Build context string from retrieved documents
    # Use a format that's less likely to leak into response
    context_parts = []
    for doc_name, chunk_text, score in relevant_chunks:
        context_parts.append(f"--- Document: {doc_name} ---\n{chunk_text}")
    context_str = "\n\n".join(context_parts)

    if history_str:
        prompt = f"""{klyra_identity}

{citation_instructions}

CONVERSATION SO FAR:
{history_str}

COMPANY DOCUMENTS (use only if relevant to the question):
---
{context_str}
---

User: {query}

Klyra:"""
    else:
        prompt = f"""{klyra_identity}

{citation_instructions}

COMPANY DOCUMENTS (use only if relevant to the question):
---
{context_str}
---

User: {query}

Klyra:"""

    # Return prompt and list of provided docs (for citation validation)
    return prompt, provided_docs


def process_citations(response: str, provided_docs: List[str]) -> Tuple[str, List[str]]:
    """
    Process LLM response to validate, normalize, and fix citations.

    1. Parse any citations from the response
    2. Validate cited docs were actually provided
    3. Normalize format to "Sources: doc1, doc2"
    4. Strip invalid citations (fallback detection)

    Returns: (cleaned_response, valid_sources_list)
    """
    if not response:
        return response, []

    # Patterns to match various citation formats
    citation_patterns = [
        r'\n*Sources?:\s*(.+?)$',           # "Sources: doc.pdf" or "Source: doc.pdf"
        r'\n*\(Sources?:\s*(.+?)\)',         # "(Sources: doc.pdf)"
        r'\n*\[Sources?:\s*(.+?)\]',         # "[Sources: doc.pdf]"
        r'\n*From:\s*(.+?)$',                # "From: doc.pdf"
        r'\n*Reference:\s*(.+?)$',           # "Reference: doc.pdf"
    ]

    found_citations = []
    cleaned_response = response

    # Try each pattern
    for pattern in citation_patterns:
        matches = re.findall(pattern, response, re.IGNORECASE | re.MULTILINE)
        for match in matches:
            # Split by comma or "and" to get individual docs
            docs = re.split(r',\s*|\s+and\s+', match)
            docs = [d.strip().strip('"\'') for d in docs if d.strip()]
            found_citations.extend(docs)
            # Remove this citation from response for cleaning
            cleaned_response = re.sub(pattern, '', cleaned_response, flags=re.IGNORECASE | re.MULTILINE)

    # Validate citations against provided docs
    valid_citations = []
    invalid_citations = []

    for citation in found_citations:
        # Check if citation matches any provided doc (case-insensitive, partial match)
        citation_lower = citation.lower()
        matched = False
        for provided in provided_docs:
            provided_lower = provided.lower()
            # Match if citation contains the doc name or vice versa
            if citation_lower in provided_lower or provided_lower in citation_lower:
                valid_citations.append(provided)  # Use the actual doc name
                matched = True
                break
        if not matched:
            invalid_citations.append(citation)

    # Log validation results
    if invalid_citations:
        logger.warning(f"Stripped invalid citations (not in provided docs): {invalid_citations}")
    if valid_citations:
        logger.info(f"Valid citations: {valid_citations}")

    # Remove duplicates while preserving order
    valid_citations = list(dict.fromkeys(valid_citations))

    # Clean up the response (remove extra whitespace at end)
    cleaned_response = cleaned_response.rstrip()

    # Add normalized citation if there are valid ones
    if valid_citations:
        cleaned_response += f"\n\nSources: {', '.join(valid_citations)}"

    return cleaned_response, valid_citations


def match_response_to_sources(response: str, chunks: List[Tuple[str, str, float]], min_overlap: int = 3) -> Tuple[str, List[str]]:
    """
    Match LLM response text against retrieved chunks to determine which docs were actually used.

    Instead of trusting the LLM to cite correctly, we check which chunks
    have significant text overlap with the response.

    Args:
        response: The LLM's response text
        chunks: List of (doc_name, chunk_text, score) tuples
        min_overlap: Minimum number of matching words to consider a match

    Returns: (cleaned_response, list of doc names that contributed)
    """
    if not response or not chunks:
        return response, []

    # Strip any citations the LLM may have added (we'll add correct ones)
    citation_patterns = [
        r'\n*Sources?:\s*\[?[^\]]+\]?\s*$',
        r'\n*Sources?:\s*[^\n]+$',
    ]
    cleaned_response = response
    for pattern in citation_patterns:
        cleaned_response = re.sub(pattern, '', cleaned_response, flags=re.IGNORECASE | re.MULTILINE)
    cleaned_response = cleaned_response.rstrip()

    # Tokenize response into words (lowercase, alphanumeric only)
    response_words = set(re.findall(r'\b[a-z0-9]{3,}\b', response.lower()))

    # Track which docs have significant overlap
    doc_overlap_scores = {}

    for doc_name, chunk_text, score in chunks:
        # Get content words from chunk (skip header line if present)
        chunk_lines = chunk_text.split('\n')
        if chunk_lines and ' > ' in chunk_lines[0]:
            content = '\n'.join(chunk_lines[1:])
        else:
            content = chunk_text

        chunk_words = set(re.findall(r'\b[a-z0-9]{3,}\b', content.lower()))

        # Calculate overlap
        overlap = response_words & chunk_words
        overlap_count = len(overlap)

        # Only count if meaningful overlap (not just common words)
        # Includes generic words AND Klyra-specific terms that appear in every doc
        common_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
                       'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'your',
                       'from', 'they', 'been', 'have', 'this', 'that', 'with', 'what', 'when',
                       'where', 'which', 'their', 'there', 'these', 'those', 'would', 'could',
                       'should', 'about', 'into', 'more', 'some', 'such', 'than', 'then', 'them',
                       # Klyra-specific terms that appear in ALL docs
                       'klyra', 'labs', 'data', 'security', 'business', 'information',
                       'system', 'systems', 'solution', 'solutions', 'team', 'company',
                       'documents', 'document', 'knowledge', 'secure', 'private', 'privacy'}
        meaningful_overlap = overlap - common_words

        if len(meaningful_overlap) >= min_overlap:
            if doc_name not in doc_overlap_scores:
                doc_overlap_scores[doc_name] = 0
            doc_overlap_scores[doc_name] += len(meaningful_overlap)
            logger.info(f"Citation match: {doc_name} has {len(meaningful_overlap)} meaningful overlapping words")

    # Get docs that contributed, sorted by overlap score
    if doc_overlap_scores:
        sorted_docs = sorted(doc_overlap_scores.items(), key=lambda x: x[1], reverse=True)
        top_score = sorted_docs[0][1]

        # Only cite docs with at least 80% of the top score's overlap
        # This ensures we only cite the primary source(s), not docs
        # that happen to share generic company terminology
        threshold = top_score * 0.8
        matched_docs = [doc for doc, score in sorted_docs if score >= threshold]

        logger.info(f"Top score: {top_score}, threshold (80%): {threshold}")
        for doc, score in sorted_docs:
            logger.info(f"  {doc}: {score} {'✓' if score >= threshold else '✗'}")

        if matched_docs:
            cleaned_response += f"\n\nSources: {', '.join(matched_docs)}"
            logger.info(f"Final citations: {matched_docs}")
            return cleaned_response, matched_docs

    logger.info("No significant text overlap found - no citations added")
    return cleaned_response, []


def get_all_document_content() -> List[Tuple[str, str]]:
    """Get ALL document content from ChromaDB."""
    if collection.count() == 0:
        return []

    all_data = collection.get(include=["documents", "metadatas"])
    if not all_data or not all_data["documents"]:
        return []

    # Group chunks by document
    doc_chunks = {}
    for doc, meta in zip(all_data["documents"], all_data["metadatas"]):
        doc_name = meta.get("document_name", "unknown")
        if doc_name not in doc_chunks:
            doc_chunks[doc_name] = []
        doc_chunks[doc_name].append(doc)

    # Combine chunks per document
    result = []
    for doc_name, chunks in doc_chunks.items():
        full_text = "\n\n".join(chunks)
        result.append((doc_name, full_text))

    return result


def build_rag_prompt_simple(query: str, documents: List[Tuple[str, str]], conversation_history: List[dict] = None) -> Tuple[str, List[str]]:
    """
    Simple prompt: include ALL document content. LLM finds what's relevant.
    """
    # Build conversation history
    history_str = ""
    logger.info(f"Building prompt for query: '{query[:50]}...'")
    logger.info(f"Conversation history received: {len(conversation_history) if conversation_history else 0} messages")
    if conversation_history:
        for i, msg in enumerate(conversation_history):
            logger.info(f"  [{i}] {msg['role']}: {msg['content'][:50]}...")
        history_parts = []
        # Include more conversation history (up to 20 messages) so LLM remembers earlier context
        for msg in conversation_history[-20:]:
            role = "User" if msg["role"] == "user" else "Assistant"
            history_parts.append(f"{role}: {msg['content']}")
        history_str = "\n\n".join(history_parts)
        logger.info(f"History string length: {len(history_str)} chars")

    doc_names = [name for name, _ in documents]

    if not documents:
        if history_str:
            prompt = f"""You are Klyra, a helpful AI assistant.

CONVERSATION SO FAR:
{history_str}

Answer the user's question using your general knowledge.

User: {query}

Klyra:"""
        else:
            prompt = f"""You are Klyra, a helpful AI assistant.

Answer the user's question using your general knowledge.

User: {query}

Klyra:"""
        return prompt, []

    # Build document content section - include EVERYTHING
    doc_sections = []
    for doc_name, content in documents:
        doc_sections.append(f"=== {doc_name} ===\n{content}")
    all_docs_text = "\n\n".join(doc_sections)

    if history_str:
        prompt = f"""[SYSTEM INSTRUCTIONS - NOT PART OF CONVERSATION]
You are Klyra, a helpful AI assistant.

For company questions: use ONLY the documents below, add "Sources: [document, section]" (e.g., "Sources: handbook.md, About > Team")
For general knowledge: use your training data freely, no sources needed
Answer directly without preamble. List ALL items when asked about lists.
For company info: NEVER make up names, dates, or facts.
[END SYSTEM INSTRUCTIONS]

[CONVERSATION HISTORY]
{history_str}
[END CONVERSATION HISTORY]

[REFERENCE DOCUMENTS]
{all_docs_text}
[END REFERENCE DOCUMENTS]

User: {query}

Klyra:"""
    else:
        prompt = f"""[SYSTEM INSTRUCTIONS - NOT PART OF CONVERSATION]
You are Klyra, a helpful AI assistant.

For company questions: use ONLY the documents below, add "Sources: [document, section]" (e.g., "Sources: handbook.md, About > Team")
For general knowledge: use your training data freely, no sources needed
Answer directly without preamble. List ALL items when asked about lists.
For company info: NEVER make up names, dates, or facts.
[END SYSTEM INSTRUCTIONS]

[REFERENCE DOCUMENTS]
{all_docs_text}
[END REFERENCE DOCUMENTS]

User: {query}

Klyra:"""

    return prompt, doc_names


async def query_with_rag_simple(query: str, conversation_history: List[dict] = None) -> Tuple[str, List[str]]:
    """
    Simple RAG: include ALL document content in the prompt.
    No thresholds, no semantic search scoring - the LLM sees everything.
    """
    all_docs = get_all_document_content()
    logger.info(f"Simple RAG: Including {len(all_docs)} documents in prompt")
    for doc_name, content in all_docs:
        logger.info(f"  - {doc_name}: {len(content)} chars")

    prompt, sources = build_rag_prompt_simple(query, all_docs, conversation_history)
    return prompt, sources


def extract_section_from_chunk(chunk_text: str) -> str:
    """
    Extract section path from chunk with header context.
    E.g., "Doc > Section > Subsection\n\nContent" -> "Section > Subsection"
    """
    lines = chunk_text.split('\n')
    if lines and ' > ' in lines[0]:
        parts = lines[0].strip().split(' > ')
        if len(parts) > 1:
            return ' > '.join(parts[1:])  # Skip doc name, return sections
    return ""


def build_prompt_with_context(
    query: str,
    chunks: List[Tuple[str, str, float]],
    conversation_history: List[dict] = None,
    use_general_knowledge: bool = False
) -> Tuple[str, List[str]]:
    """
    Build prompt with retrieved chunks or general knowledge fallback.

    Returns: (prompt, list of doc names for citation validation)
    """
    # Build conversation history (last 10 messages)
    history_str = ""
    if conversation_history:
        history_parts = []
        for msg in conversation_history[-10:]:
            role = "User" if msg["role"] == "user" else "Assistant"
            history_parts.append(f"{role}: {msg['content']}")
        history_str = "\n".join(history_parts)

    # GENERAL KNOWLEDGE MODE
    if use_general_knowledge or not chunks:
        prompt = f"""You are Klyra, an AI assistant created by Klyra Labs.

IDENTITY (only mention if DIRECTLY asked "who are you" or "who made you"):
- Your name is Klyra, created by Klyra Labs
- NEVER say you were made by Alibaba, OpenAI, Anthropic, or any other company
- Do NOT end every message with your identity - only state it when asked

INSTRUCTIONS:
- Answer naturally using your general knowledge
- Be helpful, friendly, and conversational
- Do NOT add unnecessary sign-offs or identity statements

{f"PREVIOUS CONVERSATION:{chr(10)}{history_str}{chr(10)}{chr(10)}" if history_str else ""}User: {query}

Klyra:"""
        return prompt, []

    # DOCUMENT-BASED MODE
    # Build context with section info for citations
    context_parts = []
    doc_names = set()

    for doc_name, chunk_text, score in chunks:
        section = extract_section_from_chunk(chunk_text)
        doc_names.add(doc_name)

        # Get content after the header line
        content_lines = chunk_text.split('\n')
        if len(content_lines) > 1 and ' > ' in content_lines[0]:
            content = '\n'.join(content_lines[1:]).strip()
        else:
            content = chunk_text.strip()

        if section:
            context_parts.append(f"[{doc_name}, {section}]\n{content}")
        else:
            context_parts.append(f"[{doc_name}]\n{content}")

    context_str = "\n\n---\n\n".join(context_parts)

    prompt = f"""You are Klyra, an AI assistant created by Klyra Labs.

IDENTITY (only mention if DIRECTLY asked "who are you" or "who made you"):
- Your name is Klyra, created by Klyra Labs
- NEVER say you were made by Alibaba, OpenAI, Anthropic, or any other company
- Do NOT end every message with your identity - only state it when asked

INSTRUCTIONS:
1. Answer using the DOCUMENTS below when they contain relevant information
2. For questions not covered in documents, use your general knowledge naturally
3. Be direct, helpful, and conversational. List ALL items when asked about lists.
4. NEVER make up company information - only use what's in the documents
5. Do NOT add "Sources:" - the system handles citations automatically

{f"PREVIOUS CONVERSATION:{chr(10)}{history_str}{chr(10)}{chr(10)}" if history_str else ""}DOCUMENTS:
{context_str}

---

User: {query}

Klyra:"""

    return prompt, list(doc_names)


def is_user_provided_content(query: str) -> bool:
    """
    Detect if the query contains user-provided content that shouldn't be
    matched against documents (e.g., pasted emails, articles, long text).

    When users paste content for summarization/analysis, we shouldn't
    cite our documents for that content.
    """
    query_lower = query.lower()
    word_count = len(query.split())

    # Long queries (>100 words) with summary-related keywords
    summary_keywords = ["summarize", "summary", "summarise", "tldr", "key points",
                       "main points", "break down", "explain this", "what does this mean"]
    has_summary_keyword = any(kw in query_lower for kw in summary_keywords)

    # Very long content (>150 words) is likely pasted content
    if word_count > 150:
        logger.info(f"Detected user-provided content: {word_count} words")
        return True

    # Medium-length content (>80 words) with summary keywords
    if word_count > 80 and has_summary_keyword:
        logger.info(f"Detected summary request with pasted content: {word_count} words")
        return True

    return False


async def query_with_rag(query: str, conversation_history: List[dict] = None) -> Tuple[str, List[str], List[Tuple[str, str, float]], Dict]:
    """
    Main RAG entry point.

    Uses semantic search to find relevant chunks, with transparent fallback
    to general knowledge when no relevant documents are found.

    Scales to hundreds of documents (uses search, not include-all).

    Returns: (prompt, doc_names, chunks, metadata)
    - prompt: The constructed prompt for the LLM
    - doc_names: List of document names in context
    - chunks: Retrieved chunks for post-hoc citation matching
    - metadata: Dict with confidence_score, confidence_level, is_ambiguous, etc.
    """
    logger.info(f"RAG query: '{query[:50]}...'")
    logger.info(f"Conversation history: {len(conversation_history) if conversation_history else 0} messages")

    # Initialize metadata
    metadata = {
        "confidence_score": 0.0,
        "confidence_level": "none",
        "is_ambiguous": False,
        "ambiguous_docs": [],
        "query_category": None,
        "used_general_knowledge": False,
        "is_user_content": False
    }

    # Check if query contains user-provided content (pasted emails, articles, etc.)
    # These should use general knowledge, not document search
    if is_user_provided_content(query):
        logger.info("User-provided content detected, using general knowledge mode")
        metadata["used_general_knowledge"] = True
        metadata["is_user_content"] = True
        prompt, doc_names = build_prompt_with_context(query, [], conversation_history, use_general_knowledge=True)
        return prompt, doc_names, [], metadata

    # Detect query category for logging/analytics
    query_category = detect_query_category(query)
    metadata["query_category"] = query_category
    if query_category:
        logger.info(f"Query category detected: {query_category}")

    # Log conversation for debugging
    if conversation_history:
        for i, msg in enumerate(conversation_history[-10:]):
            logger.info(f"  [{i}] {msg['role']}: {msg['content'][:50]}...")

    # Check if there are any documents at all
    total_chunks = collection.count()
    if total_chunks == 0:
        logger.info("No documents in database, using general knowledge")
        prompt, doc_names = build_prompt_with_context(query, [], conversation_history, use_general_knowledge=True)
        metadata["used_general_knowledge"] = True
        return prompt, doc_names, [], metadata

    # Enhance query with conversation context for better search
    # e.g., "who is kieren" becomes "who is kieren Klyra Labs" if discussing Klyra
    search_query = enhance_query_with_context(query, conversation_history)

    # Search for relevant chunks (semantic + keyword hybrid)
    chunks = await search_similar_chunks(search_query, top_k=MAX_CONTEXT_CHUNKS)

    # Log search results
    if chunks:
        logger.info(f"Found {len(chunks)} chunks:")
        for doc, text, score in chunks:
            logger.info(f"  - {doc} (score={score:.3f}): {text[:60]}...")

    # Calculate confidence BEFORE filtering
    confidence_score, confidence_level = calculate_confidence(chunks)
    metadata["confidence_score"] = confidence_score
    metadata["confidence_level"] = confidence_level

    # Check for ambiguous queries
    ambiguity = detect_ambiguous_query(query, chunks)
    if ambiguity:
        metadata["is_ambiguous"] = True
        metadata["ambiguous_docs"] = ambiguity["matching_docs"]

    # Filter by relevance threshold
    # 0.55 = catches slightly lower matches while avoiding noise
    RELEVANCE_THRESHOLD = 0.55
    relevant_chunks = [(doc, text, score) for doc, text, score in chunks if score >= RELEVANCE_THRESHOLD]

    if not relevant_chunks and chunks:
        logger.info(f"No chunks above threshold {RELEVANCE_THRESHOLD}, falling back to general knowledge")
        # Still show the best scores for debugging
        best_score = max(score for _, _, score in chunks) if chunks else 0
        logger.info(f"Best score was {best_score:.3f}")

    if relevant_chunks:
        logger.info(f"Using {len(relevant_chunks)} relevant chunks (score >= {RELEVANCE_THRESHOLD})")

    # Build prompt - use general knowledge mode if no relevant chunks
    use_general = len(relevant_chunks) == 0
    metadata["used_general_knowledge"] = use_general

    prompt, doc_names = build_prompt_with_context(
        query,
        relevant_chunks,
        conversation_history,
        use_general_knowledge=use_general
    )

    return prompt, doc_names, relevant_chunks, metadata
