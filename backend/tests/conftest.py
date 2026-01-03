"""
Pytest fixtures for Klyra backend tests.
"""
import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before importing app modules
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"

from database import Base, get_db
from main import app
from models import User, UserRole
from auth import get_password_hash, create_access_token


# Create test engine with in-memory SQLite
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db() -> Generator:
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db) -> Generator:
    """Create a test client with database override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db) -> User:
    """Create a test user."""
    # Use a pre-computed hash to avoid bcrypt version issues
    # This is the hash of "testpass123"
    user = User(
        email="test@example.com",
        name="Test User",
        password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4U8VHC4LgMKt.S2G",
        role=UserRole.user
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_admin(db) -> User:
    """Create a test admin user."""
    # Use a pre-computed hash to avoid bcrypt version issues
    admin = User(
        email="admin@example.com",
        name="Test Admin",
        password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4U8VHC4LgMKt.S2G",
        role=UserRole.admin
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def user_token(test_user) -> str:
    """Create a JWT token for the test user."""
    return create_access_token(data={"sub": test_user.id})


@pytest.fixture
def admin_token(test_admin) -> str:
    """Create a JWT token for the test admin."""
    return create_access_token(data={"sub": test_admin.id})


@pytest.fixture
def auth_headers(user_token) -> dict:
    """Return authorization headers for regular user."""
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def admin_headers(admin_token) -> dict:
    """Return authorization headers for admin user."""
    return {"Authorization": f"Bearer {admin_token}"}
