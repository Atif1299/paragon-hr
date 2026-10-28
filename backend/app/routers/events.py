from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import serializers
from app.constants import Pipeline
from app.core.database import get_db
from app.core.deps import any_user, editor
from app.models import Candidate, Event, EventParticipant, Job, User
from app.schemas import EventIn, EventUpdate, ParticipantIn, ParticipantUpdate
from app.services import activity, google_sync, notifications, scheduling

router = APIRouter(prefix="/api/events", tags=["events"])


def _get(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return event


@router.get("")
def list_events(kind: str = "", upcoming: bool = False, db: Session = Depends(get_db), _: User = Depends(any_user)):
    stmt = select(Event).order_by(Event.starts_at.desc())
    if kind:
        stmt = stmt.where(Event.kind == kind)
    if upcoming:
        stmt = stmt.where(Event.starts_at >= datetime.now(timezone.utc), Event.status == "scheduled")
    return [serializers.event(e) for e in db.scalars(stmt).all()]


@router.get("/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db), _: User = Depends(any_user)):
    return serializers.event(_get(db, event_id))


@router.post("", status_code=201)
def create_event(body: EventIn, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(editor)):
    if body.job_id and not db.get(Job, body.job_id):
        raise HTTPException(404, "Role not found")
    event = Event(**body.model_dump(), created_by=user.name)
    db.add(event)
    db.commit()
    background.add_task(google_sync.run_sync, None, event.id)
    return serializers.event(event)


@router.patch("/{event_id}")
def update_event(
    event_id: int, body: EventUpdate, background: BackgroundTasks, db: Session = Depends(get_db), _: User = Depends(editor)
):
    event = _get(db, event_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    background.add_task(google_sync.run_sync, None, event.id)
    return serializers.event(event)


@router.delete("/{event_id}")
def delete_event(event_id: int, background: BackgroundTasks, db: Session = Depends(get_db), _: User = Depends(editor)):
    event = _get(db, event_id)
    if any(p.status != "cancelled" for p in event.participants):
        raise HTTPException(400, "Cancel the event instead – candidates are booked on it")
    db.delete(event)
    db.commit()
    background.add_task(google_sync.run_sync)
    return {"ok": True}


@router.post("/{event_id}/participants", status_code=201)
def add_participant(
    event_id: int, body: ParticipantIn, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(editor)
):
    event = _get(db, event_id)
    candidate = db.get(Candidate, body.candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    if scheduling.seats_left(event) <= 0:
        raise HTTPException(400, "This event is full")
    scheduling.add_participant(db, event, candidate)
    if event.kind == "interview":
        candidate.pipeline_status = Pipeline.INTERVIEW_SCHEDULED
        candidate.interview_link = event.meeting_link
    else:
        candidate.pipeline_status = Pipeline.ONBOARDING_SCHEDULED
        candidate.onboarding_link = event.meeting_link
    notifications.booking_confirmed(db, candidate, event)
    activity.log(db, candidate.id, "Added to event", event.title, user.name)
    db.commit()
    background.add_task(google_sync.run_sync, candidate.id, event.id)
    return serializers.event(event)


@router.patch("/{event_id}/participants/{participant_id}")
def update_participant(
    event_id: int,
    participant_id: int,
    body: ParticipantUpdate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(editor),
):
    participant = db.get(EventParticipant, participant_id)
    if not participant or participant.event_id != event_id:
        raise HTTPException(404, "Participant not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(participant, field, value)
    if "status" in changes:
        activity.log(db, participant.candidate_id, "Event attendance updated", f"{participant.event.title}: {body.status}", user.name)
    db.commit()
    background.add_task(google_sync.run_sync, participant.candidate_id, event_id)
    return serializers.event(participant.event)
