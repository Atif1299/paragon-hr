from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.constants import Pipeline
from app.core.config import settings
from app.core.security import new_token
from app.models import BookingInvite, Candidate, Event, EventParticipant
from app.services import activity, notifications

INVITED_STATUS = {"interview": Pipeline.INTERVIEW_INVITED, "onboarding": Pipeline.ONBOARDING_INVITED}
SCHEDULED_STATUS = {"interview": Pipeline.INTERVIEW_SCHEDULED, "onboarding": Pipeline.ONBOARDING_SCHEDULED}


def booking_link(token: str) -> str:
    return f"{settings.PUBLIC_APP_URL.rstrip('/')}/book/{token}"


def create_invite(db: Session, candidate: Candidate, kind: str, actor: str = "System") -> BookingInvite:
    for old in candidate.invites:
        if old.kind == kind and old.status == "pending":
            old.status = "replaced"
    invite = BookingInvite(candidate_id=candidate.id, kind=kind, token=new_token())
    db.add(invite)
    candidate.pipeline_status = INVITED_STATUS[kind]
    notifications.booking_invite(db, candidate, booking_link(invite.token), kind)
    activity.log(db, candidate.id, f"{kind.title()} booking link sent", booking_link(invite.token), actor=actor)
    return invite


def seats_left(event: Event) -> int:
    taken = sum(1 for p in event.participants if p.status != "cancelled")
    return max(event.capacity - taken, 0)


def available_events(db: Session, candidate: Candidate, kind: str) -> list[Event]:
    now = datetime.now(timezone.utc)
    events = db.scalars(
        select(Event)
        .where(Event.kind == kind, Event.status == "scheduled", Event.starts_at > now)
        .where(or_(Event.job_id == candidate.job_id, Event.job_id.is_(None)))
        .order_by(Event.starts_at)
    ).all()
    return [e for e in events if seats_left(e) > 0]


def add_participant(db: Session, event: Event, candidate: Candidate, status: str = "booked") -> EventParticipant:
    existing = next((p for p in event.participants if p.candidate_id == candidate.id), None)
    if existing:
        existing.status = status
        return existing
    participant = EventParticipant(event_id=event.id, candidate_id=candidate.id, status=status)
    db.add(participant)
    event.participants.append(participant)
    return participant


def book(db: Session, invite: BookingInvite, event: Event) -> None:
    candidate = invite.candidate
    add_participant(db, event, candidate)
    invite.status = "booked"
    invite.used_at = datetime.now(timezone.utc)
    candidate.pipeline_status = SCHEDULED_STATUS[invite.kind]
    if invite.kind == "interview":
        candidate.interview_link = event.meeting_link
    else:
        candidate.onboarding_link = event.meeting_link
    notifications.booking_confirmed(db, candidate, event)
    activity.log(
        db,
        candidate.id,
        f"{invite.kind.title()} slot booked",
        f"{event.title} on {event.starts_at.isoformat()}",
        actor=candidate.full_name,
    )
