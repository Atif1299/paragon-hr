from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import Pipeline
from app.models import Candidate, Job, Referral
from app.services import activity, claude, notifications
from app.services.screening import candidate_profile, keyword_match

RANK_SCHEMA = {
    "type": "object",
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "slug": {"type": "string"},
                    "fit_score": {"type": "integer", "minimum": 0, "maximum": 100},
                    "reason": {"type": "string"},
                },
                "required": ["slug", "fit_score", "reason"],
            },
        }
    },
    "required": ["matches"],
}


def _rank(candidate: Candidate, jobs: list[Job]) -> list[dict[str, Any]]:
    if claude.enabled():
        roles = "\n\n".join(
            f"[{j.slug}] {j.title} (min {j.min_years} yrs)\nKeywords: {', '.join(k['term'] for k in j.keywords)}"
            for j in jobs
        )
        prompt = (
            f"The candidate below did not fit the role '{candidate.job.title}'. Score how well they fit each "
            f"other open role (0-100), based only on evidence.\n\nOPEN ROLES\n{roles}\n\n---\nCANDIDATE\n"
            f"{candidate_profile(candidate)}"
        )
        raw = claude.structured(
            "You are a recruiter matching candidates to the best-fitting open role.",
            prompt,
            "record_role_fit",
            "Record the fit score for each open role.",
            RANK_SCHEMA,
            max_tokens=2000,
        )
        return raw.get("matches", [])
    text = "\n".join([candidate.cv_text or "", candidate.previous_employment or ""])
    return [
        {"slug": j.slug, "fit_score": keyword_match(text, j.keywords)[0], "reason": "Keyword match on CV"}
        for j in jobs
    ]


def attempt(db: Session, candidate: Candidate, cfg: dict[str, Any], why: str, actor: str = "System") -> bool:
    """Try to route a non-fit candidate to another open role. Returns True if the candidate was routed."""
    if candidate.referred_from_job_id is not None:
        return False
    jobs = db.scalars(select(Job).where(Job.is_open.is_(True), Job.id != candidate.job_id)).all()
    if not jobs:
        return False

    matches = sorted(_rank(candidate, jobs), key=lambda m: m.get("fit_score", 0), reverse=True)
    by_slug = {j.slug: j for j in jobs}
    best = next((m for m in matches if m.get("slug") in by_slug), None)
    threshold = float(cfg.get("referral_threshold", 60))
    if not best or float(best["fit_score"]) < threshold:
        activity.log(
            db,
            candidate.id,
            "No referral match",
            f"{why}. Best alternative scored {best['fit_score'] if best else 0}% (threshold {threshold}%).",
            actor=actor,
        )
        return False

    target = by_slug[best["slug"]]
    auto = bool(cfg.get("auto_referral", True))
    referral = Referral(
        candidate_id=candidate.id,
        from_job_id=candidate.job_id,
        to_job_id=target.id,
        fit_score=float(best["fit_score"]),
        reason=best.get("reason", ""),
        status="routed" if auto else "suggested",
    )
    db.add(referral)
    if not auto:
        activity.log(db, candidate.id, "Referral suggested", f"{target.title} ({best['fit_score']}%)", actor=actor)
        return False
    route(db, candidate, target, actor)
    return True


def route(db: Session, candidate: Candidate, target: Job, actor: str = "System") -> None:
    old_title = candidate.job.title
    candidate.referred_from_job_id = candidate.job_id
    candidate.job_id = target.id
    candidate.job = target
    candidate.pipeline_status = Pipeline.APPLIED
    candidate.vetting_status = ""
    candidate.preselection_outcome = ""
    notifications.referral_notice(db, candidate, target.title, old_title)
    activity.log(db, candidate.id, "Referred to another role", f"{old_title} → {target.title}", actor=actor)
