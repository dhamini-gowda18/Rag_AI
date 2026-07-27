from typing import Generator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError
from app.core.security import decode_access_token
from app.db.database import SessionLocal
from app.db.models import User

security = HTTPBearer()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except JWTError as exc:
        raise AuthenticationError("Invalid or expired token") from exc

    user_id = payload.get("sub")
    if user_id is None:
        raise AuthenticationError("Token missing subject")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise AuthenticationError("User not found")
    return user
