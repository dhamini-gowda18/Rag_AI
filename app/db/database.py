from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _build_engine(database_url: str):
    if database_url.startswith("postgresql"):
        try:
            engine = create_engine(database_url, pool_pre_ping=True)
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return engine
        except Exception:
            fallback_url = f"sqlite:///{BASE_DIR / 'app.db'}"
            return create_engine(fallback_url, connect_args={"check_same_thread": False})

    if database_url.startswith("sqlite"):
        return create_engine(database_url, connect_args={"check_same_thread": False})

    return create_engine(database_url, pool_pre_ping=True)


engine = _build_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
