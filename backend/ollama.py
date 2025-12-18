import httpx
from typing import AsyncGenerator, Optional, List
from config import settings


async def generate_text(
    prompt: str,
    model: str = None,
    stream: bool = True,
    temperature: float = 0.7,
    num_ctx: int = 4096
) -> AsyncGenerator[str, None]:
    """Generate text using Ollama API with streaming."""
    model = model or settings.OLLAMA_MODEL
    url = f"{settings.OLLAMA_BASE_URL}/api/generate"

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": stream,
        "options": {
            "temperature": temperature,
            "num_ctx": num_ctx
        }
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    import json
                    data = json.loads(line)
                    if "response" in data:
                        yield data["response"]
                    if data.get("done", False):
                        break


async def generate_text_sync(
    prompt: str,
    model: str = None,
    temperature: float = 0.7,
    num_ctx: int = 4096
) -> str:
    """Generate text without streaming."""
    model = model or settings.OLLAMA_MODEL
    url = f"{settings.OLLAMA_BASE_URL}/api/generate"

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_ctx": num_ctx
        }
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")


async def generate_embedding(text: str, model: str = None) -> List[float]:
    """Generate embeddings for text using Ollama API."""
    model = model or settings.OLLAMA_EMBED_MODEL
    url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"

    payload = {
        "model": model,
        "prompt": text
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("embedding", [])


async def list_models() -> List[dict]:
    """List available models in Ollama."""
    url = f"{settings.OLLAMA_BASE_URL}/api/tags"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        return data.get("models", [])


async def get_model_info(model: str = None) -> Optional[dict]:
    """Get information about a specific model."""
    model = model or settings.OLLAMA_MODEL
    models = await list_models()
    for m in models:
        if m.get("name", "").startswith(model):
            return m
    return None


async def check_ollama_status() -> bool:
    """Check if Ollama is running and accessible."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            return response.status_code == 200
    except Exception:
        return False
