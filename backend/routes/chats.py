import time
import json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import User, Chat, Message, MessageRole, Log
from schemas import ChatCreate, ChatResponse, ChatListResponse, MessageCreate, MessageResponse
from auth import get_current_user
from rag import query_with_rag
from ollama import generate_text

router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.get("", response_model=List[ChatListResponse])
async def get_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all chats for the current user."""
    chats = db.query(Chat).filter(
        Chat.user_id == current_user.id
    ).order_by(Chat.updated_at.desc()).all()

    return [ChatListResponse.model_validate(chat) for chat in chats]


@router.post("", response_model=ChatResponse)
async def create_chat(
    request: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat."""
    chat = Chat(
        user_id=current_user.id,
        title=request.title
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific chat with all messages."""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    return ChatResponse.model_validate(chat)


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat."""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted successfully"}


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: str,
    request: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message and get a streaming response."""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    start_time = time.time()

    # Save user message
    user_message = Message(
        chat_id=chat_id,
        role=MessageRole.user,
        content=request.content
    )
    db.add(user_message)

    # Update chat title if it's the first message
    if not chat.title:
        chat.title = request.content[:50] + ("..." if len(request.content) > 50 else "")

    chat.updated_at = datetime.utcnow()
    db.commit()

    # Build RAG prompt
    prompt, sources = await query_with_rag(request.content)

    async def generate_stream():
        full_response = ""

        try:
            async for token in generate_text(prompt):
                full_response += token
                # Send token as SSE
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Save assistant message
            assistant_message = Message(
                chat_id=chat_id,
                role=MessageRole.assistant,
                content=full_response,
                sources=sources if sources else None
            )
            db.add(assistant_message)

            # Log the query
            response_time_ms = int((time.time() - start_time) * 1000)
            log = Log(
                user_id=current_user.id,
                query=request.content,
                response_time_ms=response_time_ms
            )
            db.add(log)
            db.commit()

            # Send completion signal with sources
            yield f"data: {json.dumps({'done': True, 'sources': sources})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
