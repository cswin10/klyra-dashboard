from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from database import get_db
from models import User, Log, Document
from schemas import DashboardStats, DailyQueryCount
from auth import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics."""
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
