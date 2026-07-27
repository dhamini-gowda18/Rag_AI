import traceback
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models import ErrorLog, User

class ExceptionLoggingMiddleware:
    def __init__(self, app: FastAPI) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        try:
            await self.app(scope, receive, send)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            print(exc)
            
            db: Session = SessionLocal()
            user_id = None
            try:
                auth_header = request.headers.get("authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    token = auth_header.split(" ", 1)[1]
                    try:
                        user_id = int(token.split(".")[0])
                    except ValueError:
                        user_id = None
                db.add(
                    ErrorLog(
                        user_id=user_id,
                        message=str(exc),
                        stack_trace=traceback.format_exc(),
                    )
                )
                db.commit()
            finally:
                db.close()

            response = JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            await response(scope, receive, send)
            return
