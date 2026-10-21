from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEFAULT_SETTINGS, Role
from app.core.config import settings
from app.core.security import hash_password
from app.models import AppSetting, Job, User
from app.seed_data import JOBS


def _ensure_user(db: Session, email: str, name: str, role: str, password: str) -> None:
    if db.scalar(select(User).where(User.email == email.lower())):
        return
    db.add(User(email=email.lower(), name=name, role=role, password_hash=hash_password(password)))


def seed(db: Session) -> None:
    _ensure_user(db, settings.ADMIN_EMAIL, settings.ADMIN_NAME, Role.ADMIN, settings.ADMIN_PASSWORD)
    if settings.SEED_DEMO_USERS:
        _ensure_user(db, "ali@paragon.local", "Ali", Role.HR, settings.DEMO_PASSWORD)
        _ensure_user(db, "anton@paragon.local", "Dr. Anton", Role.VIEWER, settings.DEMO_PASSWORD)

    existing = set(db.scalars(select(Job.slug)))
    for job in JOBS:
        if job["slug"] not in existing:
            db.add(Job(**job))

    present = set(db.scalars(select(AppSetting.key)))
    for key, value in DEFAULT_SETTINGS.items():
        if key not in present:
            db.add(AppSetting(key=key, value=value))

    db.commit()
