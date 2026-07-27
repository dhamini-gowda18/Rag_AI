import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.core.config import settings
from app.db.database import Base, engine
from app.middleware.error_logging import ExceptionLoggingMiddleware

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(ExceptionLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    Base.metadata.create_all(bind=engine)
except OperationalError as exc:
    print(f"Database initialization skipped: {exc}")

app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(documents_router, prefix=settings.api_prefix)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
