import hmac
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Job
from app.services import intake, pipeline

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/intake", status_code=201)
def intake_webhook(
    body: dict[str, Any],
    background: BackgroundTasks,
    x_webhook_secret: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """Capture applications from external forms (Google Forms, LinkedIn exports, job boards)."""
    if not settings.WEBHOOK_SECRET or not hmac.compare_digest(x_webhook_secret, settings.WEBHOOK_SECRET):
        raise HTTPException(401, "Invalid webhook secret")
    job = db.scalar(select(Job).where(Job.slug == body.get("job_slug", "")))
    if not job:
        raise HTTPException(404, "Unknown job_slug")

    cv_bytes, cv_name = None, ""
    cv_url = body.get("cv_url")
    if cv_url:
        try:
            response = httpx.get(cv_url, timeout=30, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(400, f"Could not download CV: {exc}")
        cv_bytes = response.content
        cv_name = body.get("cv_filename") or Path(httpx.URL(cv_url).path).name or "cv.pdf"

    body.setdefault("source_platform", "Webhook")
    candidate = intake.create_candidate(
        db, job, body, cv_name, cv_bytes, str(body.get("cv_text", "")), actor=body["source_platform"]
    )
    background.add_task(pipeline.process_candidate, candidate.id)
    return {"id": candidate.id}
