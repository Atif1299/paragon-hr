from typing import Any

from app.models import Candidate, Event, Scorecard
from app.services.scheduling import booking_link, seats_left
from app.services.questionnaires import link as questionnaire_link


def scorecard(card: Scorecard) -> dict[str, Any]:
    return {
        "id": card.id,
        "stage": card.stage,
        "scores": card.scores,
        "rationale": card.rationale,
        "summary": card.summary,
        "norms_total": card.norms_total,
        "attitude_total": card.attitude_total,
        "competency_total": card.competency_total,
        "total": card.total,
        "percentage": card.percentage,
        "outcome": card.outcome,
        "scored_by": card.scored_by,
        "created_at": card.created_at,
    }


def latest_card(c: Candidate) -> Scorecard | None:
    return c.scorecards[-1] if c.scorecards else None


def candidate_summary(c: Candidate) -> dict[str, Any]:
    card = latest_card(c)
    return {
        "id": c.id,
        "created_at": c.created_at,
        "full_name": c.full_name,
        "email": c.email,
        "phone": c.phone,
        "job_id": c.job_id,
        "job_title": c.job.title,
        "source_platform": c.source_platform,
        "vetting_status": c.vetting_status,
        "pipeline_status": c.pipeline_status,
        "screening_score": c.screening_score,
        "preselection_outcome": c.preselection_outcome,
        "latest_score_pct": card.percentage if card else None,
        "latest_outcome": card.outcome if card else None,
        "processing_state": c.processing_state,
        "referred": c.referred_from_job_id is not None,
    }


def candidate_detail(c: Candidate) -> dict[str, Any]:
    data = candidate_summary(c)
    data.update(
        {
            "previous_employment": c.previous_employment,
            "employment_status": c.employment_status,
            "experience_years": c.experience_years,
            "notice_period": c.notice_period,
            "profile_url": c.profile_url,
            "linkedin_url": c.linkedin_url,
            "upwork_url": c.upwork_url,
            "has_vpn": c.has_vpn,
            "qca": c.qca,
            "trait_answers": c.trait_answers,
            "cv_filename": c.cv_filename,
            "has_cv_file": bool(c.cv_path),
            "cv_text_preview": (c.cv_text or "")[:4000],
            "keyword_score": c.keyword_score,
            "ai_skill_score": c.ai_skill_score,
            "matched_keywords": c.matched_keywords,
            "missing_keywords": c.missing_keywords,
            "screening_summary": c.screening_summary,
            "screening_details": c.screening_details,
            "interview_link": c.interview_link,
            "onboarding_link": c.onboarding_link,
            "drive_folder_url": c.drive_folder_url,
            "cv_drive_url": c.cv_drive_url,
            "notes": c.notes,
            "recruiter_name": c.recruiter_name,
            "referred_from_job": c.referred_from_job.title if c.referred_from_job else None,
            "processing_error": c.processing_error,
            "sync_error": c.sync_error,
            "interviewed_on": c.interviewed_on,
            "trial_start_date": c.trial_start_date,
            "trial_end_date": c.trial_end_date,
            "contracted_on": c.contracted_on,
            "scorecards": [scorecard(s) for s in c.scorecards],
            "transcripts": [
                {
                    "id": t.id,
                    "kind": t.kind,
                    "recording_url": t.recording_url,
                    "status": t.status,
                    "error": t.error,
                    "analysis": t.analysis,
                    "report_drive_url": t.report_drive_url,
                    "text_preview": t.text[:1500],
                    "created_by": t.created_by,
                    "created_at": t.created_at,
                }
                for t in c.transcripts
            ],
            "questionnaires": [
                {
                    "id": q.id,
                    "status": q.status,
                    "questions": q.questions,
                    "answers": q.answers,
                    "link": questionnaire_link(q.token),
                    "created_at": q.created_at,
                    "submitted_at": q.submitted_at,
                }
                for q in c.questionnaires
            ],
            "referrals": [
                {
                    "id": r.id,
                    "from_job": r.from_job.title,
                    "to_job": r.to_job.title if r.to_job else None,
                    "to_job_id": r.to_job_id,
                    "fit_score": r.fit_score,
                    "reason": r.reason,
                    "status": r.status,
                    "created_at": r.created_at,
                }
                for r in c.referrals
            ],
            "events": [
                {
                    "participant_id": p.id,
                    "event_id": p.event_id,
                    "title": p.event.title,
                    "kind": p.event.kind,
                    "starts_at": p.event.starts_at,
                    "meeting_link": p.event.meeting_link,
                    "status": p.status,
                }
                for p in c.participations
            ],
            "invites": [
                {"id": i.id, "kind": i.kind, "status": i.status, "link": booking_link(i.token), "created_at": i.created_at}
                for i in c.invites
            ],
            "activities": [
                {"id": a.id, "actor": a.actor, "action": a.action, "detail": a.detail, "created_at": a.created_at}
                for a in c.activities
            ],
        }
    )
    return data


def event(e: Event, with_participants: bool = True) -> dict[str, Any]:
    data = {
        "id": e.id,
        "title": e.title,
        "kind": e.kind,
        "job_id": e.job_id,
        "job_title": e.job.title if e.job else "All roles",
        "starts_at": e.starts_at,
        "duration_minutes": e.duration_minutes,
        "meeting_link": e.meeting_link,
        "capacity": e.capacity,
        "seats_left": seats_left(e),
        "notes": e.notes,
        "status": e.status,
        "created_by": e.created_by,
    }
    if with_participants:
        data["participants"] = [
            {
                "id": p.id,
                "candidate_id": p.candidate_id,
                "full_name": p.candidate.full_name,
                "email": p.candidate.email,
                "phone": p.candidate.phone,
                "job_title": p.candidate.job.title,
                "pipeline_status": p.candidate.pipeline_status,
                "status": p.status,
                "note": p.note,
            }
            for p in e.participants
        ]
    return data
