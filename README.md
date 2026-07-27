# FastAPI AI RAG Assignment

This project implements a production-ready FastAPI application with PostgreSQL, SQLAlchemy, Alembic, JWT authentication, document upload, chunking, sentence-transformer embeddings, FAISS vector search, and a Gemini-backed RAG chat endpoint.

## Features
- FastAPI app with clean architecture
- SQLLite + SQLAlchemy models
- Alembic migrations
- JWT signup/login
- Password hashing with bcrypt
- Document upload and text chunking
- Sentence transformer embeddings using all-MiniLM-L6-v2
- FAISS vector index storage
- RAG chat endpoint backed by Gemini API
- Error logging middleware storing failures in PostgreSQL

## Project Structure
- app/api: route modules
- app/core: settings, security, exceptions
- app/db: database/session/models
- app/services: document and rag business logic
- app/schemas: Pydantic schemas
- app/middleware: exception logging middleware

## Setup
1. Create and activate a virtual environment.
2. Install requirements: `pip install -r requirements.txt`
3. Create a PostgreSQL database named `ragdb`.
4. Copy `.env.example` to `.env` and adjust values.
5. Run migrations: `alembic upgrade head`
6. Start the API: `uvicorn main:app --reload`

## API Endpoints
- POST /api/auth/signup
- POST /api/auth/login
- GET /api/auth/me
- POST /api/documents/upload
- POST /api/documents/chat
- GET /health

## Notes
- The Gemini API key is optional for local development; the endpoint will return a fallback message if missing.
- For production, replace the default JWT secret and database credentials.
