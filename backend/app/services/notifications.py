import logging
import smtplib
from email.message import EmailMessage as MimeMessage

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Candidate, EmailMessage, Event

logger = logging.getLogger(__name__)


def smtp_enabled() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def send(db: Session, candidate: Candidate | None, to_email: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage(
        candidate_id=candidate.id if candidate else None, to_email=to_email, subject=subject, body=body
    )
    if smtp_enabled():
        try:
            mime = MimeMessage()
            mime["From"] = settings.SMTP_FROM
            mime["To"] = to_email
            mime["Subject"] = subject
            mime.set_content(body)
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
                if settings.SMTP_USE_TLS:
                    smtp.starttls()
                if settings.SMTP_USER:
                    smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(mime)
            message.status = "sent"
        except Exception as exc:
            logger.exception("Email send failed")
            message.status = "failed"
            message.error = str(exc)
    db.add(message)
    return message


def _first_name(candidate: Candidate) -> str:
    return (candidate.full_name or "there").split()[0]


SIGNATURE = "\n\nKind regards,\nRecruitment Team\nParagon Global Internships"


def application_received(db: Session, candidate: Candidate) -> None:
    send(
        db,
        candidate,
        candidate.email,
        f"Application received – {candidate.job.title}",
        f"Dear {_first_name(candidate)},\n\nThank you for applying for the {candidate.job.title} role. "
        "We have received your application and our team is reviewing it. We will be in touch with next steps."
        + SIGNATURE,
    )


def questionnaire_invite(db: Session, candidate: Candidate, link: str) -> None:
    send(
        db,
        candidate,
        candidate.email,
        f"A few more questions – {candidate.job.title}",
        f"Dear {_first_name(candidate)},\n\nThank you for your application for {candidate.job.title}. "
        "Before we move forward, we would like to learn a little more about you. Please answer a short "
        f"questionnaire here:\n\n{link}" + SIGNATURE,
    )


def booking_invite(db: Session, candidate: Candidate, link: str, kind: str) -> None:
    label = "interview" if kind == "interview" else "assignment interview (demo session)"
    send(
        db,
        candidate,
        candidate.email,
        f"Book your {label} – {candidate.job.title}",
        f"Dear {_first_name(candidate)},\n\nCongratulations! You have been shortlisted for the next stage of the "
        f"{candidate.job.title} role. Please choose a time slot for your {label} using the link below:\n\n{link}"
        + SIGNATURE,
    )


def booking_confirmed(db: Session, candidate: Candidate, event: Event) -> None:
    when = event.starts_at.strftime("%A, %d %B %Y at %H:%M %Z")
    link = f"\nMeeting link: {event.meeting_link}" if event.meeting_link else ""
    send(
        db,
        candidate,
        candidate.email,
        f"Confirmed: {event.title}",
        f"Dear {_first_name(candidate)},\n\nYour session is confirmed.\n\nSession: {event.title}\nWhen: {when}"
        f"\nDuration: {event.duration_minutes} minutes{link}\n\nPlease join on time." + SIGNATURE,
    )


def referral_notice(db: Session, candidate: Candidate, new_job_title: str, old_job_title: str) -> None:
    send(
        db,
        candidate,
        candidate.email,
        f"Another opportunity for you – {new_job_title}",
        f"Dear {_first_name(candidate)},\n\nThank you for applying for {old_job_title}. After reviewing your "
        f"profile, we believe you may be a stronger fit for our {new_job_title} opening, so we have moved your "
        "application to that role. No action is needed from you; we will be in touch." + SIGNATURE,
    )
