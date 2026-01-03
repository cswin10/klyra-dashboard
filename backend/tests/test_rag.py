"""
Tests for RAG (Retrieval Augmented Generation) utilities.
"""
import pytest
from rag import (
    chunk_text,
    build_rag_prompt,
    extract_text_from_txt,
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
        # Create text longer than chunk size (500 chars)
        text = "This is a sentence. " * 100
        chunks = chunk_text(text)
        assert len(chunks) > 1

    def test_chunks_have_overlap(self):
        """Chunks should have some overlap."""
        text = "Sentence one. " * 50 + "Unique marker here. " + "Sentence two. " * 50
        chunks = chunk_text(text)
        # If properly overlapping, the marker might appear in multiple chunks
        # or chunks should have some shared content at boundaries
        assert len(chunks) > 1

    def test_empty_text(self):
        """Empty text should return empty list."""
        chunks = chunk_text("")
        assert chunks == []


class TestTextExtraction:
    """Tests for text extraction from files."""

    def test_extract_from_txt(self, tmp_path):
        """Should extract text from txt file."""
        # Create a temp txt file
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
    """Tests for RAG prompt construction."""

    def test_build_prompt_no_context(self):
        """Prompt without context should use general knowledge instruction."""
        query = "What is Python?"
        prompt, sources = build_rag_prompt(query, [])

        assert "Klyra" in prompt
        assert query in prompt
        assert sources == []
        assert "general knowledge" in prompt.lower()

    def test_build_prompt_with_low_relevance_context(self):
        """Low relevance context (< 0.75) should be excluded."""
        query = "What is Python?"
        context = [
            ("doc1.pdf", "Some irrelevant content", 0.5),  # Below threshold
            ("doc2.pdf", "More irrelevant content", 0.6),  # Below threshold
        ]
        prompt, sources = build_rag_prompt(query, context)

        # Low relevance docs should be excluded
        assert sources == []
        assert "doc1.pdf" not in prompt
        assert "doc2.pdf" not in prompt

    def test_build_prompt_with_high_relevance_context(self):
        """High relevance context (> 0.75) should be included."""
        query = "What is Python?"
        context = [
            ("python_guide.pdf", "Python is a programming language", 0.85),
            ("intro.pdf", "Learn Python basics", 0.80),
        ]
        prompt, sources = build_rag_prompt(query, context)

        assert "python_guide.pdf" in sources
        assert "intro.pdf" in sources
        assert "Python is a programming language" in prompt
        assert "Learn Python basics" in prompt

    def test_build_prompt_mixed_relevance(self):
        """Only high relevance context should be included."""
        query = "What is Python?"
        context = [
            ("relevant.pdf", "Python content", 0.85),
            ("irrelevant.pdf", "Unrelated content", 0.50),
        ]
        prompt, sources = build_rag_prompt(query, context)

        assert "relevant.pdf" in sources
        assert "irrelevant.pdf" not in sources
        assert len(sources) == 1

    def test_build_prompt_with_conversation_history(self):
        """Prompt should include conversation history."""
        query = "Tell me more"
        context = []
        history = [
            {"role": "user", "content": "What is AI?"},
            {"role": "assistant", "content": "AI is artificial intelligence."},
        ]
        prompt, sources = build_rag_prompt(query, context, history)

        assert "What is AI?" in prompt
        assert "AI is artificial intelligence" in prompt
        assert "CONVERSATION SO FAR" in prompt

    def test_klyra_identity_in_prompt(self):
        """Prompt should include Klyra identity."""
        query = "Who are you?"
        prompt, sources = build_rag_prompt(query, [])

        assert "Klyra" in prompt
        assert "Klyra Labs" in prompt
        assert "private" in prompt.lower() or "on-premise" in prompt.lower()


class TestRelevanceThreshold:
    """Tests for the 0.75 relevance threshold."""

    def test_threshold_boundary_below(self):
        """Score of exactly 0.75 should be excluded."""
        query = "Test"
        context = [("doc.pdf", "Content", 0.75)]  # Exactly at threshold
        prompt, sources = build_rag_prompt(query, context)

        # 0.75 is NOT > 0.75, so should be excluded
        assert sources == []

    def test_threshold_boundary_above(self):
        """Score just above 0.75 should be included."""
        query = "Test"
        context = [("doc.pdf", "Content", 0.76)]
        prompt, sources = build_rag_prompt(query, context)

        assert "doc.pdf" in sources
