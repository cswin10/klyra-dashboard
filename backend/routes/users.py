import csv
import io
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserRole
from schemas import UserCreate, UserUpdate, UserResponse
from auth import get_current_admin_user, get_password_hash, CurrentUser

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
async def get_users(
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all users (admin only)."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserResponse.model_validate(user) for user in users]


@router.post("", response_model=UserResponse)
async def create_user(
    request: UserCreate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)."""
    # Check if email already exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user = User(
        email=request.email,
        name=request.name,
        password_hash=get_password_hash(request.password),
        role=request.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    request: UserUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if request.email and request.email != user.email:
        # Check if email already exists
        existing = db.query(User).filter(
            User.email == request.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        user.email = request.email

    if request.name:
        user.name = request.name

    if request.role:
        user.role = request.role

    if request.password:
        user.password_hash = get_password_hash(request.password)

    db.commit()
    db.refresh(user)

    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}


@router.post("/bulk-import")
async def bulk_import_users(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Bulk import users from CSV file (admin only).
    CSV format: name,email,password,role (role is optional, defaults to 'user')
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )

    content = await file.read()
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        text_content = content.decode('latin-1')

    reader = csv.DictReader(io.StringIO(text_content))

    results = {
        "created": [],
        "skipped": [],
        "errors": []
    }

    for row_num, row in enumerate(reader, start=2):  # start at 2 (header is row 1)
        try:
            # Normalize column names (handle case variations)
            row_normalized = {k.lower().strip(): v.strip() for k, v in row.items() if k}

            name = row_normalized.get('name', '')
            email = row_normalized.get('email', '')
            password = row_normalized.get('password', '')
            role_str = row_normalized.get('role', 'user').lower()

            if not name or not email or not password:
                results["errors"].append({
                    "row": row_num,
                    "email": email or "N/A",
                    "error": "Missing required fields (name, email, password)"
                })
                continue

            # Check if email already exists
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                results["skipped"].append({
                    "row": row_num,
                    "email": email,
                    "reason": "Email already exists"
                })
                continue

            # Parse role
            role = UserRole.admin if role_str == 'admin' else UserRole.user

            # Create user
            user = User(
                email=email,
                name=name,
                password_hash=get_password_hash(password),
                role=role
            )
            db.add(user)
            results["created"].append({
                "row": row_num,
                "email": email,
                "name": name,
                "role": role.value
            })

        except Exception as e:
            results["errors"].append({
                "row": row_num,
                "email": row.get('email', 'N/A'),
                "error": str(e)
            })

    db.commit()

    return {
        "success": True,
        "summary": {
            "total_processed": len(results["created"]) + len(results["skipped"]) + len(results["errors"]),
            "created": len(results["created"]),
            "skipped": len(results["skipped"]),
            "errors": len(results["errors"])
        },
        "details": results
    }
