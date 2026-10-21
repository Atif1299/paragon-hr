import json
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import serializers
from app.constants import CRITERIA, Pipeline, Vetting
from app.core.database import get_db
from app.core.deps import admin_only, any_user, editor
from app.models import Candidate, Job, Referral, Transcript, User
from app.schemas import CandidateUpdate, DecisionIn, InviteIn, ScorecardIn
from app.services import (
    activity,
    app_settings,
    google_sync,
    intake,
    pipeline,
    questionnaires,
    referrals,
    scheduling,
    scoring,
)
from app.services import object_storage
from app.services.documents import ALLOWED_TRANSCRIPT_EXTENSIONS, extract_text

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


def _get(db: Session, candidate_id: int) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    return candidate


@router.get("")
def list_candidates(
    q: str = "",
    job_id: int | None = None,
    status: str = "",
    vetting: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(any_user),
):
    stmt = select(Candidate).order_by(Candidate.id.desc())
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Candidate.full_name.ilike(like), Candidate.email.ilike(like), Candidate.phone.ilike(like)))
    if job_id:
        stmt = stmt.where(Candidate.job_id == job_id)
    if status:
        stmt = stmt.where(Candidate.pipeline_status == status)
    if vetting:
        stmt = stmt.where(Candidate.vetting_status == vetting)
    return [serializers.candidate_summary(c) for c in db.scalars(stmt).all()]


@router.get("/meta")
def meta(_: User = Depends(any_user)):
    return {
        "pipeline_statuses": Pipeline.ORDER,
        "vetting_statuses": [Vetting.RIGHT_FIT, Vetting.NOT_A_FIT],
        "criteria": CRITERIA,
    }


@router.post("", status_code=201)
async def add_candidate(
    background: BackgroundTasks,
    job_id: int = Form(...),
    payload: str = Form(...),
    cv: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(editor),
):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Role not found")
    try:
        data = json.loads(payload)
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    cv_bytes = await cv.read() if cv else None
    candidate = intake.create_candidate(
        db, job, data, cv.filename if cv else "", cv_bytes, data.get("cv_text", ""), actor=user.name
    )
    background.add_task(pipeline.process_candidate, candidate.id)
    return {"id": candidate.id}


@router.get("/{candidate_id}")
def get_candidate(candidate_id: int, db: Session = Depends(get_db), _: User = Depends(any_user)):
    return serializers.candidate_detail(_get(db, candidate_id))


@router.patch("/{candidate_id}")
def update_candidate(
    candidate_id: int,
    body: CandidateUpdate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(editor),
):
    candidate = _get(db, candidate_id)
    changes = body.model_dump(exclude_unset=True)
    if "pipeline_status" in changes and changes["pipeline_status"] not in Pipeline.ORDER:
        raise HTTPException(400, "Unknown pipeline status")
    for field, value in changes.items():
        old = getattr(candidate, field)
        if old != value:
            setattr(candidate, field, value)
            if field in {"pipeline_status", "vetting_status"}:
                activity.log(db, candidate.id, f"{field.replace('_', ' ').title()} changed", f"{old} → {value}", user.name)
    if changes:
        activity.log(db, candidate.id, "Profile updated", ", ".join(changes.keys()), user.name)
    db.commit()
    background.add_task(google_sync.run_sync, candidate.id)
    return serializers.candidate_detail(candidate)


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    candidate = _get(db, candidate_id)
    if candidate.cv_path and object_storage.is_remote(candidate.cv_path):
        object_storage.remove(candidate.cv_path)
    elif candidate.cv_path and os.path.exists(candidate.cv_path):
        os.remove(candidate.cv_path)
    db.delete(candidate)
    db.commit()
    return {"ok": True}


