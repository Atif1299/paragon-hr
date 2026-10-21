import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import EMPLOYMENT_STATUSES, QCA_FIELDS, TRAIT_QUESTIONS
from app.core.database import get_db
from app.models import BookingInvite, Event, Job, Questionnaire
from app.schemas import BookingIn, QuestionnaireAnswersIn
from app.services import activity, google_sync, intake, pipeline, scheduling

router = APIRouter(prefix="/api/public", tags=["public"])


def _job_public(job: Job) -> dict:
    return {
        "id": job.id,
        "slug": job.slug,
        "title": job.title,
        "area": job.area,
        "description": job.description,
        "min_years": job.min_years,
    }


@router.get("/jobs")
def open_jobs(db: Session = Depends(get_db)):
    return [_job_public(j) for j in db.scalars(select(Job).where(Job.is_open.is_(True)).order_by(Job.title))]


@router.get("/jobs/{slug}")
def job_form(slug: str, db: Session = Depends(get_db)):
    job = db.scalar(select(Job).where(Job.slug == slug, Job.is_open.is_(True)))
    if not job:
        raise HTTPException(404, "This role is not open for applications")
    return {
        "job": _job_public(job),
        "qca_fields": QCA_FIELDS,
        "trait_questions": TRAIT_QUESTIONS,
        "employment_statuses": EMPLOYMENT_STATUSES,
    }


@router.post("/apply", status_code=201)
async def apply(
    background: BackgroundTasks,
    job_slug: str = Form(...),
    payload: str = Form(...),
    cv: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    job = db.scalar(select(Job).where(Job.slug == job_slug, Job.is_open.is_(True)))
    if not job:
        raise HTTPException(404, "This role is not open for applications")
    try:
        data = json.loads(payload)
    except ValueError:
        raise HTTPException(400, "Invalid form data")
    candidate = intake.create_candidate(db, job, data, cv.filename or "cv", await cv.read())
    background.add_task(pipeline.process_candidate, candidate.id)
    return {"ok": True, "reference": f"PGI-{candidate.id:05d}"}


def _invite(db: Session, token: str) -> BookingInvite:
    invite = db.scalar(select(BookingInvite).where(BookingInvite.token == token))
    if not invite or invite.status == "replaced":
        raise HTTPException(404, "This booking link is invalid or has expired")
    return invite


@router.get("/booking/{token}")
def booking_page(token: str, db: Session = Depends(get_db)):
    invite = _invite(db, token)
    candidate = invite.candidate
    booked = next(
        (p.event for p in candidate.participations if p.event.kind == invite.kind and p.status != "cancelled"), None
    )
    return {
        "candidate_name": candidate.full_name,
        "job_title": candidate.job.title,
        "kind": invite.kind,
        "status": invite.status,
        "booked_event": (
            {"title": booked.title, "starts_at": booked.starts_at, "meeting_link": booked.meeting_link,
             "duration_minutes": booked.duration_minutes}
            if booked and invite.status == "booked"
            else None
        ),
        "events": [
            {
                "id": e.id,
                "title": e.title,
                "starts_at": e.starts_at,
                "duration_minutes": e.duration_minutes,
                "seats_left": scheduling.seats_left(e),
            }
            for e in scheduling.available_events(db, candidate, invite.kind)
        ],
    }


@router.post("/booking/{token}")
def book_slot(token: str, body: BookingIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    invite = _invite(db, token)
    if invite.status != "pending":
        raise HTTPException(400, "This invitation has already been used")
    event = db.get(Event, body.event_id)
    if not event or event not in scheduling.available_events(db, invite.candidate, invite.kind):
        raise HTTPException(400, "This slot is no longer available. Please choose another.")
    scheduling.book(db, invite, event)
    db.commit()
    background.add_task(google_sync.run_sync, invite.candidate_id, event.id)
    return {"ok": True, "starts_at": event.starts_at, "meeting_link": event.meeting_link, "title": event.title}


def _questionnaire(db: Session, token: str) -> Questionnaire:
    q = db.scalar(select(Questionnaire).where(Questionnaire.token == token))
    if not q:
        raise HTTPException(404, "This questionnaire link is invalid")
    return q


@router.get("/questionnaire/{token}")
def questionnaire_page(token: str, db: Session = Depends(get_db)):
    q = _questionnaire(db, token)
    return {
        "candidate_name": q.candidate.full_name,
        "job_title": q.candidate.job.title,
        "status": q.status,
        "questions": [{"id": x["id"], "question": x["question"]} for x in q.questions],
    }


@router.post("/questionnaire/{token}")
def submit_questionnaire(
    token: str, body: QuestionnaireAnswersIn, background: BackgroundTasks, db: Session = Depends(get_db)
):
    q = _questionnaire(db, token)
    if q.status != "sent":
        raise HTTPException(400, "This questionnaire has already been submitted")
    ids = {x["id"] for x in q.questions}
    answers = {k: v.strip()[:5000] for k, v in body.answers.items() if k in ids}
    if any(not answers.get(i) for i in ids):
        raise HTTPException(400, "Please answer every question")
    q.answers = answers
    q.status = "submitted"
    q.submitted_at = datetime.now(timezone.utc)
    activity.log(db, q.candidate_id, "Questionnaire submitted", "", actor=q.candidate.full_name)
    db.commit()
    background.add_task(pipeline.process_questionnaire, q.id)
    return {"ok": True}
