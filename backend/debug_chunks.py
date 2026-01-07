#!/usr/bin/env python3
"""
Debug script to inspect ChromaDB chunks.
Run from backend directory: python3 debug_chunks.py
"""
import sys
sys.path.insert(0, '.')

import chromadb
from config import settings

client = chromadb.PersistentClient(path=settings.CHROMA_PATH)
collection = client.get_or_create_collection("documents")

print(f"ChromaDB path: {settings.CHROMA_PATH}")
print(f"Total chunks: {collection.count()}")
print()

# Get all chunks
all_data = collection.get(include=['documents', 'metadatas'])

if not all_data['documents']:
    print("No documents found in ChromaDB!")
    sys.exit(1)

# Search for specific terms
search_terms = ['charles', 'griffiths', 'team', 'kieren', 'charlie', 'joe', 'jack']

print("=" * 60)
print("SEARCHING FOR TEAM MEMBERS")
print("=" * 60)

for term in search_terms:
    matches = []
    for i, (doc, meta) in enumerate(zip(all_data['documents'], all_data['metadatas'])):
        if term.lower() in doc.lower():
            matches.append((i, meta.get('document_name', 'unknown'), doc[:300]))

    print(f"\n'{term}': {len(matches)} chunk(s)")
    for chunk_idx, doc_name, preview in matches[:3]:  # Show first 3
        print(f"  - Chunk {chunk_idx} from {doc_name}")
        print(f"    Preview: {preview[:150]}...")

# Show all chunks from company document
print("\n" + "=" * 60)
print("ALL CHUNKS FROM COMPANY DOCUMENT")
print("=" * 60)

for i, (doc, meta) in enumerate(zip(all_data['documents'], all_data['metadatas'])):
    doc_name = meta.get('document_name', '')
    if 'company' in doc_name.lower():
        print(f"\n--- Chunk {i} ({doc_name}) ---")
        print(doc[:500])
        print("...")
