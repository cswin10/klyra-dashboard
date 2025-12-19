from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
from models import AuditLog, AuditAction, User
from schemas import AuditLogResponse, AuditLogListResponse
from auth import get_current_admin_user, CurrentUser

router = APIRouter(prefix="/api/audit", tags=["audit"])


def log_audit_action(
    db: Session,
    user_id: Optional[str],
    action: AuditAction,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None
):
    """Helper function to create an audit log entry."""
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=ip_address
    )
    db.add(audit_log)
    db.commit()
    return audit_log


@router.get("", response_model=AuditLogListResponse)
async def get_audit_logs(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[AuditAction] = Query(None, description="Filter by action type"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get paginated audit logs (admin only)."""
    query = db.query(AuditLog).options(joinedload(AuditLog.user))

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    if action:
        query = query.filter(AuditLog.action == action)

    # Get total count
    total = query.count()

    # Get paginated results
    logs = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit).all()

    # Format response
    log_responses = []
    for log in logs:
        log_response = AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.name if log.user else None,
            user_email=log.user.email if log.user else None,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at
        )
        log_responses.append(log_response)

    return AuditLogListResponse(
        logs=log_responses,
        total=total,
        limit=limit,
        offset=offset
    )
