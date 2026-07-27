from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    id: int
    filename: str
    storage_path: str
    message: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
