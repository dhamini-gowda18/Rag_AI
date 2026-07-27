import io

from pypdf import PdfReader

from fastapi import (
    APIRouter,
    Depends,
    File,
    UploadFile,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.schemas.document import (
    ChatRequest,
    ChatResponse,
    DocumentUploadResponse,
)
from app.services.document_service import DocumentService
from app.services.rag_service import RAGService

router = APIRouter(
    prefix="",
    tags=["documents"],
)


@router.post(
    "/documents/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentUploadResponse:

    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    content = file.file.read()

    if file.filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        text = content.decode("utf-8", errors="ignore")

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Uploaded file has no readable text",
        )

    service = DocumentService(db)

    document = service.create_document(
        owner_id=current_user.id,
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        text=text,
    )

    return DocumentUploadResponse(
        id=document.id,
        filename=document.filename,
        storage_path=document.storage_path,
        message="Document uploaded and indexed successfully",
    )


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:

    service = DocumentService(db)

    relevant_chunks = service.search(
        payload.question,
        top_k=4,
    )

    rag = RAGService()

    answer = rag.generate_answer(
        payload.question,
        relevant_chunks,
    )

    return ChatResponse(
        answer=answer,
        sources=[
            item.get("text", "")
            for item in relevant_chunks
        ],
    )