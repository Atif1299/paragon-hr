from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import serializers
from app.constants import Pipeline, Vetting
from app.core.database import get_db
from app.core.deps import any_user
from app.models import ActivityLog, Candidate, Event, Job, Referral, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), _: User = Depends(any_user)):
    by_status = dict(db.execute(select(Candidate.pipeline_status, func.count()).group_by(Candidate.pipeline_status)).all())
    by_vetting = dict(db.execute(select(Candidate.vetting_status, func.count()).group_by(Candidate.vetting_status)).all())
    by_job_rows = db.execute(
        select(Job.id, Job.title, func.count(Candidate.id))
        .join(Candidate, Candidate.job_id == Job.id, isouter=True)
        .where(Job.is_open.is_(True))
        .group_by(Job.id, Job.title)
        .order_by(func.count(Candidate.id).desc())
    ).all()
    total = sum(by_status.values())
    avg_screening = db.scalar(select(func.avg(Candidate.screening_score)))
    referrals = db.scalar(select(func.count()).select_from(Referral).where(Referral.status == "routed")) or 0

    upcoming = db.scalars(
        select(Event)
        .where(Event.starts_at >= datetime.now(timezone.utc), Event.status == "scheduled")
        .order_by(Event.starts_at)
        .limit(5)
    ).all()
    recent = db.scalars(select(ActivityLog).order_by(ActivityLog.id.desc()).limit(15)).all()

    advanced = {
        Pipeline.PRE_SELECTED,
        Pipeline.INTERVIEW_INVITED,
        Pipeline.INTERVIEW_SCHEDULED,
        Pipeline.INTERVIEWED,
        Pipeline.SELECTED,
        Pipeline.ONBOARDING_INVITED,
        Pipeline.ONBOARDING_SCHEDULED,
        Pipeline.ONBOARDING,
        Pipeline.TRIAL,
        Pipeline.CONTRACTED,
    }
    return {
        "total_candidates": total,
        "right_fit": by_vetting.get(Vetting.RIGHT_FIT, 0),
        "not_a_fit": by_vetting.get(Vetting.NOT_A_FIT, 0),
        "pre_selected_or_beyond": sum(v for k, v in by_status.items() if k in advanced),
        "selected": sum(by_status.get(s, 0) for s in (Pipeline.SELECTED, Pipeline.ONBOARDING_INVITED,
                                                       Pipeline.ONBOARDING_SCHEDULED, Pipeline.ONBOARDING,
                                                       Pipeline.TRIAL, Pipeline.CONTRACTED)),
        "referrals": referrals,
        "avg_screening_score": round(avg_screening, 1) if avg_screening is not None else None,
        "funnel": [{"status": s, "count": by_status.get(s, 0)} for s in Pipeline.ORDER],
        "by_job": [{"job_id": r[0], "title": r[1], "count": r[2]} for r in by_job_rows],
        "upcoming_events": [serializers.event(e, with_participants=False) for e in upcoming],
        "recent_activity": [
            {
                "id": a.id,
                "candidate_id": a.candidate_id,
                "candidate_name": a.candidate.full_name if a.candidate else None,
                "actor": a.actor,
                "action": a.action,
                "detail": a.detail,
                "created_at": a.created_at,
            }
            for a in recent
        ],
    }
