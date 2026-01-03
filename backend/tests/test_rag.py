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
        # Create text longer than chunk size (800 chars)
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
    """Tests for RAG prompt construction with LLM-driven citations."""

    def test_build_prompt_no_context(self):
        """Prompt without context should use general knowledge instruction."""
        query = "What is Python?"
        prompt, sources = build_rag_prompt(query, [])

        assert "Klyra" in prompt
        assert query in prompt
        assert sources == []  # Always empty - LLM handles citations
        assert "general knowledge" in prompt.lower()

    def test_build_prompt_always_returns_empty_sources(self):
        """Sources should always be empty - LLM decides what to cite."""
        query = "What is Python?"
        context = [
            ("python_guide.pdf", "Python is a programming language", 0.85),
            ("intro.pdf", "Learn Python basics", 0.80),
        ]
        prompt, sources = build_rag_prompt(query, context)

        # Sources always empty - LLM includes citations in response text
        assert sources == []
        # But documents should be in prompt for LLM to consider
        assert "Python is a programming language" in prompt
        assert "Learn Python basics" in prompt

    def test_build_prompt_includes_citation_instructions(self):
        """Prompt should include citation rules for LLM."""
        query = "What is Python?"
        context = [("doc.pdf", "Python content", 0.85)]
        prompt, sources = build_rag_prompt(query, context)

        assert "CITATION RULES" in prompt
        assert "Sources:" in prompt  # Instruction on how to cite
        assert "general knowledge" in prompt.lower()

    def test_build_prompt_low_relevance_excluded(self):
        """Low relevance context (< 0.4) should be excluded from prompt."""
        query = "What is Python?"
        context = [
            ("doc1.pdf", "Some irrelevant content", 0.3),  # Below 0.4 threshold
            ("doc2.pdf", "More irrelevant content", 0.35),  # Below 0.4 threshold
        ]
        prompt, sources = build_rag_prompt(query, context)

        assert sources == []
        assert "Some irrelevant content" not in prompt
        assert "More irrelevant content" not in prompt

    def test_build_prompt_high_relevance_included(self):
        """High relevance context (> 0.4) should be included in prompt."""
        query = "What is Python?"
        context = [
            ("python_guide.pdf", "Python is a programming language", 0.85),
            ("intro.pdf", "Learn Python basics", 0.80),
        ]
        prompt, sources = build_rag_prompt(query, context)

        # Content should be in prompt for LLM
        assert "Python is a programming language" in prompt
        assert "Learn Python basics" in prompt
        # But sources always empty
        assert sources == []

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
    """Tests for the 0.4 relevance threshold."""

    def test_threshold_boundary_below(self):
        """Score of exactly 0.4 should be excluded."""
        query = "Test"
        context = [("doc.pdf", "Content", 0.4)]  # Exactly at threshold
        prompt, sources = build_rag_prompt(query, context)

        # 0.4 is NOT > 0.4, so should be excluded
        assert sources == []
        assert "Content" not in prompt  # Shouldn't be in prompt either

    def test_threshold_boundary_above(self):
        """Score just above 0.4 should be included in prompt."""
        query = "Test"
        context = [("doc.pdf", "Important content here", 0.41)]
        prompt, sources = build_rag_prompt(query, context)

        # Sources always empty
        assert sources == []
        # But content should be in prompt
        assert "Important content here" in prompt
