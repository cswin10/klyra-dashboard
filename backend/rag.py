import os
import asyncio
from pathlib import Path
from typing import List, Tuple, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
from config import settings, CHROMA_DIR, UPLOADS_DIR
from ollama import generate_embedding
from logging_config import get_logger

logger = get_logger("rag")

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
        embedding = await generate_embedding(chunk)

        ids.append(chunk_id)
        embeddings.append(embedding)
        documents.append(chunk)
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

    # About/company queries
    if any(term in query_lower for term in ["about", "what is", "what does", "company"]):
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

    if expansions:
        expanded = f"{query} {' '.join(expansions)}"
        logger.info(f"Query expanded: '{query}' -> '{expanded}'")
        return expanded

    return query


def keyword_search_chunks(query: str, top_k: int = 5) -> List[Tuple[str, str, float]]:
    """
    Simple keyword-based search to catch exact matches semantic search might miss.
    Returns list of tuples: (document_name, chunk_text, score)
    """
    # Extract key terms from query (simple approach)
    import re
    words = re.findall(r'\b\w+\b', query.lower())
    # Filter out common stop words
    stop_words = {'what', 'who', 'where', 'when', 'how', 'why', 'is', 'are', 'the', 'a', 'an', 'does', 'do', 'at', 'in', 'on', 'for', 'to', 'of', 'and', 'or'}
    keywords = [w for w in words if w not in stop_words and len(w) > 2]

    if not keywords:
        return []

    # Get all chunks and search for keyword matches
    all_chunks = collection.get(include=["documents", "metadatas"])

    if not all_chunks or not all_chunks["documents"]:
        return []

    matches = []
    for i, doc in enumerate(all_chunks["documents"]):
        doc_lower = doc.lower()
        # Count keyword matches
        match_count = sum(1 for kw in keywords if kw in doc_lower)
        if match_count > 0:
            metadata = all_chunks["metadatas"][i]
            # Score based on proportion of keywords matched
            score = match_count / len(keywords)
            matches.append((metadata["document_name"], doc, score, match_count))

    # Sort by match count then by score
    matches.sort(key=lambda x: (x[3], x[2]), reverse=True)

    # Return top_k results
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

    # Also do keyword search and merge results (boost keyword matches)
    keyword_results = keyword_search_chunks(query, top_k=5)
    for doc_name, doc, kw_score in keyword_results:
        if doc[:100] not in seen_chunks:
            # Add keyword matches with boosted score
            boosted_score = min(0.7 + (kw_score * 0.3), 1.0)  # Boost to 0.7-1.0 range
            formatted_results.append((doc_name, doc, boosted_score))
            seen_chunks.add(doc[:100])
            logger.info(f"Keyword match added: score={boosted_score:.3f} | '{doc[:60]}...'")

    # Re-sort by score and return top_k
    formatted_results.sort(key=lambda x: x[2], reverse=True)
    return formatted_results[:top_k]


