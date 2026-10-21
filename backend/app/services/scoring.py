from typing import Any

from sqlalchemy.orm import Session

from app.constants import CORE_TRAITS, CRITERIA, SCORECARD_MAX, SCORECARD_SECTIONS
from app.models import Candidate, Scorecard
from app.services import activity, claude
from app.services.screening import candidate_profile, job_brief

RUBRIC = (
    "Score each criterion 0, 0.5 or 1:\n"
    "- 0 = no evidence, or evidence of the opposite.\n"
    "- 0.5 = some or partial evidence.\n"
    "- 1 = clear, specific, convincing evidence.\n"
    "For 'Years of Experience': 1 if relevant experience meets or exceeds the role minimum, 0.5 if somewhat "
    "below or only partly relevant, 0 if far below.\n"
    "Keep each rationale to one sentence that cites the evidence."
)

SYSTEM = (
    "You are an HR assessor at Paragon Global Internships applying the company's Recruitment Evaluation "
    "Scorecard (Norms & Values, Attitudinal Traits, Competency). Be fair, consistent and evidence-based. "
    "Do not reward vague claims; reward specific examples."
)


def criteria_text(keys: list[str]) -> str:
    return "\n".join(f"- {k}: {CRITERIA[k]}" for k in keys)


def criteria_schema(keys: list[str], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    item = {
        "type": "object",
        "properties": {"score": {"type": "number", "enum": [0, 0.5, 1]}, "rationale": {"type": "string"}},
        "required": ["score", "rationale"],
    }
    properties: dict[str, Any] = {
        "scores": {"type": "object", "properties": {k: item for k in keys}, "required": keys},
        "summary": {"type": "string", "description": "2-3 sentence overall assessment."},
    }
    properties.update(extra or {})
    return {"type": "object", "properties": properties, "required": list(properties.keys())}


def _snap(value: Any) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 0.0
    return min((0.0, 0.5, 1.0), key=lambda option: abs(option - v))


def parse_scores(raw: dict[str, Any]) -> tuple[dict[str, float], dict[str, str]]:
    scores, rationale = {}, {}
    for key, value in (raw or {}).items():
        if key not in CRITERIA:
            continue
        if isinstance(value, dict):
            scores[key] = _snap(value.get("score"))
            rationale[key] = str(value.get("rationale", ""))
        else:
            scores[key] = _snap(value)
    return scores, rationale


def evaluate(scores: dict[str, float], cfg: dict[str, Any], allow_borderline: bool = True) -> dict[str, Any]:
    totals = {}
    for section in SCORECARD_SECTIONS:
        totals[section["key"]] = sum(scores.get(k, 0) for k, _ in section["criteria"])
    total = sum(totals.values())
    pct = round(total / SCORECARD_MAX * 100, 1)
    core = sum(scores.get(k, 0) for k in CORE_TRAITS)
    pass_pct = float(cfg.get("preselection_pass_pct", 70))
    borderline_pct = float(cfg.get("preselection_borderline_pct", 50))
    core_min = float(cfg.get("core_trait_min", 2.0))

    if pct >= pass_pct and core >= core_min:
        outcome = "pass"
    elif not allow_borderline or pct < borderline_pct:
        outcome = "fail"
    else:
        outcome = "borderline"
    return {
        "norms_total": totals["norms"],
        "attitude_total": totals["attitude"],
        "competency_total": totals["competency"],
        "total": total,
        "percentage": pct,
        "core_traits": core,
        "outcome": outcome,
    }


def save(
    db: Session,
    candidate: Candidate,
    stage: str,
    scores: dict[str, float],
    rationale: dict[str, str],
    summary: str,
    scored_by: str,
    cfg: dict[str, Any],
    allow_borderline: bool = True,
) -> Scorecard:
    result = evaluate(scores, cfg, allow_borderline)
    card = Scorecard(
        candidate_id=candidate.id,
        stage=stage,
        scores=scores,
        rationale=rationale,
        summary=summary,
        norms_total=result["norms_total"],
        attitude_total=result["attitude_total"],
        competency_total=result["competency_total"],
        total=result["total"],
        percentage=result["percentage"],
        outcome=result["outcome"],
        scored_by=scored_by,
    )
    db.add(card)
    db.flush()
    activity.log(
        db,
        candidate.id,
        f"Scorecard ({stage.replace('_', ' ')})",
        f"{result['total']}/{int(SCORECARD_MAX)} ({result['percentage']}%), core traits {result['core_traits']}/3 → {result['outcome']}",
        actor=scored_by,
    )
    return card


def ai_preselection(candidate: Candidate) -> tuple[dict[str, float], dict[str, str], str]:
    keys = list(CRITERIA.keys())
    screening = candidate.screening_details or {}
    prompt = "\n\n".join(
        [
            job_brief(candidate.job),
            "---\nCANDIDATE",
            candidate_profile(candidate),
            f"Screening result: combined match {candidate.screening_score}%. {screening.get('summary', '')}",
            "---\nSCORECARD CRITERIA\n" + criteria_text(keys),
            RUBRIC
            + "\nNorms & Values and Attitudinal Traits should be judged mainly from the application question "
            "answers and how the candidate describes their work; Competency mainly from the CV and QCA answers.",
        ]
    )
    raw = claude.structured(
        SYSTEM, prompt, "record_scorecard", "Record the pre-selection scorecard.", criteria_schema(keys)
    )
    scores, rationale = parse_scores(raw.get("scores", {}))
    return scores, rationale, raw.get("summary", "")
