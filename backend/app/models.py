from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    area: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    min_years: Mapped[float] = mapped_column(Float, default=0)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str] = mapped_column(String(64), default="")
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))

    previous_employment: Mapped[str] = mapped_column(String(500), default="")
    employment_status: Mapped[str] = mapped_column(String(64), default="")
    experience_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    notice_period: Mapped[str] = mapped_column(String(255), default="")
    source_platform: Mapped[str] = mapped_column(String(128), default="")
    profile_url: Mapped[str] = mapped_column(String(1000), default="")
    linkedin_url: Mapped[str] = mapped_column(String(1000), default="")
    upwork_url: Mapped[str] = mapped_column(String(1000), default="")
    has_vpn: Mapped[str] = mapped_column(String(64), default="")

    qca: Mapped[dict] = mapped_column(JSON, default=dict)
    trait_answers: Mapped[dict] = mapped_column(JSON, default=dict)

    cv_filename: Mapped[str] = mapped_column(String(500), default="")
    cv_path: Mapped[str] = mapped_column(String(1000), default="")
    cv_text: Mapped[str] = mapped_column(Text, default="")

    vetting_status: Mapped[str] = mapped_column(String(32), default="")
    pipeline_status: Mapped[str] = mapped_column(String(64), default="Applied", index=True)

    keyword_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_skill_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    screening_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    matched_keywords: Mapped[list] = mapped_column(JSON, default=list)
    missing_keywords: Mapped[list] = mapped_column(JSON, default=list)
    screening_summary: Mapped[str] = mapped_column(Text, default="")
    screening_details: Mapped[dict] = mapped_column(JSON, default=dict)
    preselection_outcome: Mapped[str] = mapped_column(String(32), default="")

    interview_link: Mapped[str] = mapped_column(String(1000), default="")
    onboarding_link: Mapped[str] = mapped_column(String(1000), default="")
    drive_folder_id: Mapped[str] = mapped_column(String(255), default="")
    drive_folder_url: Mapped[str] = mapped_column(String(1000), default="")
    cv_drive_url: Mapped[str] = mapped_column(String(1000), default="")

    notes: Mapped[str] = mapped_column(Text, default="")
    recruiter_name: Mapped[str] = mapped_column(String(255), default="")
    referred_from_job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)

    processing_state: Mapped[str] = mapped_column(String(32), default="queued")
    processing_error: Mapped[str] = mapped_column(Text, default="")
    sync_error: Mapped[str] = mapped_column(Text, default="")

    interviewed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    trial_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    trial_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contracted_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    job: Mapped[Job] = relationship(foreign_keys=[job_id])
    referred_from_job: Mapped[Job | None] = relationship(foreign_keys=[referred_from_job_id])
    scorecards: Mapped[list["Scorecard"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan", order_by="Scorecard.id"
    )
    transcripts: Mapped[list["Transcript"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan", order_by="Transcript.id"
    )
    questionnaires: Mapped[list["Questionnaire"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan", order_by="Questionnaire.id"
    )
    participations: Mapped[list["EventParticipant"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan"
    )
    referrals: Mapped[list["Referral"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan", order_by="Referral.id"
    )
    invites: Mapped[list["BookingInvite"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    activities: Mapped[list["ActivityLog"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan", order_by="ActivityLog.id.desc()"
    )


class Scorecard(Base):
    __tablename__ = "scorecards"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(32))
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
    rationale: Mapped[dict] = mapped_column(JSON, default=dict)
    summary: Mapped[str] = mapped_column(Text, default="")
    norms_total: Mapped[float] = mapped_column(Float, default=0)
    attitude_total: Mapped[float] = mapped_column(Float, default=0)
    competency_total: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    percentage: Mapped[float] = mapped_column(Float, default=0)
    outcome: Mapped[str] = mapped_column(String(32), default="")
    scored_by: Mapped[str] = mapped_column(String(255), default="Claude")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    candidate: Mapped[Candidate] = relationship(back_populates="scorecards")


class Questionnaire(Base):
    __tablename__ = "questionnaires"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    questions: Mapped[list] = mapped_column(JSON, default=list)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="sent")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    candidate: Mapped[Candidate] = relationship(back_populates="questionnaires")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(32), default="interview")
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    meeting_link: Mapped[str] = mapped_column(String(1000), default="")
    capacity: Mapped[int] = mapped_column(Integer, default=6)
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="scheduled")
    calendar_event_id: Mapped[str] = mapped_column(String(255), default="")
    created_by: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    job: Mapped[Job | None] = relationship()
    participants: Mapped[list["EventParticipant"]] = relationship(
        back_populates="event", cascade="all, delete-orphan", order_by="EventParticipant.id"
    )


class EventParticipant(Base):
    __tablename__ = "event_participants"
    __table_args__ = (UniqueConstraint("event_id", "candidate_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="booked")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    event: Mapped[Event] = relationship(back_populates="participants")
    candidate: Mapped[Candidate] = relationship(back_populates="participations")


class BookingInvite(Base):
    __tablename__ = "booking_invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32), default="interview")
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    candidate: Mapped[Candidate] = relationship(back_populates="invites")


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    recording_url: Mapped[str] = mapped_column(String(1000), default="")
    text: Mapped[str] = mapped_column(Text, default="")
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    error: Mapped[str] = mapped_column(Text, default="")
    report_drive_url: Mapped[str] = mapped_column(String(1000), default="")
    created_by: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    candidate: Mapped[Candidate] = relationship(back_populates="transcripts")


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    from_job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    to_job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    fit_score: Mapped[float] = mapped_column(Float, default=0)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="routed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    candidate: Mapped[Candidate] = relationship(back_populates="referrals")
    from_job: Mapped[Job] = relationship(foreign_keys=[from_job_id])
    to_job: Mapped[Job | None] = relationship(foreign_keys=[to_job_id])


class EmailMessage(Base):
    __tablename__ = "email_outbox"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True)
    to_email: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="logged")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True)
    actor: Mapped[str] = mapped_column(String(255), default="System")
    action: Mapped[str] = mapped_column(String(255))
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    candidate: Mapped[Candidate | None] = relationship(back_populates="activities")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=True)
