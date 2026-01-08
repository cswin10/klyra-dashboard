#!/usr/bin/env python3
"""
Migration script: Migrate existing documents to company-wide documents.

This script:
1. Updates all existing documents to have owner_id = NULL (company-wide)
2. Updates ChromaDB chunks to have owner_id = "__company__" metadata

Run from backend directory:
    python3 migrations/migrate_docs_to_company.py
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import chromadb
from config import settings

def migrate_database():
    """Update all documents to be company-wide (owner_id = NULL)."""
    print("Connecting to database...")
    engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Get all documents
        from models import Document
        from sqlalchemy import text

        # Update all documents to have owner_id = NULL
        result = db.execute(
            text("UPDATE documents SET owner_id = NULL WHERE owner_id IS NOT NULL")
        )
        count = result.rowcount

        db.commit()
        print(f"Updated {count} documents to be company-wide (owner_id = NULL)")

    except Exception as e:
        print(f"Database migration error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def migrate_chromadb():
    """Update ChromaDB chunks to have owner_id = "__company__" metadata."""
    print("\nConnecting to ChromaDB...")

    try:
        client = chromadb.PersistentClient(path=settings.CHROMA_PATH)
        collection = client.get_or_create_collection("documents")

        # Get all chunks
        all_data = collection.get(include=["metadatas"])

        if not all_data["ids"]:
            print("No chunks found in ChromaDB")
            return

        total = len(all_data["ids"])
        updated = 0

        # Update each chunk's metadata to include owner_id = "__company__"
        for chunk_id, metadata in zip(all_data["ids"], all_data["metadatas"]):
            if metadata.get("owner_id") != "__company__":
                # Update metadata
                metadata["owner_id"] = "__company__"
                collection.update(
                    ids=[chunk_id],
                    metadatas=[metadata]
                )
                updated += 1

        print(f"Updated {updated}/{total} chunks to have owner_id = '__company__'")

    except Exception as e:
        print(f"ChromaDB migration error: {e}")
        raise


def main():
    print("=" * 60)
    print("Migration: Existing Documents -> Company Documents")
    print("=" * 60)
    print()

    # Confirm before proceeding
    print("This will:")
    print("1. Set owner_id = NULL for all documents in the database")
    print("2. Set owner_id = '__company__' for all chunks in ChromaDB")
    print()

    response = input("Continue? (y/N): ").strip().lower()
    if response != 'y':
        print("Aborted.")
        return

    print()

    # Run migrations
    migrate_database()
    migrate_chromadb()

    print()
    print("=" * 60)
    print("Migration complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
