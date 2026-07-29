import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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


# Mount static files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")


from fastapi.responses import JSONResponse
from app.core.exceptions import AppError

@app.exception_handler(AppError)
def app_error_handler(request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message}
    )


@app.get("/")
def read_root():
    return FileResponse("frontend/index.html")
