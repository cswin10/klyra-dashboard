import time
import json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Chat, Message, MessageRole, Log
from schemas import ChatCreate, ChatResponse, ChatListResponse, MessageCreate, MessageResponse
from auth import get_current_user, CurrentUser
from rag import query_with_rag, match_response_to_sources, get_low_confidence_disclaimer, get_ambiguity_clarification
from ollama import chat_generate

router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.get("", response_model=List[ChatListResponse])
async def get_chats(
    current_user: CurrentUser = Depends(get_current_user),
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
    current_user: CurrentUser = Depends(get_current_user),
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
    current_user: CurrentUser = Depends(get_current_user),
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
    current_user: CurrentUser = Depends(get_current_user),
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


@router.get("/{chat_id}/export")
async def export_chat(
    chat_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export a chat for PDF generation."""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.asc()).all()

    return {
        "id": chat.id,
        "title": chat.title or "Klyra Chat",
        "created_at": chat.created_at.isoformat(),
        "messages": [
            {
                "role": msg.role.value,
                "content": msg.content,
                "sources": msg.sources,
                "created_at": msg.created_at.isoformat()
            }
            for msg in messages
        ]
    }


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: str,
    request: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message and get a streaming response."""
    # Capture user_id immediately to avoid session issues
    user_id = current_user.id

    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == user_id
    ).first()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    start_time = time.time()

    # Capture values before entering the generator (to avoid session issues)
    query_content = request.content

    # Get conversation history (previous messages in this chat)
    previous_messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at.asc()).all()

    conversation_history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in previous_messages
    ]

    # Save user message
    user_message = Message(
        chat_id=chat_id,
        role=MessageRole.user,
        content=query_content
    )
    db.add(user_message)

    # Update chat title if it's the first message
    if not chat.title:
        chat.title = query_content[:50] + ("..." if len(query_content) > 50 else "")

    chat.updated_at = datetime.utcnow()
    db.commit()

    # Build RAG context - returns system prompt for chat API
    # chunks contains the actual text for post-hoc citation matching
    # metadata contains confidence scores and other info
    # Pass user_id to include user's personal docs alongside company docs
    _, provided_docs, chunks, rag_metadata, system_prompt = await query_with_rag(query_content, conversation_history, user_id=user_id)

    # Capture user message ID for returning to frontend
    user_message_id = user_message.id

    # Capture metadata for use in stream
    confidence_level = rag_metadata.get("confidence_level", "none")
    is_ambiguous = rag_metadata.get("is_ambiguous", False)
    ambiguous_docs = rag_metadata.get("ambiguous_docs", [])

    # Build messages array for chat API (conversation history + current query)
    chat_messages = conversation_history.copy() if conversation_history else []
    chat_messages.append({"role": "user", "content": query_content})

    async def generate_stream():
        full_response = ""
        assistant_message_id = None

        try:
            # Use chat API for proper conversational flow
            async for token in chat_generate(chat_messages, system_prompt=system_prompt):
                full_response += token
                # Send token as SSE
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Match response text to chunks to determine correct citations
            processed_response, valid_sources = match_response_to_sources(full_response, chunks)

            # Add low-confidence disclaimer if needed
            disclaimer = get_low_confidence_disclaimer(confidence_level, query_content)
            if disclaimer and not valid_sources:
                # Only add disclaimer if no sources were matched (pure general knowledge)
                processed_response += disclaimer
                # Stream the disclaimer to the frontend
                yield f"data: {json.dumps({'token': disclaimer})}\n\n"

            # Add ambiguity clarification if multiple docs matched equally
            if is_ambiguous and len(valid_sources) > 1:
                ambiguity_note = get_ambiguity_clarification(ambiguous_docs, query_content)
                if ambiguity_note:
                    processed_response += ambiguity_note
                    yield f"data: {json.dumps({'token': ambiguity_note})}\n\n"

            # Use a new session for saving (original may be closed)
            from database import SessionLocal
            with SessionLocal() as stream_db:
                # Save assistant message with processed response and validated sources
                assistant_message = Message(
                    chat_id=chat_id,
                    role=MessageRole.assistant,
                    content=processed_response,
                    sources=valid_sources if valid_sources else None
                )
                stream_db.add(assistant_message)

                # Log the query
                response_time_ms = int((time.time() - start_time) * 1000)
                log = Log(
                    user_id=user_id,
                    query=query_content,
                    response_time_ms=response_time_ms
                )
                stream_db.add(log)
                stream_db.commit()
                assistant_message_id = assistant_message.id

            # Send completion signal with validated sources, message IDs, and confidence
            yield f"data: {json.dumps({'done': True, 'sources': valid_sources, 'user_message_id': user_message_id, 'assistant_message_id': assistant_message_id, 'confidence': rag_metadata})}\n\n"

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