@router.get("/{candidate_id}/cv")
def download_cv(candidate_id: int, db: Session = Depends(get_db), _: User = Depends(any_user)):
    candidate = _get(db, candidate_id)
    filename = candidate.cv_filename or "cv"
    if candidate.cv_path and object_storage.is_remote(candidate.cv_path):
        data = object_storage.download(candidate.cv_path)
        return Response(
            content=data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    if not candidate.cv_path or not os.path.exists(candidate.cv_path):
        raise HTTPException(404, "No CV file on record")
    return FileResponse(candidate.cv_path, filename=filename)


@router.post("/{candidate_id}/reprocess")
def reprocess(candidate_id: int, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(editor)):
    candidate = _get(db, candidate_id)
    candidate.processing_state = "queued"
    candidate.pipeline_status = Pipeline.APPLIED
    activity.log(db, candidate.id, "Re-run screening requested", "", user.name)
    db.commit()
    background.add_task(pipeline.process_candidate, candidate.id)
    return {"ok": True}


@router.post("/{candidate_id}/scorecards")
def add_scorecard(
    candidate_id: int,
    body: ScorecardIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(editor),
):
    candidate = _get(db, candidate_id)
    unknown = set(body.scores) - set(CRITERIA)
    if unknown:
        raise HTTPException(400, f"Unknown criteria: {', '.join(sorted(unknown))}")
    cfg = app_settings.get_all(db)
    scores, _ = scoring.parse_scores(body.scores)
    card = scoring.save(db, candidate, body.stage, scores, body.rationale, body.summary, user.name, cfg)
    if body.apply_outcome:
        candidate.preselection_outcome = card.outcome
        if card.outcome == "pass":
            pipeline.on_pass(db, candidate, cfg, actor=user.name)
        elif card.outcome == "borderline":
            questionnaires.create(db, candidate, card)
        elif pipeline.on_fail(db, candidate, cfg, f"Failed manual scorecard ({card.percentage}%)", actor=user.name):
            db.commit()
            background.add_task(pipeline.process_candidate, candidate.id)
            return serializers.scorecard(card)
    db.commit()
    background.add_task(google_sync.run_sync, candidate.id)
    return serializers.scorecard(card)


@router.post("/{candidate_id}/invite")
def send_invite(
    candidate_id: int, body: InviteIn, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(editor)
):
    candidate = _get(db, candidate_id)
    invite = scheduling.create_invite(db, candidate, body.kind, actor=user.name)
    db.commit()
    background.add_task(google_sync.run_sync, candidate.id)
    return {"link": scheduling.booking_link(invite.token)}


@router.post("/{candidate_id}/questionnaire")
def send_questionnaire(
    candidate_id: int, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(editor)
):
    candidate = _get(db, candidate_id)
    card = serializers.latest_card(candidate)
    if not card:
        raise HTTPException(400, "Score the candidate first so the questionnaire can target weak criteria")
    q = questionnaires.create(db, candidate, card)
    activity.log(db, candidate.id, "Questionnaire sent manually", "", user.name)
    db.commit()
    background.add_task(google_sync.run_sync, candidate.id)
    return {"link": questionnaires.link(q.token)}


@router.post("/{candidate_id}/decision")
def decision(
    candidate_id: int, body: DecisionIn, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(editor)
):
    candidate = _get(db, candidate_id)
    rerun = pipeline.decide(db, candidate, body.decision, user.name)
    db.commit()
    if rerun:
        background.add_task(pipeline.process_candidate, candidate.id)
    else:
        background.add_task(google_sync.run_sync, candidate.id)
    return {"rerouted": rerun, "pipeline_status": candidate.pipeline_status, "job_title": candidate.job.title}


@router.post("/{candidate_id}/referrals/{referral_id}/accept")
def accept_referral(
    candidate_id: int, referral_id: int, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(editor)
):
    candidate = _get(db, candidate_id)
    referral = db.get(Referral, referral_id)
    if not referral or referral.candidate_id != candidate.id or referral.status != "suggested" or not referral.to_job:
        raise HTTPException(400, "This referral cannot be accepted")
    referral.status = "routed"
    referrals.route(db, candidate, referral.to_job, actor=user.name)
    db.commit()
    background.add_task(pipeline.process_candidate, candidate.id)
    return {"ok": True}


@router.post("/{candidate_id}/transcripts", status_code=201)
async def add_transcript(
    candidate_id: int,
    background: BackgroundTasks,
    kind: str = Form(...),
    text: str = Form(""),
    recording_url: str = Form(""),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(editor),
):
    candidate = _get(db, candidate_id)
    if kind not in ("interview", "demo"):
        raise HTTPException(400, "kind must be 'interview' or 'demo'")
    if file and file.filename:
        if Path(file.filename).suffix.lower() not in ALLOWED_TRANSCRIPT_EXTENSIONS:
            raise HTTPException(400, "Transcript must be TXT, VTT, SRT, MD, DOCX or PDF")
        text = extract_text(file.filename, await file.read())
    if len(text.strip()) < 50:
        raise HTTPException(400, "Transcript text is empty or too short")
    transcript = Transcript(
        candidate_id=candidate.id, kind=kind, text=text, recording_url=recording_url, created_by=user.name
    )
    db.add(transcript)
    label = "Interview" if kind == "interview" else "Demo-session"
    activity.log(db, candidate.id, f"{label} transcript captured", recording_url, user.name)
    db.commit()
    background.add_task(pipeline.process_transcript, transcript.id)
    return {"id": transcript.id}


@router.post("/{candidate_id}/transcripts/{transcript_id}/retry")
def retry_transcript(
    candidate_id: int, transcript_id: int, background: BackgroundTasks, db: Session = Depends(get_db), _: User = Depends(editor)
):
    transcript = db.get(Transcript, transcript_id)
    if not transcript or transcript.candidate_id != candidate_id:
        raise HTTPException(404, "Transcript not found")
    transcript.status = "queued"
    transcript.error = ""
    db.commit()
    background.add_task(pipeline.process_transcript, transcript.id)
    return {"ok": True}


@router.post("/{candidate_id}/sync")
def sync_candidate(candidate_id: int, background: BackgroundTasks, db: Session = Depends(get_db), _: User = Depends(editor)):
    _get(db, candidate_id)
    background.add_task(google_sync.run_sync, candidate_id)
    return {"ok": True}
