"""Mirror the system of record into the company's Google Sheets / Shared Drive / Calendar."""

import json
import logging
import mimetypes
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaInMemoryUpload
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import CRITERIA, EVENT_LOG_HEADERS, MASTER_SHEET_HEADERS
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Candidate, Event, Scorecard
from app.services import app_settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
]
FOLDER_MIME = "application/vnd.google-apps.folder"
TAB_RECRUITMENT = "Recruitment Sheet"
TAB_EVENTS = "Recruitment Event Log"
TAB_SCOREBOARD = "Recruitment Evaluation Scoreboard"

_lock = threading.Lock()
state: dict[str, Any] = {"last_sync_at": None, "last_error": ""}


def configured() -> bool:
    return settings.GOOGLE_SYNC_ENABLED and os.path.exists(settings.GOOGLE_SERVICE_ACCOUNT_FILE)


def service_account_email() -> str:
    try:
        with open(settings.GOOGLE_SERVICE_ACCOUNT_FILE, encoding="utf-8") as f:
            return json.load(f).get("client_email", "")
    except (OSError, ValueError):
        return ""


def status() -> dict[str, Any]:
    return {
        "enabled": settings.GOOGLE_SYNC_ENABLED,
        "credentials_found": os.path.exists(settings.GOOGLE_SERVICE_ACCOUNT_FILE),
        "service_account_email": service_account_email(),
        "spreadsheet_url": (
            f"https://docs.google.com/spreadsheets/d/{settings.GOOGLE_SPREADSHEET_ID}"
            if settings.GOOGLE_SPREADSHEET_ID
            else ""
        ),
        "drive_folder_url": (
            f"https://drive.google.com/drive/folders/{settings.GOOGLE_DRIVE_ROOT_FOLDER_ID}"
            if settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
            else ""
        ),
        "calendar_configured": bool(settings.GOOGLE_CALENDAR_ID),
        "last_sync_at": state["last_sync_at"],
        "last_error": state["last_error"],
    }


