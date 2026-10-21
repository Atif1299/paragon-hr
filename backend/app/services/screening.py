import re
from typing import Any

from sqlalchemy.orm import Session

from app.constants import QCA_FIELDS, TRAIT_QUESTIONS, Vetting
from app.models import Candidate, Job
from app.services import activity, claude


def _normalize(text: str) -> str:
    text = (text or "").lower().replace("&", " and ")
    text = re.sub(r"[-_/]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _variants(term: str) -> set[str]:
    raw = term.strip()
    parts = [raw]
    match = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", raw)
    if match:
        parts = [match.group(1), match.group(2)]
    variants = set()
    for part in parts:
        norm = _normalize(part)
        if not norm:
            continue
        variants.add(norm)
        if len(norm) > 4 and norm.endswith("s"):
            variants.add(norm[:-1])
    return variants


def _contains(text: str, phrase: str) -> bool:
    words = [re.escape(w) for w in phrase.split()]
    pattern = r"(?<![a-z0-9])" + r"\s+".join(words) + r"s?(?![a-z0-9])"
    return re.search(pattern, text) is not None


def keyword_match(text: str, keywords: list[dict[str, Any]]) -> tuple[float, list[str], list[str]]:
    normalized = _normalize(text)
    matched, missing = [], []
    total = matched_weight = 0.0
    for kw in keywords:
        term, weight = kw.get("term", ""), float(kw.get("weight", 1) or 0)
        if not term or weight <= 0:
            continue
        total += weight
        if any(_contains(normalized, v) for v in _variants(term)):
            matched.append(term)
            matched_weight += weight
        else:
            missing.append(term)
    score = round(matched_weight / total * 100, 1) if total else 0.0
    return score, matched, missing


def candidate_profile(candidate: Candidate) -> str:
    qca_labels = {f["key"]: f["label"] for f in QCA_FIELDS}
    qca_lines = [f"- {qca_labels.get(k, k)}: {v}" for k, v in (candidate.qca or {}).items() if v not in (None, "")]
    trait_lines = []
    for q in TRAIT_QUESTIONS:
        answer = (candidate.trait_answers or {}).get(q["key"])
        if answer:
            trait_lines.append(f"Q: {q['question']}\nA: {answer}")
    return "\n".join(
        [
            f"Name: {candidate.full_name}",
            f"Previous employment: {candidate.previous_employment or '-'}",
            f"Current employment status: {candidate.employment_status or '-'}",
            f"Stated total experience (years): {candidate.experience_years if candidate.experience_years is not None else '-'}",
            f"Notice period / availability: {candidate.notice_period or '-'}",
            f"Source platform: {candidate.source_platform or '-'}",
            "",
            "QCA form answers:",
            "\n".join(qca_lines) or "- none",
            "",
            "Application questions:",
            "\n\n".join(trait_lines) or "- none",
            "",
            "CV text:",
            claude.clip(candidate.cv_text, 15000) or "- no CV text",
        ]
    )


def job_brief(job: Job) -> str:
    keywords = ", ".join(k["term"] for k in job.keywords or [])
    return (
        f"Role: {job.title}\nArea: {job.area}\nMinimum years of experience: {job.min_years}\n"
        f"Required keywords/skills: {keywords}\n\nJob description:\n{job.description}"
    )


SCREENING_SCHEMA = {
    "type": "object",
    "properties": {
        "skill_match_score": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "How well the candidate's evidenced skills match the role requirements (0-100).",
        },
        "matched_skills": {"type": "array", "items": {"type": "string"}},
        "missing_skills": {"type": "array", "items": {"type": "string"}},
        "relevant_years_experience": {"type": "number"},
        "meets_minimum_experience": {"type": "boolean"},
        "red_flags": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string", "description": "3-4 sentence screening summary for HR."},
    },
    "required": [
        "skill_match_score",
        "matched_skills",
        "missing_skills",
        "relevant_years_experience",
        "meets_minimum_experience",
        "red_flags",
        "summary",
    ],
}

SYSTEM = (
    "You are a senior recruiter at Paragon Global Internships screening applicants against a specific role. "
    "Judge only on evidence in the CV and application. Never invent experience. Semantic matches count "
    "(e.g. 'HighLevel' = 'GoHighLevel'), but unrelated experience does not."
)


def ai_screen(candidate: Candidate, job: Job) -> dict[str, Any]:
    prompt = f"{job_brief(job)}\n\n---\nCANDIDATE\n{candidate_profile(candidate)}"
    return claude.structured(
        SYSTEM, prompt, "record_screening", "Record the CV screening result.", SCREENING_SCHEMA, max_tokens=2000
    )


def run(db: Session, candidate: Candidate, cfg: dict[str, Any]) -> None:
    job = candidate.job
    source = "\n".join(
        [candidate.cv_text or "", candidate.previous_employment or "", *(candidate.trait_answers or {}).values()]
    )
    kw_score, matched, missing = keyword_match(source, job.keywords or [])
    candidate.keyword_score = kw_score
    candidate.matched_keywords = matched
    candidate.missing_keywords = missing

    weight = float(cfg.get("keyword_weight", 0.4))
    details: dict[str, Any] = {"keyword_weight": weight}
    if claude.enabled():
        result = ai_screen(candidate, job)
        ai_score = float(result.get("skill_match_score", 0))
        candidate.ai_skill_score = ai_score
        candidate.screening_summary = result.get("summary", "")
        details.update(result)
        score = round(kw_score * weight + ai_score * (1 - weight), 1)
    else:
        candidate.ai_skill_score = None
        candidate.screening_summary = "Keyword-only screening (Claude API key not configured)."
        score = kw_score

    candidate.screening_score = score
    candidate.screening_details = details
    threshold = float(cfg.get("screening_threshold", 50))
    candidate.vetting_status = Vetting.RIGHT_FIT if score >= threshold else Vetting.NOT_A_FIT
    activity.log(
        db,
        candidate.id,
        "Screening completed",
        f"Keyword match {kw_score}%, combined score {score}% (threshold {threshold}%) → {candidate.vetting_status}",
        actor="Claude" if claude.enabled() else "System",
    )