def build_rag_prompt(query: str, context_chunks: List[Tuple[str, str, float]], conversation_history: List[dict] = None) -> Tuple[str, List[str]]:
    """
    Build a prompt with RAG context and conversation history.
    Returns the prompt and list of source document names.

    conversation_history: List of {"role": "user"|"assistant", "content": "..."} dicts
    """
    # Klyra's core identity - consistent across all deployments
    klyra_identity = """You are Klyra, a private AI assistant created by Klyra Labs.

IDENTITY:
- Your name is Klyra
- You were created by Klyra Labs, a UK-based company specializing in sovereign AI infrastructure
- You run entirely on-premise - all data stays within the user's building
- You never send data to the cloud or external servers
- You are not ChatGPT, Claude, or any other AI - you are Klyra

PERSONALITY:
- Professional but warm and engaging
- Helpful and knowledgeable
- Confident but not arrogant
- You speak like a knowledgeable colleague, not a robotic assistant

RESPONSE GUIDELINES:
1. Match response length to the request - short questions get concise answers, detailed requests get comprehensive responses
2. Use formatting (bullets, headers) only when it improves readability for longer responses
3. For general knowledge: answer fully using your training knowledge
4. For company-specific questions: use provided documents and cite sources
5. If documents are provided but don't answer the question, say so and offer general knowledge if relevant
6. If you genuinely don't know something, say "I don't have information on that" rather than guessing

WHAT YOU DO:
- Answer general knowledge questions comprehensively
- Help users find information in company documents
- Write long-form content when requested
- Remember conversation context within a chat

WHAT YOU DON'T DO:
- Access the internet or provide real-time information
- Share information between users or companies
- Pretend to have document information you don't have
- Give medical, legal, or financial advice as professional guidance"""

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

    # Filter chunks by relevance score (only include if score > threshold)
    # Lower threshold to catch more potential matches
    MIN_RELEVANCE_SCORE = 0.35

    # Log all retrieved chunks for debugging
    total_chunks = collection.count()
    logger.info(f"ChromaDB has {total_chunks} total chunks")

    if context_chunks:
        logger.info(f"RAG search for query: '{query[:50]}...'")
        for doc, text, score in context_chunks:
            logger.info(f"  - {doc}: score={score:.3f} | '{text[:60]}...'")
    else:
        logger.info(f"RAG search found no chunks for: '{query[:50]}...'")

    relevant_chunks = [(doc, text, score) for doc, text, score in context_chunks if score > MIN_RELEVANCE_SCORE]

    if relevant_chunks:
        logger.info(f"Using {len(relevant_chunks)} chunks above threshold {MIN_RELEVANCE_SCORE}")
    else:
        logger.info(f"No chunks above threshold {MIN_RELEVANCE_SCORE}, using general knowledge")

    if not relevant_chunks:
        # No relevant documents - use general knowledge freely
        if history_str:
            prompt = f"""{klyra_identity}

CONVERSATION SO FAR:
{history_str}

---
Answer the user's question using your general knowledge. Give a complete, helpful response.

User: {query}

Klyra:"""
        else:
            prompt = f"""{klyra_identity}

Answer the user's question using your general knowledge. Give a complete, helpful response.

User: {query}

Klyra:"""
        return prompt, []

    # Build context string from retrieved documents
    context_parts = []
    source_docs = set()
    for doc_name, chunk_text, score in relevant_chunks:
        context_parts.append(f"[From: {doc_name}]\n{chunk_text}")
        source_docs.add(doc_name)

    context_str = "\n\n".join(context_parts)

    doc_instructions = """INSTRUCTIONS:
- If these documents answer the question, use them and cite the source
- If these documents are only partially relevant, use what helps and supplement with general knowledge
- If these documents don't actually help with this question, ignore them and answer from general knowledge
- Be honest if the documents don't contain what the user is looking for"""

    if history_str:
        prompt = f"""{klyra_identity}

CONVERSATION SO FAR:
{history_str}

RELEVANT COMPANY DOCUMENTS:
---
{context_str}
---

{doc_instructions}

User: {query}

Klyra:"""
    else:
        prompt = f"""{klyra_identity}

RELEVANT COMPANY DOCUMENTS:
---
{context_str}
---

{doc_instructions}

User: {query}

Klyra:"""

    return prompt, list(source_docs)


async def query_with_rag(query: str, conversation_history: List[dict] = None) -> Tuple[str, List[str]]:
    """
    Perform a RAG query: find similar chunks and build prompt with context.
    Returns the built prompt and list of source documents.

    conversation_history: List of {"role": "user"|"assistant", "content": "..."} dicts
    """
    similar_chunks = []

    # Only search if there are documents in the collection
    if collection.count() > 0:
        try:
            similar_chunks = await search_similar_chunks(query)
        except Exception as e:
            # Log error but continue without RAG context
            logger.warning(f"RAG search error (continuing without context): {e}")
            similar_chunks = []

    # Build prompt with context and conversation history
    prompt, sources = build_rag_prompt(query, similar_chunks, conversation_history)

    return prompt, sources


def get_total_chunks() -> int:
    """Get the total number of chunks in the collection."""
    return collection.count()
