"""Private CV storage on Supabase Storage. The service role key stays on the server."""

import logging
import mimetypes

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

PREFIX = "sb://"


def enabled() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)


def _headers(content_type: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _base() -> str:
    return settings.SUPABASE_URL.rstrip("/") + "/storage/v1"


def ensure_bucket() -> None:
    if not enabled():
        return
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"{_base()}/bucket",
            headers={**_headers(), "Content-Type": "application/json"},
            json={"id": settings.SUPABASE_BUCKET, "name": settings.SUPABASE_BUCKET, "public": False},
        )
    if response.status_code in (200, 201) or "already exists" in response.text.lower():
        return
    logger.warning("Could not create storage bucket: %s %s", response.status_code, response.text[:300])


def upload(name: str, data: bytes) -> str:
    mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
    url = f"{_base()}/object/{settings.SUPABASE_BUCKET}/{name}"
    response = httpx.post(url, headers={**_headers(mime), "x-upsert": "true"}, content=data, timeout=60)
    response.raise_for_status()
    return f"{PREFIX}{name}"


def download(stored: str) -> bytes:
    name = stored.removeprefix(PREFIX)
    url = f"{_base()}/object/{settings.SUPABASE_BUCKET}/{name}"
    response = httpx.get(url, headers=_headers(), timeout=60)
    response.raise_for_status()
    return response.content


def remove(stored: str) -> None:
    name = stored.removeprefix(PREFIX)
    url = f"{_base()}/object/{settings.SUPABASE_BUCKET}/{name}"
    httpx.delete(url, headers=_headers(), timeout=30)


def is_remote(path: str) -> bool:
    return path.startswith(PREFIX)
