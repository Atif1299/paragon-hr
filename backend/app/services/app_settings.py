from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEFAULT_SETTINGS
from app.models import AppSetting


def get_all(db: Session) -> dict[str, Any]:
    values = dict(DEFAULT_SETTINGS)
    for row in db.scalars(select(AppSetting)):
        values[row.key] = row.value
    return values


def update(db: Session, changes: dict[str, Any]) -> dict[str, Any]:
    for key, value in changes.items():
        if key not in DEFAULT_SETTINGS:
            continue
        row = db.get(AppSetting, key)
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=key, value=value))
    db.commit()
    return get_all(db)
