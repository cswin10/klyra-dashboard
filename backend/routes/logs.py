from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
from models import User, Log
from schemas import LogResponse, LogsListResponse
from auth import get_current_admin_user

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", response_model=LogsListResponse)
async def get_logs(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get paginated logs (admin only)."""
    query = db.query(Log).options(joinedload(Log.user))

    if user_id:
        query = query.filter(Log.user_id == user_id)

    # Get total count
    total = query.count()

    # Get paginated results
    logs = query.order_by(desc(Log.created_at)).offset(offset).limit(limit).all()

    # Format response
    log_responses = []
    for log in logs:
        log_response = LogResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.name if log.user else None,
            user_email=log.user.email if log.user else None,
            query=log.query,
            response_time_ms=log.response_time_ms,
            created_at=log.created_at
        )
        log_responses.append(log_response)

    return LogsListResponse(
        logs=log_responses,
        total=total,
        limit=limit,
        offset=offset
    )
