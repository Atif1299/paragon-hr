import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.routers import auth, candidates, dashboard, events, jobs, public, settings as settings_router, users, webhooks
from app.seed import seed
from app.services import object_storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.PUBLIC_APP_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    object_storage.ensure_bucket()


@app.get("/api/health")
def health():
    return {"status": "ok"}


for module in (auth, users, jobs, candidates, events, dashboard, settings_router, public, webhooks):
    app.include_router(module.router)
