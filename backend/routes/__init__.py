from .auth import router as auth_router
from .chats import router as chats_router
from .documents import router as documents_router
from .users import router as users_router
from .system import router as system_router
from .logs import router as logs_router
from .stats import router as stats_router

__all__ = [
    "auth_router",
    "chats_router",
    "documents_router",
    "users_router",
    "system_router",
    "logs_router",
    "stats_router",
]
