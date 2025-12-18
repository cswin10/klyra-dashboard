import os
import time
import subprocess
import shutil
from fastapi import APIRouter, Depends, HTTPException
from models import User
from schemas import SystemStats
from auth import get_current_admin_user
from config import settings, DATA_DIR
from ollama import get_model_info, check_ollama_status

router = APIRouter(prefix="/api/system", tags=["system"])

# Store start time for uptime calculation
START_TIME = time.time()


def get_disk_usage(path: str) -> tuple:
    """Get disk usage for a path."""
    total, used, free = shutil.disk_usage(path)
    return used, total


def get_gpu_info() -> dict:
    """Get GPU information using nvidia-smi."""
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.used,memory.total",
                "--format=csv,noheader,nounits"
            ],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(", ")
            if len(parts) >= 3:
                return {
                    "name": parts[0],
                    "memory_used": int(float(parts[1])),  # MB
                    "memory_total": int(float(parts[2]))  # MB
                }
    except Exception:
        pass
    return None


@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    current_user: User = Depends(get_current_admin_user)
):
    """Get system statistics (admin only)."""
    # Get model info
    model_info = await get_model_info()
    current_model = model_info.get("name", settings.OLLAMA_MODEL) if model_info else settings.OLLAMA_MODEL

    # Get GPU info
    gpu_info = get_gpu_info()

    # Get storage info
    storage_used, storage_total = get_disk_usage(str(DATA_DIR))

    # Calculate uptime
    uptime_seconds = int(time.time() - START_TIME)

    return SystemStats(
        current_model=current_model,
        gpu_name=gpu_info["name"] if gpu_info else None,
        gpu_memory_used=gpu_info["memory_used"] if gpu_info else None,
        gpu_memory_total=gpu_info["memory_total"] if gpu_info else None,
        storage_used=storage_used,
        storage_total=storage_total,
        uptime_seconds=uptime_seconds
    )


@router.post("/restart-ollama")
async def restart_ollama(
    current_user: User = Depends(get_current_admin_user)
):
    """Restart Ollama service (admin only)."""
    try:
        # Try systemctl restart first
        result = subprocess.run(
            ["systemctl", "restart", "ollama"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return {"message": "Ollama service restarted successfully"}

        # Fallback: try killing and restarting the process
        subprocess.run(["pkill", "-f", "ollama"], timeout=5)
        time.sleep(2)
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        return {"message": "Ollama process restarted"}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to restart Ollama: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Check system health."""
    ollama_status = await check_ollama_status()
    return {
        "status": "healthy" if ollama_status else "degraded",
        "ollama": "running" if ollama_status else "not running"
    }
