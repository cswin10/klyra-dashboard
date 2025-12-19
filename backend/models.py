import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class DocumentStatus(str, enum.Enum):
    processing = "processing"
    ready = "ready"
    error = "error"


class DocumentCategory(str, enum.Enum):
    company_info = "company_info"       # Company ethos, values, mission
    team = "team"                       # Employees, roles, org structure
    templates = "templates"             # Email templates, formats, tone guides
    policies = "policies"               # HR policies, procedures, guidelines
    products = "products"               # Product info, specs, documentation
    general = "general"                 # General/uncategorized documents


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class FeedbackType(str, enum.Enum):
    positive = "positive"  # thumbs up
    negative = "negative"  # thumbs down


class AuditAction(str, enum.Enum):
    user_created = "user_created"
    user_deleted = "user_deleted"
    user_role_changed = "user_role_changed"
    document_uploaded = "document_uploaded"
    document_deleted = "document_deleted"
    settings_changed = "settings_changed"
    login = "login"
    logout = "logout"


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_active = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="uploaded_by_user", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="user", cascade="all, delete-orphan")


class Chat(Base):
    __tablename__ = "chats"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    chat_id = Column(String(36), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)  # Array of document names
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    chat = relationship("Chat", back_populates="messages")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes
    category = Column(Enum(DocumentCategory), default=DocumentCategory.general, nullable=False)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.processing, nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    uploaded_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    file_path = Column(String(500), nullable=True)

    # Relationships
    uploaded_by_user = relationship("User", back_populates="documents")


class Log(Base):
    __tablename__ = "logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    response_time_ms = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="logs")


class Feedback(Base):
    """Stores user feedback (thumbs up/down) on AI responses."""
    __tablename__ = "feedback"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    feedback_type = Column(Enum(FeedbackType), nullable=False)
    comment = Column(Text, nullable=True)  # Optional comment for negative feedback
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    message = relationship("Message")
    user = relationship("User")


class AuditLog(Base):
    """Stores audit trail of admin actions."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(Enum(AuditAction), nullable=False)
    target_type = Column(String(50), nullable=True)  # e.g., "user", "document"
    target_id = Column(String(36), nullable=True)
    details = Column(JSON, nullable=True)  # Additional context
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User")


class PromptTemplate(Base):
    """Pre-defined prompt templates for common tasks."""
    __tablename__ = "prompt_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prompt = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)  # e.g., "summarize", "email", "analyze"
    icon = Column(String(50), nullable=True)  # Icon name for frontend
    is_system = Column(Integer, default=0)  # 1 = system template (not deletable)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User")
