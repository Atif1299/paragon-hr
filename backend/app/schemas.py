from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# Company demo accounts use @paragon.local. The strict email checker rejects
# .local (a reserved domain), so validate the shape only.
EmailAddress = Annotated[str, Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)]


class LoginIn(BaseModel):
    email: EmailAddress
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: str
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailAddress
    name: str = Field(min_length=1)
    role: Literal["admin", "hr", "viewer"]
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    name: str | None = None
    role: Literal["admin", "hr", "viewer"] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)


class Keyword(BaseModel):
    term: str = Field(min_length=1)
    weight: float = Field(default=1, ge=0, le=10)


class JobIn(BaseModel):
    title: str = Field(min_length=1)
    area: str = ""
    description: str = ""
    keywords: list[Keyword] = []
    min_years: float = Field(default=0, ge=0)
    is_open: bool = True


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    area: str
    description: str
    keywords: list[dict]
    min_years: float
    is_open: bool


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: EmailAddress | None = None
    phone: str | None = None
    previous_employment: str | None = None
    employment_status: str | None = None
    experience_years: float | None = None
    notice_period: str | None = None
    source_platform: str | None = None
    profile_url: str | None = None
    linkedin_url: str | None = None
    upwork_url: str | None = None
    has_vpn: str | None = None
    vetting_status: str | None = None
    pipeline_status: str | None = None
    interview_link: str | None = None
    onboarding_link: str | None = None
    notes: str | None = None
    recruiter_name: str | None = None
    interviewed_on: date | None = None
    trial_start_date: date | None = None
    trial_end_date: date | None = None
    contracted_on: date | None = None


class ScorecardIn(BaseModel):
    stage: Literal["pre_selection", "interview", "manual"] = "manual"
    scores: dict[str, float]
    rationale: dict[str, str] = {}
    summary: str = ""
    apply_outcome: bool = False


class InviteIn(BaseModel):
    kind: Literal["interview", "onboarding"]


class DecisionIn(BaseModel):
    decision: Literal["select", "reject", "refer"]


class EventIn(BaseModel):
    title: str = Field(min_length=1)
    kind: Literal["interview", "onboarding"] = "interview"
    job_id: int | None = None
    starts_at: datetime
    duration_minutes: int = Field(default=60, ge=10, le=600)
    meeting_link: str = ""
    capacity: int = Field(default=6, ge=1, le=100)
    notes: str = ""


class EventUpdate(BaseModel):
    title: str | None = None
    starts_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=600)
    meeting_link: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=100)
    notes: str | None = None
    status: Literal["scheduled", "completed", "cancelled"] | None = None


class ParticipantIn(BaseModel):
    candidate_id: int


class ParticipantUpdate(BaseModel):
    status: Literal["booked", "attended", "no_show", "cancelled"] | None = None
    note: str | None = None


class BookingIn(BaseModel):
    event_id: int


class QuestionnaireAnswersIn(BaseModel):
    answers: dict[str, str]
