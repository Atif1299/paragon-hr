import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import EMPLOYMENT_STATUSES, QCA_FIELDS, TRAIT_QUESTIONS
from app.core.config import settings
from app.models import Candidate, Job
from app.services import activity, app_settings, notifications
from app.services import object_storage
from app.services.documents import ALLOWED_CV_EXTENSIONS, extract_text

TEXT_FIELDS = [
    "phone",
    "previous_employment",
    "notice_period",
    "source_platform",
    "profile_url",
    "linkedin_url",
    "upwork_url",
    "has_vpn",
]


def _to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        match = re.search(r"\d+(\.\d+)?", str(value))
        return float(match.group()) if match else None


def save_cv(filename: str, data: bytes) -> tuple[str, str]:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_CV_EXTENSIONS:
        raise HTTPException(400, "CV must be a PDF, DOCX or TXT file.")
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"CV must be smaller than {settings.MAX_UPLOAD_MB} MB.")
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)[:120]
    stored_name = f"{uuid.uuid4().hex}_{safe}"
    text = extract_text(filename, data)
    if object_storage.enabled():
        return object_storage.upload(stored_name, data), text
    folder = Path(settings.UPLOAD_DIR) / "cv"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / stored_name
    path.write_bytes(data)
    return str(path), text


def create_candidate(
    db: Session,
    job: Job,
    data: dict[str, Any],
    cv_filename: str = "",
    cv_bytes: bytes | None = None,
    cv_text: str = "",
    actor: str = "Candidate",
) -> Candidate:
    email = str(data.get("email", "")).strip().lower()
    full_name = str(data.get("full_name", "")).strip()
    if not email or not full_name:
        raise HTTPException(400, "Full name and email are required.")
    duplicate = db.scalar(
        select(Candidate.id).where(func.lower(Candidate.email) == email, Candidate.job_id == job.id)
    )
    if duplicate:
        raise HTTPException(409, "An application with this email already exists for this role.")

    cv_path = ""
    if cv_bytes:
        cv_path, cv_text = save_cv(cv_filename, cv_bytes)

    qca_keys = {f["key"] for f in QCA_FIELDS}
    trait_keys = {q["key"] for q in TRAIT_QUESTIONS}
    employment = str(data.get("employment_status", "")).strip()
    candidate = Candidate(
        full_name=full_name,
        email=email,
        job_id=job.id,
        employment_status=employment if employment in EMPLOYMENT_STATUSES else ("Other" if employment else ""),
        experience_years=_to_float(data.get("experience_years")),
        qca={k: v for k, v in (data.get("qca") or {}).items() if k in qca_keys and v not in (None, "")},
        trait_answers={k: str(v).strip() for k, v in (data.get("trait_answers") or {}).items() if k in trait_keys},
        cv_filename=Path(cv_filename).name if cv_filename else "",
        cv_path=cv_path,
        cv_text=cv_text or "",
        recruiter_name=app_settings.get_all(db).get("default_recruiter_name", ""),
        processing_state="queued",
        **{f: str(data.get(f) or "").strip() for f in TEXT_FIELDS},
    )
    candidate.job = job
    db.add(candidate)
    db.flush()
    activity.log(db, candidate.id, "Application received", f"{job.title} via {candidate.source_platform or 'form'}", actor)
    notifications.application_received(db, candidate)
    db.commit()
    return candidate
