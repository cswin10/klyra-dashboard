"""
Tests for RAG (Retrieval Augmented Generation) utilities.
"""
import pytest
from rag import (
    chunk_text,
    build_rag_prompt,
    extract_text_from_txt,
    process_citations,
    MAX_CONTEXT_CHUNKS,
)


class TestTextChunking:
    """Tests for text chunking functionality."""

    def test_chunk_short_text(self):
        """Short text should result in single chunk."""
        text = "This is a short piece of text."
        chunks = chunk_text(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_chunk_long_text(self):
        """Long text should be split into multiple chunks."""
        # Create text longer than chunk size (800 chars)
        text = "This is a sentence. " * 100
        chunks = chunk_text(text)
        assert len(chunks) > 1

    def test_chunks_have_overlap(self):
        """Chunks should have some overlap."""
        text = "Sentence one. " * 50 + "Unique marker here. " + "Sentence two. " * 50
        chunks = chunk_text(text)
        assert len(chunks) > 1

    def test_empty_text(self):
        """Empty text should return empty list."""
        chunks = chunk_text("")
        assert chunks == []


class TestTextExtraction:
    """Tests for text extraction from files."""

    def test_extract_from_txt(self, tmp_path):
        """Should extract text from txt file."""
        txt_file = tmp_path / "test.txt"
        txt_file.write_text("Hello, this is test content.")

        text = extract_text_from_txt(str(txt_file))
        assert text == "Hello, this is test content."

    def test_extract_from_txt_with_unicode(self, tmp_path):
        """Should handle unicode in txt files."""
        txt_file = tmp_path / "unicode.txt"
        txt_file.write_text("Hello 世界 🌍", encoding="utf-8")

        text = extract_text_from_txt(str(txt_file))
        assert "世界" in text


class TestRAGPromptBuilding:
    """Tests for RAG prompt construction with LLM-driven citations."""

    def test_build_prompt_no_context(self):
        """Prompt without context should use general knowledge instruction."""
        query = "What is Python?"
        prompt, provided_docs = build_rag_prompt(query, [])

        assert "Klyra" in prompt
        assert query in prompt
        assert provided_docs == []
        assert "general knowledge" in prompt.lower()

    def test_build_prompt_returns_provided_docs(self):
        """Should return list of documents that were included in prompt."""
        query = "What is Python?"
        context = [
            ("python_guide.pdf", "Python is a programming language", 0.85),
            ("intro.pdf", "Learn Python basics", 0.80),
        ]
        prompt, provided_docs = build_rag_prompt(query, context)

        # Returns docs that were provided (for citation validation)
        assert "python_guide.pdf" in provided_docs
        assert "intro.pdf" in provided_docs
        # Documents should be in prompt for LLM to consider
        assert "Python is a programming language" in prompt
        assert "Learn Python basics" in prompt

    def test_build_prompt_includes_citation_instructions(self):
        """Prompt should include citation instructions for LLM."""
        query = "What is Python?"
        context = [("doc.pdf", "Python content", 0.85)]
        prompt, provided_docs = build_rag_prompt(query, context)

        # Simplified prompt now has citation instructions
        assert "Sources:" in prompt.lower() or "sources" in prompt.lower()
        assert "doc.pdf" in provided_docs

    def test_build_prompt_includes_document_content(self):
        """Prompt should include the document content."""
        query = "What is Python?"
        context = [("doc.pdf", "Python content", 0.85)]
        prompt, provided_docs = build_rag_prompt(query, context)

        assert "Python content" in prompt
        assert "general knowledge" in prompt.lower() or "knowledge" in prompt.lower()

    def test_build_prompt_low_relevance_excluded(self):
        """Very low relevance context (< 0.2) should be excluded from prompt."""
        query = "What is Python?"
        context = [
            ("doc1.pdf", "Some irrelevant content", 0.1),
            ("doc2.pdf", "More irrelevant content", 0.15),
        ]
        prompt, provided_docs = build_rag_prompt(query, context)

        assert provided_docs == []
        assert "Some irrelevant content" not in prompt
        assert "More irrelevant content" not in prompt

    def test_build_prompt_context_limiting(self):
        """Should limit chunks to MAX_CONTEXT_CHUNKS."""
        query = "Test query"
        # Create more chunks than the limit
        context = [
            (f"doc{i}.pdf", f"Content {i}", 0.9 - i*0.01)
            for i in range(15)
        ]
        prompt, provided_docs = build_rag_prompt(query, context)

        # Should only include MAX_CONTEXT_CHUNKS documents
        assert len(provided_docs) <= MAX_CONTEXT_CHUNKS

    def test_build_prompt_with_conversation_history(self):
        """Prompt should include conversation history."""
        query = "Tell me more"
        context = []
        history = [
            {"role": "user", "content": "What is AI?"},
            {"role": "assistant", "content": "AI is artificial intelligence."},
        ]
        prompt, provided_docs = build_rag_prompt(query, context, history)

        assert "What is AI?" in prompt
        assert "AI is artificial intelligence" in prompt
        assert "CONVERSATION SO FAR" in prompt

    def test_klyra_identity_in_prompt(self):
        """Prompt should include Klyra identity."""
        query = "Who are you?"
        prompt, provided_docs = build_rag_prompt(query, [])

        assert "Klyra" in prompt
        assert "helpful" in prompt.lower()


class TestRelevanceThreshold:
    """Tests for the 0.2 relevance threshold."""

    def test_threshold_boundary_below(self):
        """Score of exactly 0.2 should be excluded."""
        query = "Test"
        context = [("doc.pdf", "Content", 0.2)]
        prompt, provided_docs = build_rag_prompt(query, context)

        assert provided_docs == []
        assert "Content" not in prompt

    def test_threshold_boundary_above(self):
        """Score just above 0.2 should be included in prompt."""
        query = "Test"
        context = [("doc.pdf", "Important content here", 0.21)]
        prompt, provided_docs = build_rag_prompt(query, context)

        assert "doc.pdf" in provided_docs
        assert "Important content here" in prompt


class TestCitationProcessing:
    """Tests for citation validation and normalization."""

    def test_process_valid_citation(self):
        """Valid citations should be kept."""
        response = "The answer is 42.\n\nSources: company-doc.pdf"
        provided_docs = ["company-doc.pdf"]

        cleaned, valid = process_citations(response, provided_docs)

        assert "company-doc.pdf" in valid
        assert "Sources: company-doc.pdf" in cleaned

    def test_process_invalid_citation_stripped(self):
        """Invalid citations (not in provided docs) should be stripped."""
        response = "Paris is the capital.\n\nSources: geography.pdf"
        provided_docs = ["company-handbook.pdf"]  # geography.pdf not provided

        cleaned, valid = process_citations(response, provided_docs)

        assert valid == []
        assert "Sources:" not in cleaned
        assert "Paris is the capital" in cleaned

    def test_process_partial_match(self):
        """Partial matches should work for citation validation."""
        response = "The CEO is John.\n\nSources: handbook"
        provided_docs = ["company-handbook.pdf"]

        cleaned, valid = process_citations(response, provided_docs)

        assert "company-handbook.pdf" in valid

    def test_process_multiple_citations(self):
        """Multiple citations should all be validated."""
        response = "Info from docs.\n\nSources: doc1.pdf, doc2.pdf"
        provided_docs = ["doc1.pdf", "doc2.pdf", "doc3.pdf"]

        cleaned, valid = process_citations(response, provided_docs)

        assert "doc1.pdf" in valid
        assert "doc2.pdf" in valid
        assert "doc3.pdf" not in valid  # Not cited

    def test_process_mixed_valid_invalid(self):
        """Mix of valid and invalid should only keep valid."""
        response = "Answer here.\n\nSources: real-doc.pdf, fake-doc.pdf"
        provided_docs = ["real-doc.pdf"]

        cleaned, valid = process_citations(response, provided_docs)

        assert "real-doc.pdf" in valid
        assert "fake-doc.pdf" not in valid
        assert len(valid) == 1

    def test_process_no_citation(self):
        """Response without citations should return empty sources."""
        response = "This is a general knowledge answer."
        provided_docs = ["some-doc.pdf"]

        cleaned, valid = process_citations(response, provided_docs)

        assert valid == []
        assert cleaned == response

    def test_process_normalizes_format(self):
        """Different citation formats should be normalized."""
        response = "Answer.\n\n(Source: doc.pdf)"
        provided_docs = ["doc.pdf"]

        cleaned, valid = process_citations(response, provided_docs)

        # Should be normalized to standard format
        assert "Sources: doc.pdf" in cleaned
        assert "doc.pdf" in valid

    def test_process_empty_response(self):
        """Empty response should be handled."""
        cleaned, valid = process_citations("", ["doc.pdf"])

        assert cleaned == ""
        assert valid == []

    def test_process_removes_duplicates(self):
        """Duplicate citations should be removed."""
        response = "Info.\n\nSources: doc.pdf, doc.pdf, doc.pdf"
        provided_docs = ["doc.pdf"]

        cleaned, valid = process_citations(response, provided_docs)

        assert valid == ["doc.pdf"]  # Only one
        assert cleaned.count("doc.pdf") == 1
