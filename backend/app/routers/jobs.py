import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import any_user, editor
from app.models import Candidate, Job, User
from app.schemas import JobIn, JobOut

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80] or "role"


@router.get("")
def list_jobs(db: Session = Depends(get_db), _: User = Depends(any_user)):
    counts = dict(db.execute(select(Candidate.job_id, func.count()).group_by(Candidate.job_id)).all())
    jobs = db.scalars(select(Job).order_by(Job.is_open.desc(), Job.title)).all()
    return [{**JobOut.model_validate(j).model_dump(), "candidate_count": counts.get(j.id, 0)} for j in jobs]


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db), _: User = Depends(any_user)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Role not found")
    return job


@router.post("", response_model=JobOut, status_code=201)
def create_job(body: JobIn, db: Session = Depends(get_db), _: User = Depends(editor)):
    slug, n = _slugify(body.title), 1
    base = slug
    while db.scalar(select(Job.id).where(Job.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    job = Job(**body.model_dump(exclude={"keywords"}), slug=slug, keywords=[k.model_dump() for k in body.keywords])
    db.add(job)
    db.commit()
    return job


@router.put("/{job_id}", response_model=JobOut)
def update_job(job_id: int, body: JobIn, db: Session = Depends(get_db), _: User = Depends(editor)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Role not found")
    for field, value in body.model_dump(exclude={"keywords"}).items():
        setattr(job, field, value)
    job.keywords = [k.model_dump() for k in body.keywords]
    db.commit()
    return job
