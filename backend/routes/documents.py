import os
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Form
from sqlalchemy.orm import Session
from database import get_db
from models import Document, DocumentStatus, DocumentCategory
from schemas import DocumentResponse, DocumentVersionResponse
from auth import get_current_user, CurrentUser
from config import UPLOADS_DIR
from rag import process_document, delete_document_chunks, search_similar_chunks

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "txt", "md"}


def get_file_extension(filename: str) -> str:
    """Get file extension from filename."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def process_document_task(
    document_id: str,
    file_path: str,
    file_name: str,
    file_type: str,
    category: str,
    db_url: str
):
    """Background task to process a document."""
    import asyncio
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return

        # Process document (create new event loop for background thread)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            chunk_count = loop.run_until_complete(
                process_document(document_id, file_path, file_name, file_type, category)
            )
        finally:
            loop.close()

        # Update document status
        document.status = DocumentStatus.ready
        document.chunk_count = chunk_count
        db.commit()
        print(f"Document processed successfully: {file_name} ({chunk_count} chunks)")

    except Exception as e:
        # Mark as error
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = DocumentStatus.error
            db.commit()
        print(f"Error processing document: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


@router.get("", response_model=List[DocumentResponse])
async def get_documents(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all documents (latest versions only)."""
    documents = db.query(Document).filter(
        Document.is_latest == 1
    ).order_by(Document.uploaded_at.desc()).all()
    return [DocumentResponse.model_validate(doc) for doc in documents]


@router.post("", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form(default="general"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and process a document."""
    # Validate file extension
    file_ext = get_file_extension(file.filename)
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not supported. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Validate category
    try:
        doc_category = DocumentCategory(category)
    except ValueError:
        doc_category = DocumentCategory.general

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Create document record
    document = Document(
        name=file.filename,
        file_type=file_ext,
        file_size=file_size,
        category=doc_category,
        status=DocumentStatus.processing,
        uploaded_by=current_user.id
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Save file to disk
    file_path = os.path.join(UPLOADS_DIR, f"{document.id}.{file_ext}")
    with open(file_path, "wb") as f:
        f.write(content)

    document.file_path = file_path
    db.commit()

    # Process document in background
    from config import settings
    background_tasks.add_task(
        process_document_task,
        document.id,
        file_path,
        file.filename,
        file_ext,
        doc_category.value,
        settings.DATABASE_URL
    )

    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document and its embeddings."""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Delete from ChromaDB
    delete_document_chunks(document_id)

    # Delete file from disk
    if document.file_path and os.path.exists(document.file_path):
        os.remove(document.file_path)

    # Delete from database
    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully"}


@router.get("/search")
async def search_documents(
    q: str,
    limit: int = 10,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search within documents using semantic search."""
    if not q or len(q.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters"
        )

    # Search using RAG
    results = await search_similar_chunks(q.strip(), top_k=limit)

    # Format results
    search_results = []
    for doc_name, chunk_text, score in results:
        # Find the document in database
        document = db.query(Document).filter(Document.name == doc_name).first()
        search_results.append({
            "document_name": doc_name,
            "document_id": document.id if document else None,
            "category": document.category.value if document else None,
            "excerpt": chunk_text[:500] + "..." if len(chunk_text) > 500 else chunk_text,
            "relevance_score": round(score, 3)
        })

    return {
        "query": q,
        "results": search_results,
        "total": len(search_results)
    }


@router.get("/{document_id}/versions", response_model=List[DocumentVersionResponse])
async def get_document_versions(
    document_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all versions of a document."""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Find the root document (the first version)
    root_id = document_id
    if document.parent_id:
        # Walk up to find the root
        current = document
        while current.parent_id:
            parent = db.query(Document).filter(Document.id == current.parent_id).first()
            if parent:
                current = parent
                root_id = parent.id
            else:
                break

    # Get all documents in this version chain
    versions = []

    # Start with root and find all children
    def collect_versions(doc_id):
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            versions.append(doc)
            # Find children (newer versions)
            children = db.query(Document).filter(Document.parent_id == doc_id).all()
            for child in children:
                collect_versions(child.id)

    collect_versions(root_id)

    # Sort by version number descending (newest first)
    versions.sort(key=lambda x: x.version, reverse=True)

    return [DocumentVersionResponse.model_validate(v) for v in versions]


@router.post("/{document_id}/versions", response_model=DocumentResponse)
async def upload_new_version(
    document_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a new version of an existing document."""
    # Get the current document
    current_doc = db.query(Document).filter(Document.id == document_id).first()

    if not current_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Validate file extension
    file_ext = get_file_extension(file.filename)
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not supported. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Mark the current document as not latest
    current_doc.is_latest = 0

    # Delete old document chunks from ChromaDB (we'll replace with new version's chunks)
    delete_document_chunks(current_doc.id)

    # Create new version
    new_version = Document(
        name=current_doc.name,  # Keep original name
        file_type=file_ext,
        file_size=file_size,
        category=current_doc.category,  # Keep same category
        status=DocumentStatus.processing,
        uploaded_by=current_user.id,
        version=current_doc.version + 1,
        parent_id=current_doc.id,
        is_latest=1
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    # Save file to disk
    file_path = os.path.join(UPLOADS_DIR, f"{new_version.id}.{file_ext}")
    with open(file_path, "wb") as f:
        f.write(content)

    new_version.file_path = file_path
    db.commit()

    # Process document in background
    from config import settings
    background_tasks.add_task(
        process_document_task,
        new_version.id,
        file_path,
        current_doc.name,  # Use original document name for embeddings
        file_ext,
        current_doc.category.value,
        settings.DATABASE_URL
    )

    return DocumentResponse.model_validate(new_version)


@router.post("/{document_id}/revert/{version_id}")
async def revert_to_version(
    document_id: str,
    version_id: str,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revert to a previous version of a document."""
    # Get the current latest and the target version
    current_doc = db.query(Document).filter(Document.id == document_id).first()
    target_doc = db.query(Document).filter(Document.id == version_id).first()

    if not current_doc or not target_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document or version not found"
        )

    if target_doc.is_latest == 1:
        return {"message": "Already on this version"}

    # Mark all versions as not latest
    all_versions = db.query(Document).filter(
        (Document.id == document_id) |
        (Document.parent_id == document_id)
    ).all()

    for v in all_versions:
        v.is_latest = 0

    # Mark target version as latest
    target_doc.is_latest = 1

    # Delete current chunks and reprocess target version
    delete_document_chunks(document_id)

    db.commit()

    # Re-process the target version to create new embeddings
    if target_doc.file_path and os.path.exists(target_doc.file_path):
        from config import settings
        background_tasks.add_task(
            process_document_task,
            target_doc.id,
            target_doc.file_path,
            target_doc.name,
            target_doc.file_type,
            target_doc.category.value,
            settings.DATABASE_URL
        )

    return {"message": f"Reverted to version {target_doc.version}"}
