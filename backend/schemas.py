from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from models import UserRole, DocumentStatus, MessageRole


# ============ Auth Schemas ============
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    user: "UserResponse"


# ============ User Schemas ============
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.user


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    created_at: datetime
    last_active: datetime

    class Config:
        from_attributes = True


# ============ Chat Schemas ============
class ChatCreate(BaseModel):
    title: Optional[str] = None


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: MessageRole
    content: str
    sources: Optional[List[str]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    id: str
    user_id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True


class ChatListResponse(BaseModel):
    id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Document Schemas ============
class DocumentResponse(BaseModel):
    id: str
    name: str
    file_type: str
    file_size: int
    status: DocumentStatus
    chunk_count: int
    uploaded_by: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ============ Log Schemas ============
class LogResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    query: str
    response_time_ms: int
    created_at: datetime

    class Config:
        from_attributes = True


class LogsListResponse(BaseModel):
    logs: List[LogResponse]
    total: int
    limit: int
    offset: int


# ============ System Schemas ============
class SystemStats(BaseModel):
    current_model: str
    gpu_name: Optional[str] = None
    gpu_memory_used: Optional[int] = None
    gpu_memory_total: Optional[int] = None
    storage_used: int
    storage_total: int
    uptime_seconds: int


# ============ Stats Schemas ============
class DailyQueryCount(BaseModel):
    date: str
    count: int


class DashboardStats(BaseModel):
    queries_today: int
    queries_today_change: float
    queries_this_week: int
    queries_this_week_change: float
    active_users: int
    active_users_change: int
    document_count: int
    document_count_change: int
    queries_over_time: List[DailyQueryCount]


# ============ Settings Schemas ============
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


# Update forward refs
TokenResponse.model_rebuild()