def _service(name: str, version: str):
    creds = service_account.Credentials.from_service_account_file(settings.GOOGLE_SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build(name, version, credentials=creds, cache_discovery=False)


def _cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    return value


def _write_tab(svc, sid: str, tab: str, rows: list[list[Any]]) -> None:
    svc.spreadsheets().values().clear(spreadsheetId=sid, range=f"'{tab}'!A1:ZZ").execute()
    svc.spreadsheets().values().update(
        spreadsheetId=sid,
        range=f"'{tab}'!A1",
        valueInputOption="RAW",
        body={"values": [[_cell(v) for v in row] for row in rows]},
    ).execute()


def _ensure_tabs(svc, sid: str) -> None:
    meta = svc.spreadsheets().get(spreadsheetId=sid, fields="sheets.properties.title").execute()
    existing = {s["properties"]["title"] for s in meta.get("sheets", [])}
    requests = [
        {"addSheet": {"properties": {"title": t}}}
        for t in (TAB_RECRUITMENT, TAB_EVENTS, TAB_SCOREBOARD)
        if t not in existing
    ]
    if requests:
        svc.spreadsheets().batchUpdate(spreadsheetId=sid, body={"requests": requests}).execute()


def _app_link(candidate_id: int) -> str:
    return f"{settings.PUBLIC_APP_URL.rstrip('/')}/candidates/{candidate_id}"


def sync_sheets(db: Session) -> None:
    sid = settings.GOOGLE_SPREADSHEET_ID
    if not sid:
        return
    cfg = app_settings.get_all(db)
    svc = _service("sheets", "v4")
    _ensure_tabs(svc, sid)

    candidates = db.scalars(select(Candidate).order_by(Candidate.id)).all()
    recruitment = [["Talent Pool 360"], [cfg.get("default_recruiter_name", "")], MASTER_SHEET_HEADERS]
    for i, c in enumerate(candidates, 1):
        recruitment.append(
            [
                i,
                c.created_at.strftime("%Y-%m-%d"),
                c.full_name,
                c.email,
                c.phone,
                c.job.title,
                c.previous_employment,
                c.employment_status,
                f"{c.experience_years:g} years" if c.experience_years is not None else "",
                c.notice_period,
                c.source_platform,
                c.profile_url or c.linkedin_url,
                c.vetting_status,
                c.pipeline_status,
                c.interview_link,
                c.onboarding_link,
                c.drive_folder_url,
                c.notes,
                c.recruiter_name or cfg.get("default_recruiter_name", ""),
            ]
        )
    _write_tab(svc, sid, TAB_RECRUITMENT, recruitment)

    events = db.scalars(select(Event).order_by(Event.starts_at)).all()
    event_rows = [EVENT_LOG_HEADERS]
    n = 0
    for e in events:
        for p in e.participants:
            n += 1
            event_rows.append(
                [
                    n,
                    e.title,
                    e.starts_at,
                    p.status,
                    p.candidate.full_name,
                    p.candidate.job.title,
                    p.candidate.email,
                    p.candidate.phone,
                    p.note,
                    _app_link(p.candidate_id),
                ]
            )
    _write_tab(svc, sid, TAB_EVENTS, event_rows)

    cards = db.scalars(select(Scorecard).order_by(Scorecard.candidate_id, Scorecard.id)).all()
    board = [
        ["Candidate", "Position", "Stage", "Scored By", "Date"]
        + list(CRITERIA.values())
        + ["Norms & Values", "Attitudinal Traits", "Competency", "Total (/15)", "%", "Outcome"]
    ]
    for card in cards:
        board.append(
            [card.candidate.full_name, card.candidate.job.title, card.stage, card.scored_by, card.created_at]
            + [card.scores.get(k, "") for k in CRITERIA]
            + [
                card.norms_total,
                card.attitude_total,
                card.competency_total,
                card.total,
                card.percentage,
                card.outcome,
            ]
        )
    _write_tab(svc, sid, TAB_SCOREBOARD, board)


def _find_or_create_folder(drive, name: str, parent: str) -> dict[str, str]:
    safe = name.replace("\\", "\\\\").replace("'", "\\'")
    found = (
        drive.files()
        .list(
            q=f"name = '{safe}' and '{parent}' in parents and mimeType = '{FOLDER_MIME}' and trashed = false",
            fields="files(id, webViewLink)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora="allDrives",
        )
        .execute()
        .get("files", [])
    )
    if found:
        return found[0]
    return (
        drive.files()
        .create(
            body={"name": name, "mimeType": FOLDER_MIME, "parents": [parent]},
            fields="id, webViewLink",
            supportsAllDrives=True,
        )
        .execute()
    )


def ensure_candidate_folder(candidate: Candidate) -> None:
    root = settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if not root:
        return
    drive = _service("drive", "v3")
    if not candidate.drive_folder_id:
        job_folder = _find_or_create_folder(drive, candidate.job.title, root)
        folder = _find_or_create_folder(drive, f"{candidate.full_name} – #{candidate.id}", job_folder["id"])
        candidate.drive_folder_id = folder["id"]
        candidate.drive_folder_url = folder.get("webViewLink", "")
    if candidate.cv_path and not candidate.cv_drive_url and os.path.exists(candidate.cv_path):
        mime = mimetypes.guess_type(candidate.cv_filename)[0] or "application/octet-stream"
        uploaded = (
            drive.files()
            .create(
                body={"name": candidate.cv_filename, "parents": [candidate.drive_folder_id]},
                media_body=MediaFileUpload(candidate.cv_path, mimetype=mime, resumable=False),
                fields="id, webViewLink",
                supportsAllDrives=True,
            )
            .execute()
        )
        candidate.cv_drive_url = uploaded.get("webViewLink", "")


def upload_text_doc(candidate: Candidate, name: str, text: str) -> str:
    if not configured() or not settings.GOOGLE_DRIVE_ROOT_FOLDER_ID:
        return ""
    ensure_candidate_folder(candidate)
    drive = _service("drive", "v3")
    doc = (
        drive.files()
        .create(
            body={
                "name": name,
                "parents": [candidate.drive_folder_id],
                "mimeType": "application/vnd.google-apps.document",
            },
            media_body=MediaInMemoryUpload(text.encode("utf-8"), mimetype="text/plain", resumable=False),
            fields="id, webViewLink",
            supportsAllDrives=True,
        )
        .execute()
    )
    return doc.get("webViewLink", "")


def upsert_calendar_event(event: Event) -> None:
    if not settings.GOOGLE_CALENDAR_ID:
        return
    calendar = _service("calendar", "v3")
    names = [f"- {p.candidate.full_name} ({p.candidate.email})" for p in event.participants if p.status != "cancelled"]
    body = {
        "summary": event.title,
        "location": event.meeting_link,
        "description": "\n".join(
            [event.notes or "", f"Meeting link: {event.meeting_link}", "", "Participants:", *names]
        ).strip(),
        "start": {"dateTime": event.starts_at.isoformat()},
        "end": {"dateTime": (event.starts_at + timedelta(minutes=event.duration_minutes)).isoformat()},
    }
    events_api = calendar.events()
    if event.calendar_event_id:
        events_api.patch(calendarId=settings.GOOGLE_CALENDAR_ID, eventId=event.calendar_event_id, body=body).execute()
    else:
        created = events_api.insert(calendarId=settings.GOOGLE_CALENDAR_ID, body=body).execute()
        event.calendar_event_id = created.get("id", "")


def run_sync(candidate_id: int | None = None, event_id: int | None = None) -> None:
    """Background job: push current state to Google. Safe to call often."""
    if not configured():
        return
    with _lock:
        db = SessionLocal()
        candidate = db.get(Candidate, candidate_id) if candidate_id else None
        try:
            if candidate:
                ensure_candidate_folder(candidate)
                candidate.sync_error = ""
            if event_id:
                event = db.get(Event, event_id)
                if event:
                    upsert_calendar_event(event)
            db.commit()
            sync_sheets(db)
            state["last_sync_at"] = datetime.now(timezone.utc).isoformat()
            state["last_error"] = ""
        except Exception as exc:
            logger.exception("Google sync failed")
            db.rollback()
            state["last_error"] = str(exc)
            if candidate_id:
                c = db.get(Candidate, candidate_id)
                if c:
                    c.sync_error = str(exc)[:2000]
                    db.commit()
        finally:
            db.close()
