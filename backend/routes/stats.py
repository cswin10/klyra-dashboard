from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from database import get_db
from models import User, Log, Document, Chat, Message
from schemas import DashboardStats, DailyQueryCount
from auth import get_current_user, CurrentUser
from logging_config import get_logger

logger = get_logger("stats")

router = APIRouter(prefix="/api/stats", tags=["stats"])


class UserAnalytics(BaseModel):
    total_queries: int
    queries_today: int
    queries_this_week: int
    queries_this_month: int
    avg_response_time_ms: int
    total_chats: int
    total_messages: int
    queries_by_day: List[DailyQueryCount]
    top_documents: List[dict]
    recent_activity: List[dict]


@router.get("/me", response_model=UserAnalytics)
async def get_user_analytics(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics for the current user."""
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)

        user_id = current_user.id

        # Total queries
        total_queries = db.query(Log).filter(Log.user_id == user_id).count()

        # Queries today
        queries_today = db.query(Log).filter(
            Log.user_id == user_id,
            Log.created_at >= today_start
        ).count()

        # Queries this week
        queries_this_week = db.query(Log).filter(
            Log.user_id == user_id,
            Log.created_at >= week_start
        ).count()

        # Queries this month
        queries_this_month = db.query(Log).filter(
            Log.user_id == user_id,
            Log.created_at >= month_start
        ).count()

        # Average response time
        avg_time = db.query(func.avg(Log.response_time_ms)).filter(
            Log.user_id == user_id
        ).scalar()
        avg_response_time_ms = int(avg_time) if avg_time else 0

        # Total chats
        total_chats = db.query(Chat).filter(Chat.user_id == user_id).count()

        # Total messages (user's chats only)
        total_messages = db.query(Message).join(Chat).filter(
            Chat.user_id == user_id
        ).count()

        # Queries by day (last 14 days)
        queries_by_day = []
        for i in range(13, -1, -1):
            day_start = today_start - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            day_count = db.query(Log).filter(
                Log.user_id == user_id,
                Log.created_at >= day_start,
                Log.created_at < day_end
            ).count()
            day_name = day_start.strftime("%b %d")
            queries_by_day.append(DailyQueryCount(date=day_name, count=day_count))

        # Top documents queried (simplified - based on logs)
        # In a real system, you'd track which docs were used in responses
        top_documents = []
        docs = db.query(Document).filter(Document.status == "ready").limit(5).all()
        for doc in docs:
            top_documents.append({
                "name": doc.name,  # Use 'name' field, not 'title'
                "queries": 0  # Placeholder - would need proper tracking
            })

        # Recent activity (last 10 queries)
        recent_logs = db.query(Log).filter(
            Log.user_id == user_id
        ).order_by(Log.created_at.desc()).limit(10).all()

        recent_activity = [
            {
                "query": log.query[:100] + "..." if len(log.query) > 100 else log.query,
                "response_time_ms": log.response_time_ms,
                "created_at": log.created_at.isoformat()
            }
            for log in recent_logs
        ]

        return UserAnalytics(
            total_queries=total_queries,
            queries_today=queries_today,
            queries_this_week=queries_this_week,
            queries_this_month=queries_this_month,
            avg_response_time_ms=avg_response_time_ms,
            total_chats=total_chats,
            total_messages=total_messages,
            queries_by_day=queries_by_day,
            top_documents=top_documents,
            recent_activity=recent_activity
        )
    except Exception as e:
        logger.error(f"Error getting user analytics: {e}", exc_info=True)
        raise


@router.get("", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics."""
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = today_start - timedelta(days=7)
        two_weeks_ago = today_start - timedelta(days=14)
        month_start = today_start - timedelta(days=30)
        two_months_ago = today_start - timedelta(days=60)

        # Queries today
        queries_today = db.query(Log).filter(Log.created_at >= today_start).count()

        # Queries yesterday (for comparison)
        queries_yesterday = db.query(Log).filter(
            and_(Log.created_at >= yesterday_start, Log.created_at < today_start)
        ).count()

        # Calculate change percentage
        if queries_yesterday > 0:
            queries_today_change = ((queries_today - queries_yesterday) / queries_yesterday) * 100
        else:
            queries_today_change = 100.0 if queries_today > 0 else 0.0

        # Queries this week
        queries_this_week = db.query(Log).filter(Log.created_at >= week_start).count()

        # Queries last week (for comparison)
        queries_last_week = db.query(Log).filter(
            and_(Log.created_at >= two_weeks_ago, Log.created_at < week_start)
        ).count()

        if queries_last_week > 0:
            queries_this_week_change = ((queries_this_week - queries_last_week) / queries_last_week) * 100
        else:
            queries_this_week_change = 100.0 if queries_this_week > 0 else 0.0

        # Active users (last 30 days)
        active_users = db.query(User).filter(User.last_active >= month_start).count()

        # Active users from previous month (for comparison)
        active_users_prev = db.query(User).filter(
            and_(User.last_active >= two_months_ago, User.last_active < month_start)
        ).count()

        active_users_change = active_users - active_users_prev

        # Document count
        document_count = db.query(Document).count()

        # Documents added this week
        docs_this_week = db.query(Document).filter(Document.uploaded_at >= week_start).count()

        # Queries over time (last 7 days)
        queries_over_time = []
        for i in range(6, -1, -1):
            day_start = today_start - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            day_count = db.query(Log).filter(
                and_(Log.created_at >= day_start, Log.created_at < day_end)
            ).count()
            day_name = day_start.strftime("%a")
            queries_over_time.append(DailyQueryCount(date=day_name, count=day_count))

        return DashboardStats(
            queries_today=queries_today,
            queries_today_change=round(queries_today_change, 1),
            queries_this_week=queries_this_week,
            queries_this_week_change=round(queries_this_week_change, 1),
            active_users=active_users,
            active_users_change=active_users_change,
            document_count=document_count,
            document_count_change=docs_this_week,
            queries_over_time=queries_over_time
        )
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}", exc_info=True)
        raise
