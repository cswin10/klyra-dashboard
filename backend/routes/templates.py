from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import PromptTemplate
from auth import get_current_user, get_current_admin_user, CurrentUser

router = APIRouter(prefix="/api/templates", tags=["templates"])


# Pydantic models
class TemplateCreate(BaseModel):
    title: str
    description: Optional[str] = None
    prompt: str
    category: Optional[str] = None
    icon: Optional[str] = None


class TemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    prompt: str
    category: Optional[str]
    icon: Optional[str]
    is_system: bool
    created_by: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


# Default system templates
DEFAULT_TEMPLATES = [
    {
        "title": "Summarize Document",
        "description": "Get a concise summary of a document's key points",
        "prompt": "Please summarize the key points from the documents I have uploaded. Focus on the main takeaways and important details.",
        "category": "summarize",
        "icon": "file-text",
        "is_system": 1
    },
    {
        "title": "Draft Email",
        "description": "Help compose a professional email",
        "prompt": "Help me draft a professional email about the following topic: [describe your topic]. Make it clear and concise.",
        "category": "email",
        "icon": "mail",
        "is_system": 1
    },
    {
        "title": "Explain Policy",
        "description": "Get a clear explanation of company policies",
        "prompt": "Can you explain our company's policy regarding [topic]? Please provide specific details from the uploaded documents.",
        "category": "explain",
        "icon": "help-circle",
        "is_system": 1
    },
    {
        "title": "Compare Documents",
        "description": "Compare information across documents",
        "prompt": "Compare the information about [topic] across the different documents in the knowledge base. Highlight any differences or updates.",
        "category": "analyze",
        "icon": "git-compare",
        "is_system": 1
    },
    {
        "title": "Find Information",
        "description": "Locate specific information in documents",
        "prompt": "Find information about [topic] in the uploaded documents. List all relevant sections and their sources.",
        "category": "search",
        "icon": "search",
        "is_system": 1
    },
    {
        "title": "Create Bullet Points",
        "description": "Convert information into bullet points",
        "prompt": "Convert the information about [topic] into a clear, organized list of bullet points.",
        "category": "format",
        "icon": "list",
        "is_system": 1
    }
]


def ensure_default_templates(db: Session):
    """Create default templates if they don't exist."""
    existing = db.query(PromptTemplate).filter(PromptTemplate.is_system == 1).first()
    if not existing:
        for template_data in DEFAULT_TEMPLATES:
            template = PromptTemplate(**template_data)
            db.add(template)
        db.commit()


@router.get("", response_model=List[TemplateResponse])
async def get_templates(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all prompt templates."""
    # Ensure default templates exist
    ensure_default_templates(db)

    templates = db.query(PromptTemplate).order_by(
        PromptTemplate.is_system.desc(),
        PromptTemplate.created_at.desc()
    ).all()

    return [
        TemplateResponse(
            id=t.id,
            title=t.title,
            description=t.description,
            prompt=t.prompt,
            category=t.category,
            icon=t.icon,
            is_system=bool(t.is_system),
            created_by=t.created_by,
            created_at=t.created_at.isoformat()
        )
        for t in templates
    ]


@router.post("", response_model=TemplateResponse)
async def create_template(
    template: TemplateCreate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new template (admin only)."""
    db_template = PromptTemplate(
        title=template.title,
        description=template.description,
        prompt=template.prompt,
        category=template.category,
        icon=template.icon,
        is_system=0,
        created_by=current_user.id
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    return TemplateResponse(
        id=db_template.id,
        title=db_template.title,
        description=db_template.description,
        prompt=db_template.prompt,
        category=db_template.category,
        icon=db_template.icon,
        is_system=bool(db_template.is_system),
        created_by=db_template.created_by,
        created_at=db_template.created_at.isoformat()
    )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    template: TemplateUpdate,
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a template (admin only, cannot edit system templates)."""
    db_template = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()

    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    if db_template.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit system templates"
        )

    if template.title is not None:
        db_template.title = template.title
    if template.description is not None:
        db_template.description = template.description
    if template.prompt is not None:
        db_template.prompt = template.prompt
    if template.category is not None:
        db_template.category = template.category
    if template.icon is not None:
        db_template.icon = template.icon

    db.commit()
    db.refresh(db_template)

    return TemplateResponse(
        id=db_template.id,
        title=db_template.title,
        description=db_template.description,
        prompt=db_template.prompt,
        category=db_template.category,
        icon=db_template.icon,
        is_system=bool(db_template.is_system),
        created_by=db_template.created_by,
        created_at=db_template.created_at.isoformat()
    )


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: CurrentUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a template (admin only, cannot delete system templates)."""
    db_template = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()

    if not db_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    if db_template.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system templates"
        )

    db.delete(db_template)
    db.commit()

    return {"message": "Template deleted successfully"}
