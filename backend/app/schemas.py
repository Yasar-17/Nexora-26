from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ReadingLevel = Literal["simple", "very_simple", "detailed"]


class SimplifyTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50_000)
    reading_level: ReadingLevel = "simple"

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text must not be empty.")
        return value


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50_000)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text must not be empty.")
        return value


class AudioTranscriptionResponse(BaseModel):
    success: Literal[True] = True
    data: dict[str, str]
    message: str = "Audio transcribed locally."


class DocumentQuestionRequest(BaseModel):
    document_text: str = Field(min_length=1, max_length=50_000)
    question: str = Field(min_length=1, max_length=2_000)

    @field_validator("document_text", "question")
    @classmethod
    def values_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field must not be empty.")
        return value


class DocumentAnswerContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["answered", "not_in_document", "outside_scope"]
    answer: str = Field(min_length=1)
    evidence: list[str]


class DocumentAnswerData(BaseModel):
    answer: str
    answerable: bool
    evidence: list[str]


class DocumentAnswerResponse(BaseModel):
    success: Literal[True] = True
    data: DocumentAnswerData
    message: str = "Question checked against the provided document."


class Deadline(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    description: str


class DifficultTerm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str
    explanation: str


class SimplificationContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    simplified_text: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    key_points: list[str]
    action_items: list[str]
    deadlines: list[Deadline]
    difficult_terms: list[DifficultTerm]
    warnings: list[str]


class SimplificationData(SimplificationContent):
    document_name: str
    original_text: str
    reading_level: ReadingLevel


class SimplificationResponse(BaseModel):
    success: Literal[True] = True
    data: SimplificationData
    message: str = "Document simplified successfully."


class ErrorResponse(BaseModel):
    success: Literal[False] = False
    data: None = None
    message: str
