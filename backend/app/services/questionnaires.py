from typing import Any

from sqlalchemy.orm import Session

from app.constants import CORE_TRAITS, CRITERIA, QUESTION_BANK, Pipeline
from app.core.config import settings
from app.core.security import new_token
from app.models import Candidate, Questionnaire, Scorecard
from app.services import activity, claude, notifications, scoring
from app.services.screening import job_brief

MAX_QUESTIONS = 6


def link(token: str) -> str:
    return f"{settings.PUBLIC_APP_URL.rstrip('/')}/questionnaire/{token}"


def pick_criteria(card: Scorecard) -> list[str]:
    weak = [k for k in CRITERIA if card.scores.get(k, 0) < 1]
    weak.sort(key=lambda k: (k not in CORE_TRAITS, card.scores.get(k, 0)))
    return weak[:MAX_QUESTIONS]


def create(db: Session, candidate: Candidate, card: Scorecard) -> Questionnaire:
    criteria = pick_criteria(card) or list(CORE_TRAITS)
    questions = [{"id": k, "criterion": CRITERIA[k], "question": QUESTION_BANK[k]} for k in criteria]
    questionnaire = Questionnaire(candidate_id=candidate.id, token=new_token(), questions=questions)
    db.add(questionnaire)
    candidate.pipeline_status = Pipeline.QUESTIONNAIRE_SENT
    notifications.questionnaire_invite(db, candidate, link(questionnaire.token))
    activity.log(
        db,
        candidate.id,
        "Supplementary questionnaire sent",
        f"Below pass threshold – {len(questions)} follow-up questions on: " + ", ".join(CRITERIA[k] for k in criteria),
    )
    return questionnaire


def rescore(db: Session, questionnaire: Questionnaire, cfg: dict[str, Any]) -> Scorecard:
    candidate = questionnaire.candidate
    base = next((c for c in reversed(candidate.scorecards) if c.stage == "pre_selection"), None)
    scores = dict(base.scores) if base else {}
    rationale = dict(base.rationale) if base else {}
    keys = [q["id"] for q in questionnaire.questions]

    qa = "\n\n".join(
        f"[{q['id']}] {q['criterion']}\nQ: {q['question']}\nA: {questionnaire.answers.get(q['id'], '').strip() or '(no answer)'}"
        for q in questionnaire.questions
    )
    prompt = "\n\n".join(
        [
            job_brief(candidate.job),
            f"Candidate: {candidate.full_name}",
            "Previous pre-selection assessment: " + (base.summary if base else "none"),
            "---\nSUPPLEMENTARY QUESTIONNAIRE ANSWERS\n" + qa,
            "---\nRe-score ONLY these criteria based on the answers:\n" + scoring.criteria_text(keys),
            scoring.RUBRIC,
        ]
    )
    raw = claude.structured(
        scoring.SYSTEM,
        prompt,
        "record_rescore",
        "Record updated scores for the questionnaire criteria.",
        scoring.criteria_schema(keys),
    )
    new_scores, new_rationale = scoring.parse_scores(raw.get("scores", {}))
    scores.update(new_scores)
    rationale.update(new_rationale)
    questionnaire.status = "scored"
    return scoring.save(
        db,
        candidate,
        "questionnaire",
        scores,
        rationale,
        raw.get("summary", ""),
        "Claude",
        cfg,
        allow_borderline=False,
    )
