from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import Feedback, Message, FeedbackType
from schemas import FeedbackCreate, FeedbackResponse, FeedbackStats
from auth import get_current_user, get_current_admin_user, CurrentUser

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse)
async def submit_feedback(
    feedback: FeedbackCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit feedback (thumbs up/down) for a message."""
    # Verify message exists
    message = db.query(Message).filter(Message.id == feedback.message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Check if user already gave feedback for this message
    existing = db.query(Feedback).filter(
        Feedback.message_id == feedback.message_id,
        Feedback.user_id == current_user.id
    ).first()

    if existing:
        # Update existing feedback
        existing.feedback_type = feedback.feedback_type
        existing.comment = feedback.comment
        db.commit()
        db.refresh(existing)
        return existing

    # Create new feedback
    db_feedback = Feedback(
        message_id=feedback.message_id,
        user_id=current_user.id,
        feedback_type=feedback.feedback_type,
        comment=feedback.comment
    )
    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)

    return db_feedback


@router.get("/message/{message_id}", response_model=FeedbackResponse)
async def get_message_feedback(
    message_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's feedback for a specific message."""
    feedback = db.query(Feedback).filter(
        Feedback.message_id == message_id,
        Feedback.user_id == current_user.id
    ).first()

    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No feedback found"
        )

    return feedback


@router.delete("/message/{message_id}")
async def delete_feedback(
    message_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove feedback for a message."""
    feedback = db.query(Feedback).filter(
        Feedback.message_id == message_id,
        Feedback.user_id == current_user.id
    ).first()

    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No feedback found"
        )

    db.delete(feedback)
    db.commit()

    return {"status": "deleted"}


@router.get("/stats", response_model=FeedbackStats)
async def get_feedback_stats(
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get feedback statistics (admin only)."""
    total_positive = db.query(Feedback).filter(
        Feedback.feedback_type == FeedbackType.positive
    ).count()

    total_negative = db.query(Feedback).filter(
        Feedback.feedback_type == FeedbackType.negative
    ).count()

    # Get recent negative feedback with comments
    recent_negative = db.query(Feedback).filter(
        Feedback.feedback_type == FeedbackType.negative
    ).order_by(desc(Feedback.created_at)).limit(10).all()

    return FeedbackStats(
        total_positive=total_positive,
        total_negative=total_negative,
        recent_negative=recent_negative
    )
