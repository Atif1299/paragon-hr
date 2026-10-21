"""Orchestrates the automated stages: screening → pre-selection → fallback → referral → selection → onboarding."""

import logging
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.constants import Pipeline, Vetting
from app.core.database import SessionLocal
from app.models import Candidate, Questionnaire, Transcript
from app.services import (
    activity,
    app_settings,
    claude,
    google_sync,
    questionnaires,
    referrals,
    scheduling,
    scoring,
    screening,
    transcripts,
)

logger = logging.getLogger(__name__)


def on_pass(db: Session, candidate: Candidate, cfg: dict[str, Any], actor: str = "System") -> None:
    candidate.preselection_outcome = "pass"
    candidate.pipeline_status = Pipeline.PRE_SELECTED
    activity.log(db, candidate.id, "Pre-selected (benched)", "Passed pre-selection scorecard", actor=actor)
    if cfg.get("auto_invite_on_pass", True):
        scheduling.create_invite(db, candidate, "interview", actor=actor)


def on_fail(db: Session, candidate: Candidate, cfg: dict[str, Any], why: str, actor: str = "System") -> bool:
    """Returns True if the candidate was routed to another role and must be re-evaluated."""
    if referrals.attempt(db, candidate, cfg, why, actor=actor):
        return True
    candidate.pipeline_status = Pipeline.REJECTED
    activity.log(db, candidate.id, "Rejected", why, actor=actor)
    return False


def evaluate(db: Session, candidate: Candidate, cfg: dict[str, Any]) -> None:
    for _ in range(2):
        screening.run(db, candidate, cfg)
        if candidate.vetting_status == Vetting.NOT_A_FIT:
            if on_fail(db, candidate, cfg, f"Did not meet screening criteria for {candidate.job.title}"):
                db.flush()
                continue
            return
        candidate.pipeline_status = Pipeline.SCREENED
        if not claude.enabled():
            candidate.processing_error = "Pre-selection needs Claude (ANTHROPIC_API_KEY) or a manual scorecard."
            return
        scores, rationale, summary = scoring.ai_preselection(candidate)
        card = scoring.save(db, candidate, "pre_selection", scores, rationale, summary, "Claude", cfg)
        candidate.preselection_outcome = card.outcome
        if card.outcome == "pass":
            on_pass(db, candidate, cfg)
        elif card.outcome == "borderline":
            questionnaires.create(db, candidate, card)
        elif on_fail(db, candidate, cfg, f"Failed pre-selection for {candidate.job.title} ({card.percentage}%)"):
            db.flush()
            continue
        return


def process_candidate(candidate_id: int) -> None:
    db = SessionLocal()
    try:
        candidate = db.get(Candidate, candidate_id)
        if not candidate:
            return
        candidate.processing_state = "running"
        candidate.processing_error = ""
        db.commit()
        try:
            evaluate(db, candidate, app_settings.get_all(db))
            candidate.processing_state = "done"
            db.commit()
        except Exception as exc:
            logger.exception("Candidate processing failed")
            db.rollback()
            candidate = db.get(Candidate, candidate_id)
            candidate.processing_state = "error"
            candidate.processing_error = str(exc)[:2000]
            activity.log(db, candidate_id, "Processing error", str(exc)[:500])
            db.commit()
    finally:
        db.close()
    google_sync.run_sync(candidate_id=candidate_id)


def process_questionnaire(questionnaire_id: int) -> None:
    db = SessionLocal()
    candidate_id = None
    try:
        questionnaire = db.get(Questionnaire, questionnaire_id)
        if not questionnaire:
            return
        candidate = questionnaire.candidate
        candidate_id = candidate.id
        cfg = app_settings.get_all(db)
        try:
            card = questionnaires.rescore(db, questionnaire, cfg)
            candidate.preselection_outcome = card.outcome
            if card.outcome == "pass":
                on_pass(db, candidate, cfg)
            elif on_fail(db, candidate, cfg, f"Below threshold after questionnaire ({card.percentage}%)"):
                db.flush()
                evaluate(db, candidate, cfg)
            db.commit()
        except Exception as exc:
            logger.exception("Questionnaire scoring failed")
            db.rollback()
            q = db.get(Questionnaire, questionnaire_id)
            q.status = "error"
            activity.log(db, candidate_id, "Questionnaire scoring error", str(exc)[:500])
            db.commit()
    finally:
        db.close()
    if candidate_id:
        google_sync.run_sync(candidate_id=candidate_id)


def process_transcript(transcript_id: int) -> None:
    db = SessionLocal()
    candidate_id = None
    try:
        t = db.get(Transcript, transcript_id)
        if not t:
            return
        candidate = t.candidate
        candidate_id = candidate.id
        cfg = app_settings.get_all(db)
        t.status = "running"
        db.commit()
        try:
            if t.kind == "interview":
                analysis = transcripts.analyze_interview(candidate, t.text)
                scores, rationale = scoring.parse_scores(analysis.get("scores", {}))
                scoring.save(db, candidate, "interview", scores, rationale, analysis.get("summary", ""), "Claude", cfg)
                t.analysis = analysis
                candidate.pipeline_status = Pipeline.INTERVIEWED
                candidate.interviewed_on = candidate.interviewed_on or date.today()
                activity.log(
                    db,
                    candidate.id,
                    "Interview transcript analysed",
                    f"Recommendation: {analysis.get('recommendation', '')}",
                    actor="Claude",
                )
            else:
                analysis = transcripts.analyze_demo(candidate, t.text, cfg)
                t.analysis = analysis
                candidate.pipeline_status = Pipeline.ONBOARDING
                activity.log(
                    db,
                    candidate.id,
                    "Onboarding project report generated",
                    f"{len(analysis.get('projects', []))} projects extracted",
                    actor="Claude",
                )
                db.commit()
                try:
                    t.report_drive_url = google_sync.upload_text_doc(
                        candidate,
                        f"Onboarding Project Report – {candidate.full_name}",
                        transcripts.demo_report_text(candidate, analysis),
                    )
                except Exception as exc:
                    logger.exception("Report upload failed")
                    candidate.sync_error = f"Report upload failed: {exc}"[:2000]
            t.status = "done"
            db.commit()
        except Exception as exc:
            logger.exception("Transcript analysis failed")
            db.rollback()
            t = db.get(Transcript, transcript_id)
            t.status = "error"
            t.error = str(exc)[:2000]
            db.commit()
    finally:
        db.close()
    if candidate_id:
        google_sync.run_sync(candidate_id=candidate_id)


def decide(db: Session, candidate: Candidate, decision: str, actor: str) -> bool:
    """HR decision after interview. Returns True if the candidate needs re-evaluation (was referred)."""
    cfg = app_settings.get_all(db)
    if decision == "select":
        candidate.pipeline_status = Pipeline.SELECTED
        activity.log(db, candidate.id, "Selected", "Candidate selected after interview", actor=actor)
        return False
    if decision == "refer":
        return referrals.attempt(db, candidate, cfg, "Referred by HR after interview", actor=actor)
    return on_fail(db, candidate, cfg, "Not selected after interview", actor=actor)
