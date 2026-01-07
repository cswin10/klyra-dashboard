"""
RAG Quality Test Suite

Run these tests to verify RAG retrieval is working correctly.
Tests check that queries retrieve the expected documents.

Usage:
    cd backend
    python -m pytest tests/test_rag_quality.py -v

Or run directly:
    python tests/test_rag_quality.py
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class TestCase:
    """A single RAG quality test case."""
    query: str
    expected_sources: List[str]  # Document names that SHOULD be retrieved
    excluded_sources: List[str]  # Document names that should NOT be cited
    min_confidence: float  # Minimum acceptable confidence score
    description: str  # What this test is checking


# Define test cases - update these based on your actual documents
TEST_CASES = [
    # Sales/Pitch queries - should hit Script document
    TestCase(
        query="What is the opening line of our sales pitch?",
        expected_sources=["script", "pitch"],
        excluded_sources=["case-study", "company-document"],
        min_confidence=0.5,
        description="Sales pitch opening should come from Script"
    ),
    TestCase(
        query="What objections might I face when selling?",
        expected_sources=["script", "pitch", "sales"],
        excluded_sources=[],
        min_confidence=0.4,
        description="Objection handling should come from sales docs"
    ),
    TestCase(
        query="What qualifying questions should I ask prospects?",
        expected_sources=["script", "pitch", "sales"],
        excluded_sources=[],
        min_confidence=0.4,
        description="Qualifying questions should come from sales docs"
    ),

    # Company info queries - should hit company document
    TestCase(
        query="Who works at Klyra Labs?",
        expected_sources=["company", "klyra"],
        excluded_sources=[],
        min_confidence=0.6,
        description="Team info should come from company document"
    ),
    TestCase(
        query="Who is the CEO of Klyra?",
        expected_sources=["company", "klyra"],
        excluded_sources=["script", "case"],
        min_confidence=0.6,
        description="CEO info should come from company document"
    ),
    TestCase(
        query="What hardware does Klyra run on?",
        expected_sources=["company", "klyra", "technical"],
        excluded_sources=["case-study"],
        min_confidence=0.5,
        description="Hardware specs should come from company/technical docs"
    ),

    # Case study queries - should hit case study document
    TestCase(
        query="How did Thompson & Associates use Klyra?",
        expected_sources=["thompson", "case"],
        excluded_sources=["script"],
        min_confidence=0.6,
        description="Thompson info should come from case study"
    ),
    TestCase(
        query="How do law firms handle compliance with Klyra?",
        expected_sources=["thompson", "case", "compliance"],
        excluded_sources=[],
        min_confidence=0.4,
        description="Law firm compliance should come from case study"
    ),

    # General knowledge queries - should NOT cite any documents
    TestCase(
        query="What is the capital of France?",
        expected_sources=[],  # Empty = should use general knowledge
        excluded_sources=["script", "company", "case", "thompson"],
        min_confidence=0.0,  # No confidence needed for general knowledge
        description="General knowledge should not cite internal docs"
    ),
    TestCase(
        query="What programming language is Python?",
        expected_sources=[],
        excluded_sources=["script", "company", "case"],
        min_confidence=0.0,
        description="Programming questions should not cite internal docs"
    ),
]


class RAGTestRunner:
    """Runs RAG quality tests and reports results."""

    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []

    async def run_test(self, test_case: TestCase) -> Tuple[bool, str]:
        """Run a single test case and return (passed, message)."""
        from rag import query_with_rag, match_response_to_sources, search_similar_chunks

        # Run the search
        chunks = await search_similar_chunks(test_case.query, top_k=8)

        if not chunks:
            # No chunks found
            if not test_case.expected_sources:
                return True, "✓ Correctly found no relevant docs (general knowledge)"
            else:
                return False, f"✗ No chunks found, expected: {test_case.expected_sources}"

        # Get document names from chunks
        retrieved_docs = list(set(doc_name.lower() for doc_name, _, _ in chunks))
        top_scores = [(doc, score) for doc, _, score in chunks[:3]]

        # Check confidence
        max_score = max(score for _, _, score in chunks)

        # Check expected sources
        if test_case.expected_sources:
            found_expected = False
            for expected in test_case.expected_sources:
                expected_lower = expected.lower()
                if any(expected_lower in doc for doc in retrieved_docs):
                    found_expected = True
                    break

            if not found_expected:
                return False, f"✗ Expected one of {test_case.expected_sources} but got {retrieved_docs[:3]}"

        # Check excluded sources (should not be in top results)
        for excluded in test_case.excluded_sources:
            excluded_lower = excluded.lower()
            # Only fail if excluded doc is the TOP result
            top_doc = chunks[0][0].lower() if chunks else ""
            if excluded_lower in top_doc:
                return False, f"✗ Top result was excluded source '{excluded}': {top_doc}"

        # Check confidence threshold
        if test_case.min_confidence > 0 and max_score < test_case.min_confidence:
            return False, f"✗ Confidence {max_score:.2f} below threshold {test_case.min_confidence}"

        # All checks passed
        return True, f"✓ Top: {top_scores[0][0]} ({top_scores[0][1]:.2f})"

    async def run_all_tests(self) -> None:
        """Run all test cases and report results."""
        print("\n" + "=" * 60)
        print("RAG QUALITY TEST SUITE")
        print("=" * 60 + "\n")

        for i, test_case in enumerate(TEST_CASES, 1):
            print(f"Test {i}: {test_case.description}")
            print(f"  Query: \"{test_case.query}\"")

            try:
                passed, message = await self.run_test(test_case)

                if passed:
                    self.passed += 1
                    print(f"  Result: {message}")
                else:
                    self.failed += 1
                    print(f"  Result: {message}")

                self.results.append((test_case, passed, message))

            except Exception as e:
                self.failed += 1
                print(f"  Result: ✗ Error: {str(e)}")
                self.results.append((test_case, False, f"Error: {str(e)}"))

            print()

        # Summary
        print("=" * 60)
        print(f"RESULTS: {self.passed} passed, {self.failed} failed")
        print(f"Pass rate: {self.passed / (self.passed + self.failed) * 100:.1f}%")
        print("=" * 60)

        if self.failed > 0:
            print("\nFailed tests:")
            for test_case, passed, message in self.results:
                if not passed:
                    print(f"  - {test_case.description}: {message}")


async def main():
    """Main entry point for running tests."""
    runner = RAGTestRunner()
    await runner.run_all_tests()

    # Return exit code based on results
    return 0 if runner.failed == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
