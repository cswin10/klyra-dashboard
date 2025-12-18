from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import LoginRequest, TokenResponse, UserResponse, PasswordChangeRequest, ProfileUpdateRequest
from auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
    CurrentUser
)
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return TokenResponse(
        token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/logout")
async def logout(current_user: CurrentUser = Depends(get_current_user)):
    """Logout current user (token invalidation would be handled client-side)."""
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current authenticated user info."""
    user = db.query(User).filter(User.id == current_user.id).first()
    return UserResponse.model_validate(user)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile."""
    user = db.query(User).filter(User.id == current_user.id).first()

    if request.name:
        user.name = request.name
    if request.email:
        # Check if email is already taken
        existing = db.query(User).filter(
            User.email == request.email,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        user.email = request.email

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password."""
    user = db.query(User).filter(User.id == current_user.id).first()

    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    user.password_hash = get_password_hash(request.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
