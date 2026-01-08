import httpx
import json
from typing import AsyncGenerator, Optional, List
from config import settings


async def generate_text(
    prompt: str,
    model: str = None,
    stream: bool = True,
    temperature: float = 0.7,
    num_ctx: int = 16384
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
                    data = json.loads(line)
                    if "response" in data:
                        yield data["response"]
                    if data.get("done", False):
                        break


async def chat_generate(
    messages: List[dict],
    system_prompt: str = None,
    model: str = None,
    stream: bool = True,
    temperature: float = 0.7,
    num_ctx: int = 16384
) -> AsyncGenerator[str, None]:
    """
    Generate text using Ollama Chat API with proper conversation format.

    Args:
        messages: List of {"role": "user"|"assistant", "content": "..."} dicts
        system_prompt: Optional system message to prepend
        model: Model to use (defaults to settings.OLLAMA_MODEL)
        stream: Whether to stream the response
        temperature: Sampling temperature
        num_ctx: Context window size
    """
    model = model or settings.OLLAMA_MODEL
    url = f"{settings.OLLAMA_BASE_URL}/api/chat"

    # Build messages array with optional system prompt
    chat_messages = []
    if system_prompt:
        chat_messages.append({"role": "system", "content": system_prompt})

    # Add conversation messages
    for msg in messages:
        chat_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    payload = {
        "model": model,
        "messages": chat_messages,
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
                    data = json.loads(line)
                    if "message" in data and "content" in data["message"]:
                        yield data["message"]["content"]
                    if data.get("done", False):
                        break


async def generate_text_sync(
    prompt: str,
    model: str = None,
    temperature: float = 0.7,
    num_ctx: int = 16384
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

    # Try newer /api/embed endpoint first (Ollama 0.1.14+)
    url = f"{settings.OLLAMA_BASE_URL}/api/embed"
    payload = {
        "model": model,
        "input": text
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            # New API returns "embeddings" array
            embeddings = data.get("embeddings", [])
            if embeddings and len(embeddings) > 0:
                return embeddings[0]
            return []
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                # Fallback to older /api/embeddings endpoint
                url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
                payload = {
                    "model": model,
                    "prompt": text
                }
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("embedding", [])
            raise


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
