from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# SQLite requires check_same_thread=False, PostgreSQL doesn't need it
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True  # Verify connections are alive (important for PostgreSQL)
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
