import logging

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError

from app.ai_service import simplify_document
from app.config import settings
from app.document_service import extract_document_text
from app.question_service import answer_document_question
from app.speech_service import synthesize_speech
from app.transcription_service import MAX_AUDIO_BYTES, transcribe_audio
from app.schemas import (
    AudioTranscriptionResponse,
    DocumentAnswerData,
    DocumentAnswerResponse,
    DocumentQuestionRequest,
    ErrorResponse,
    ReadingLevel,
    SpeechRequest,
    SimplificationResponse,
    SimplifyTextRequest,
)

logger = logging.getLogger(__name__)
app = FastAPI(title="Nexora-26 Document Simplifier API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def error_response(status_code: int, message: str) -> JSONResponse:
    body = ErrorResponse(message=message).model_dump()
    return JSONResponse(status_code=status_code, content=body)


@app.middleware("http")
async def reject_oversized_requests(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            too_large = int(content_length) > settings.max_upload_bytes + 1024 * 1024
        except ValueError:
            return error_response(400, "Invalid Content-Length header.")
        if too_large:
            return error_response(413, "The request exceeds the 10 MB upload limit.")
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return error_response(exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    long_field = next(
        (
            error.get("loc", ())[-1]
            for error in errors
            if error.get("type") == "string_too_long"
        ),
        None,
    )
    if long_field == "question":
        return error_response(413, "Question exceeds the 2,000-character limit.")
    if long_field in {"text", "document_text"}:
        return error_response(413, "Text exceeds the 50,000-character processing limit.")
    message = errors[0].get("msg", "Invalid request.") if errors else "Invalid request."
    return error_response(422, message)


@app.exception_handler(ValidationError)
async def response_validation_exception_handler(
    _: Request, __: ValidationError
) -> JSONResponse:
    return error_response(502, "The AI service returned an invalid response.")


@app.exception_handler(Exception)
async def unexpected_exception_handler(_: Request, __: Exception) -> JSONResponse:
    logger.error("Unexpected server error while processing request.")
    return error_response(500, "An unexpected server error occurred.")


@app.get("/health")
async def health() -> dict[str, object]:
    return {"success": True, "message": "Backend is healthy"}


@app.post("/api/simplify/text", response_model=SimplificationResponse)
async def simplify_text(request: SimplifyTextRequest) -> SimplificationResponse:
    data = await simplify_document("Pasted text", request.text, request.reading_level)
    return SimplificationResponse(data=data)


@app.post("/api/simplify/file", response_model=SimplificationResponse)
async def simplify_file(
    file: UploadFile = File(...),
    reading_level: ReadingLevel = Form("simple"),
) -> SimplificationResponse:
    document_name, text = await extract_document_text(file)
    data = await simplify_document(document_name, text, reading_level)
    return SimplificationResponse(data=data)


@app.post("/api/speech/synthesize")
async def synthesize_speech_audio(request: SpeechRequest) -> Response:
    audio = await synthesize_speech(request.text)
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/speech/transcribe", response_model=AudioTranscriptionResponse)
async def transcribe_voice_question(
    audio: UploadFile = File(...),
) -> AudioTranscriptionResponse:
    content = await audio.read(MAX_AUDIO_BYTES + 1)
    transcript = await transcribe_audio(content)
    return AudioTranscriptionResponse(data={"transcript": transcript})


@app.post("/api/document/ask", response_model=DocumentAnswerResponse)
async def ask_document_question(
    request: DocumentQuestionRequest,
) -> DocumentAnswerResponse:
    data: DocumentAnswerData = await answer_document_question(
        request.document_text, request.question
    )
    return DocumentAnswerResponse(data=data)
