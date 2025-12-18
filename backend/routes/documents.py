import os
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models import User, Document, DocumentStatus
from schemas import DocumentResponse
from auth import get_current_user
from config import UPLOADS_DIR
from rag import process_document, delete_document_chunks

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "txt"}


def get_file_extension(filename: str) -> str:
    """Get file extension from filename."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


async def process_document_task(
    document_id: str,
    file_path: str,
    file_name: str,
    file_type: str,
    db_url: str
):
    """Background task to process a document."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return

        # Process document
        chunk_count = await process_document(document_id, file_path, file_name, file_type)

        # Update document status
        document.status = DocumentStatus.ready
        document.chunk_count = chunk_count
        db.commit()

    except Exception as e:
        # Mark as error
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = DocumentStatus.error
            db.commit()
        print(f"Error processing document: {e}")

    finally:
        db.close()


@router.get("", response_model=List[DocumentResponse])
async def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all documents."""
    documents = db.query(Document).order_by(Document.uploaded_at.desc()).all()
    return [DocumentResponse.model_validate(doc) for doc in documents]


@router.post("", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
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

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Create document record
    document = Document(
        name=file.filename,
        file_type=file_ext,
        file_size=file_size,
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
        settings.DATABASE_URL
    )

    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
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
