from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables.

    For development: Creates all tables directly from models.
    For production: Use Alembic migrations instead:
        alembic upgrade head
    """
    from models import User, Chat, Message, Document, Log, Feedback, AuditLog, PromptTemplate
    Base.metadata.create_all(bind=engine)
