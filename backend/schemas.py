from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from models import UserRole, DocumentStatus, DocumentCategory, MessageRole, FeedbackType, AuditAction


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
class DocumentUpload(BaseModel):
    name: str  # User-provided display name
    category: DocumentCategory = DocumentCategory.other
    is_company_wide: bool = False  # True = company doc (admin only), False = personal doc


class DocumentResponse(BaseModel):
    id: str
    name: str
    original_filename: Optional[str] = None
    file_type: str
    file_size: int
    category: DocumentCategory
    status: DocumentStatus
    chunk_count: int
    uploaded_by: str
    uploaded_at: datetime
    owner_id: Optional[str] = None  # NULL = company doc
    is_company_wide: bool = True  # Computed field
    version: int = 1
    parent_id: Optional[str] = None
    is_latest: bool = True

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_company_flag(cls, doc):
        """Create response with computed is_company_wide flag."""
        data = {
            "id": doc.id,
            "name": doc.name,
            "original_filename": doc.original_filename,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "category": doc.category,
            "status": doc.status,
            "chunk_count": doc.chunk_count,
            "uploaded_by": doc.uploaded_by,
            "uploaded_at": doc.uploaded_at,
            "owner_id": doc.owner_id,
            "is_company_wide": doc.owner_id is None,
            "version": doc.version,
            "parent_id": doc.parent_id,
            "is_latest": doc.is_latest,
        }
        return cls(**data)


class DocumentVersionResponse(BaseModel):
    id: str
    name: str
    file_type: str
    file_size: int
    version: int
    uploaded_by: str
    uploaded_at: datetime
    status: DocumentStatus

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


# ============ Feedback Schemas ============
class FeedbackCreate(BaseModel):
    message_id: str
    feedback_type: FeedbackType
    comment: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: str
    message_id: str
    user_id: str
    feedback_type: FeedbackType
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackStats(BaseModel):
    total_positive: int
    total_negative: int
    recent_negative: List["FeedbackResponse"]


# ============ Audit Log Schemas ============
class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str]
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    action: AuditAction
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int
    limit: int
    offset: int


# Update forward refs
TokenResponse.model_rebuild()
FeedbackStats.model_rebuild()
