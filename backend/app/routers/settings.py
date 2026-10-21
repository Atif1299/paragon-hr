from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import admin_only, any_user, editor
from app.models import EmailMessage, User
from app.services import app_settings, claude, google_sync, notifications

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _: User = Depends(any_user)):
    return {
        "values": app_settings.get_all(db),
        "integrations": {
            "claude": {"enabled": claude.enabled(), "model": settings.CLAUDE_MODEL},
            "google": google_sync.status(),
            "email": {"smtp_enabled": notifications.smtp_enabled(), "from": settings.SMTP_FROM},
            "webhook": {"enabled": bool(settings.WEBHOOK_SECRET), "path": "/api/webhooks/intake"},
            "public_app_url": settings.PUBLIC_APP_URL,
        },
    }


@router.put("/settings")
def update_settings(body: dict[str, Any], db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return {"values": app_settings.update(db, body)}


@router.post("/settings/sync")
def sync_now(background: BackgroundTasks, _: User = Depends(admin_only)):
    background.add_task(google_sync.run_sync)
    return {"ok": True}


@router.get("/outbox")
def outbox(db: Session = Depends(get_db), _: User = Depends(editor)):
    rows = db.scalars(select(EmailMessage).order_by(EmailMessage.id.desc()).limit(200)).all()
    return [
        {
            "id": m.id,
            "candidate_id": m.candidate_id,
            "to_email": m.to_email,
            "subject": m.subject,
            "body": m.body,
            "status": m.status,
            "error": m.error,
            "created_at": m.created_at,
        }
        for m in rows
    ]
