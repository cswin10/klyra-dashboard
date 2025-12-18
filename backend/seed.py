#!/usr/bin/env python3
"""
Seed script to create the default admin user.
Run this after installing the backend dependencies.
"""

from database import init_db, SessionLocal
from models import User, UserRole
from auth import get_password_hash

DEFAULT_ADMIN = {
    "email": "admin@klyra.io",
    "name": "Administrator",
    "password": "admin123",
    "role": UserRole.admin
}


def seed_admin():
    """Create default admin user if it doesn't exist."""
    # Initialize database tables
    init_db()

    db = SessionLocal()
    try:
        # Check if admin already exists
        existing = db.query(User).filter(User.email == DEFAULT_ADMIN["email"]).first()
        if existing:
            print(f"Admin user already exists: {DEFAULT_ADMIN['email']}")
            return

        # Create admin user
        admin = User(
            email=DEFAULT_ADMIN["email"],
            name=DEFAULT_ADMIN["name"],
            password_hash=get_password_hash(DEFAULT_ADMIN["password"]),
            role=DEFAULT_ADMIN["role"]
        )
        db.add(admin)
        db.commit()

        print(f"Created default admin user:")
        print(f"  Email: {DEFAULT_ADMIN['email']}")
        print(f"  Password: {DEFAULT_ADMIN['password']}")
        print(f"\n  Please change the password after first login!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
