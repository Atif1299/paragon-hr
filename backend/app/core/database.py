import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# On Vercel each function instance is short-lived and connects through Supabase's
# transaction pooler, which does not support prepared statements or long-held pools.
if os.environ.get("VERCEL"):
    engine = create_engine(settings.DATABASE_URL, poolclass=NullPool, connect_args={"prepare_threshold": None})
else:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
