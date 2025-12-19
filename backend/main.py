from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routes import (
    auth_router,
    chats_router,
    documents_router,
    users_router,
    system_router,
    logs_router,
    stats_router,
    feedback_router,
    audit_router,
    templates_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("Initializing database...")
    init_db()
    print("Database initialized.")
    yield
    # Shutdown
    print("Shutting down...")


app = FastAPI(
    title="Klyra Dashboard API",
    description="Private AI Assistant Interface API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(chats_router)
app.include_router(documents_router)
app.include_router(users_router)
app.include_router(system_router)
app.include_router(logs_router)
app.include_router(stats_router)
app.include_router(feedback_router)
app.include_router(audit_router)
app.include_router(templates_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Klyra Dashboard API", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
