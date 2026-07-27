import json
import os
from pathlib import Path
from typing import Iterable

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.db.models import Document, DocumentChunk


class DocumentService:
    def __init__(self, db: Session):
        self.db = db
        self._model: SentenceTransformer | None = None
        self.storage_dir = Path(settings.storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = Path(settings.vector_index_path)
        self.metadata_path = Path(settings.vector_metadata_path)
        self._ensure_index()

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(settings.model_name)
        return self._model

    def _ensure_index(self) -> None:
        if not self.index_path.exists():
            dimension = 384
            index = faiss.IndexFlatL2(dimension)
            faiss.write_index(index, str(self.index_path))
            self._write_metadata([])

    def _write_metadata(self, metadata: list[dict]) -> None:
        self.metadata_path.write_text(json.dumps(metadata), encoding="utf-8")

    def _read_metadata(self) -> list[dict]:
        if not self.metadata_path.exists():
            return []
        return json.loads(self.metadata_path.read_text(encoding="utf-8"))

    def _save_metadata(self, metadata: list[dict]) -> None:
        self._write_metadata(metadata)

    def chunk_text(self, text: str, chunk_size: int = 700, overlap: int = 80) -> list[str]:
        words = text.split()
        chunks: list[str] = []
        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk = " ".join(words[start:end])
            if chunk:
                chunks.append(chunk)
            if end == len(words):
                break
            start = max(0, end - overlap)
        return chunks

    def create_document(self, owner_id: int, filename: str, content_type: str, text: str) -> Document:
        document_dir = self.storage_dir / str(owner_id)
        document_dir.mkdir(parents=True, exist_ok=True)
        storage_path = str(document_dir / filename)
        Path(storage_path).write_text(text, encoding="utf-8")

        document = Document(
            filename=filename,
            content_type=content_type,
            storage_path=storage_path,
            owner_id=owner_id,
        )
        self.db.add(document)
        self.db.flush()

        chunks = self.chunk_text(text)
        for idx, chunk in enumerate(chunks):
            self.db.add(DocumentChunk(document_id=document.id, chunk_index=idx, text=chunk))

        self.db.commit()
        self.db.refresh(document)
        self._index_chunks(document.id)
        return document

    def _index_chunks(self, document_id: int) -> None:
        chunks = self.db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).all()
        if not chunks:
            return
        texts = [chunk.text for chunk in chunks]
        embeddings = self._get_model().encode(texts, convert_to_numpy=True)
        index = faiss.read_index(str(self.index_path))
        metadata = self._read_metadata()
        for chunk, embedding in zip(chunks, embeddings):
            vector = np.asarray(embedding, dtype=np.float32).reshape(1, -1)
            index.add(vector)
            metadata.append({"document_id": str(document_id), "chunk_id": chunk.id, "text": chunk.text})
        faiss.write_index(index, str(self.index_path))
        self._save_metadata(metadata)

    def search(self, query: str, top_k: int = 4) -> list[dict]:
        if not self.index_path.exists():
            return []
        query_embedding = self._get_model().encode([query], convert_to_numpy=True)[0].astype(np.float32).reshape(1, -1)
        index = faiss.read_index(str(self.index_path))
        distances, indices = index.search(query_embedding, min(top_k, index.ntotal))
        metadata = self._read_metadata()
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0:
                continue
            item = metadata[int(idx)]
            results.append({"text": item.get("text", ""), "score": float(dist), "document_id": item.get("document_id")})
        return results
