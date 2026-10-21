from typing import Any

from app.constants import CRITERIA
from app.models import Candidate
from app.services import claude, scoring
from app.services.screening import job_brief

INTERVIEW_EXTRA = {
    "strengths": {"type": "array", "items": {"type": "string"}},
    "concerns": {"type": "array", "items": {"type": "string"}},
    "recommendation": {"type": "string", "enum": ["select", "reject", "refer_other_role", "follow_up"]},
    "recommendation_rationale": {"type": "string"},
}


def analyze_interview(candidate: Candidate, text: str) -> dict[str, Any]:
    keys = list(CRITERIA.keys())
    previous = next((c for c in reversed(candidate.scorecards) if c.stage != "interview"), None)
    prompt = "\n\n".join(
        [
            job_brief(candidate.job),
            f"Candidate: {candidate.full_name}",
            "Pre-selection assessment: " + (previous.summary if previous else "none"),
            "---\nINTERVIEW TRANSCRIPT\n" + claude.clip(text, 80000),
            "---\nScore the candidate on the full Recruitment Evaluation Scorecard using the interview evidence.\n"
            + scoring.criteria_text(keys),
            scoring.RUBRIC,
            "Then list key strengths and concerns, and recommend: select, reject, refer_other_role (good candidate, "
            "wrong role) or follow_up.",
        ]
    )
    return claude.structured(
        scoring.SYSTEM,
        prompt,
        "record_interview_analysis",
        "Record the post-interview analysis and scorecard.",
        scoring.criteria_schema(keys, INTERVIEW_EXTRA),
        max_tokens=5000,
    )


def demo_schema(areas: list[str], tools: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "Overview of the demo session."},
            "projects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "candidate_role": {"type": "string", "description": "What the candidate personally did."},
                        "outcomes": {"type": "string", "description": "Results or metrics mentioned."},
                        "tags": {"type": "array", "items": {"type": "string"}},
                        "tools_mentioned": {"type": "array", "items": {"type": "string"}},
                        "business_areas": {"type": "array", "items": {"type": "string", "enum": areas + ["Other"]}},
                        "company_tools": {"type": "array", "items": {"type": "string", "enum": tools + ["Other"]}},
                        "relevance": {"type": "string", "enum": ["high", "medium", "low"]},
                        "relevance_score": {"type": "integer", "minimum": 0, "maximum": 100},
                        "relevance_rationale": {"type": "string"},
                    },
                    "required": [
                        "name",
                        "description",
                        "candidate_role",
                        "outcomes",
                        "tags",
                        "tools_mentioned",
                        "business_areas",
                        "company_tools",
                        "relevance",
                        "relevance_score",
                        "relevance_rationale",
                    ],
                },
            },
            "key_strengths": {"type": "array", "items": {"type": "string"}},
            "gaps": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "projects", "key_strengths", "gaps"],
    }


def analyze_demo(candidate: Candidate, text: str, cfg: dict[str, Any]) -> dict[str, Any]:
    areas = list(cfg.get("business_areas") or [])
    tools = list(cfg.get("tools") or [])
    prompt = "\n\n".join(
        [
            job_brief(candidate.job),
            f"Candidate: {candidate.full_name}",
            "Company business areas: " + ", ".join(areas),
            "Company tools: " + ", ".join(tools),
            "---\nASSIGNMENT INTERVIEW / DEMO SESSION TRANSCRIPT\n" + claude.clip(text, 80000),
            "---\nExtract every project the candidate discussed. Tag each one, list the tools mentioned, and map it "
            "to the company's business areas and tools. Rate how relevant each project is to the company's "
            "business and to this role.",
        ]
    )
    return claude.structured(
        "You are an HR analyst at Paragon Global Internships preparing an onboarding project report from a "
        "candidate's demo session. Only report what was actually discussed.",
        prompt,
        "record_project_report",
        "Record the extracted projects report.",
        demo_schema(areas, tools),
        max_tokens=6000,
    )


def demo_report_text(candidate: Candidate, analysis: dict[str, Any]) -> str:
    lines = [
        f"Onboarding Project Report – {candidate.full_name}",
        f"Role: {candidate.job.title}",
        "",
        "Summary",
        analysis.get("summary", ""),
        "",
        "Projects discussed",
    ]
    for i, p in enumerate(analysis.get("projects", []), 1):
        lines += [
            "",
            f"{i}. {p.get('name', '')}  [relevance: {p.get('relevance', '')} – {p.get('relevance_score', '')}/100]",
            f"   {p.get('description', '')}",
            f"   Candidate's role: {p.get('candidate_role', '')}",
            f"   Outcomes: {p.get('outcomes', '')}",
            f"   Tags: {', '.join(p.get('tags', []))}",
            f"   Tools mentioned: {', '.join(p.get('tools_mentioned', []))}",
            f"   Business areas: {', '.join(p.get('business_areas', []))}",
            f"   Company tools: {', '.join(p.get('company_tools', []))}",
            f"   Why: {p.get('relevance_rationale', '')}",
        ]
    lines += ["", "Key strengths"] + [f"- {s}" for s in analysis.get("key_strengths", [])]
    lines += ["", "Gaps"] + [f"- {g}" for g in analysis.get("gaps", [])]
    return "\n".join(lines)
