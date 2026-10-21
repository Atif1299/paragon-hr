from sqlalchemy.orm import Session

from app.models import ActivityLog


def log(db: Session, candidate_id: int | None, action: str, detail: str = "", actor: str = "System") -> None:
    db.add(ActivityLog(candidate_id=candidate_id, action=action, detail=detail, actor=actor))
