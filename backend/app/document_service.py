from io import BytesIO
from pathlib import PurePath

import pymupdf
import pytesseract
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.config import settings

SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}
IMAGE_FORMATS = {
    ".png": "PNG",
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".webp": "WEBP",
}
MAX_PDF_PAGES = 100
MAX_IMAGE_PIXELS = 40_000_000
OCR_TIMEOUT_SECONDS = 30
MIN_SEARCHABLE_PAGE_CHARACTERS = 20


def _normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(
        character
        for character in text
        if character in "\n\t\f" or ord(character) >= 32
    )
    lines = [line.rstrip() for line in text.split("\n")]
    normalized = "\n".join(lines)
    while "\n\n\n" in normalized:
        normalized = normalized.replace("\n\n\n", "\n\n")
    return normalized.strip()


def _run_ocr(image: Image.Image) -> str:
    try:
        return pytesseract.image_to_string(
            image,
            lang="eng",
            timeout=OCR_TIMEOUT_SECONDS,
        )
    except pytesseract.TesseractNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="OCR is unavailable. Install the Tesseract OCR executable on the backend host.",
        ) from exc
    except (pytesseract.TesseractError, RuntimeError) as exc:
        raise HTTPException(
            status_code=422,
            detail="OCR could not read this image or PDF page. Try a clearer document.",
        ) from exc


def _open_image(content: bytes, expected_format: str) -> Image.Image:
    try:
        with Image.open(BytesIO(content)) as source:
            if source.format != expected_format:
                raise HTTPException(
                    status_code=400,
                    detail="The image content does not match its file extension.",
                )
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail="The image dimensions exceed the 40-megapixel processing limit.",
                )
            source.load()
            return source.convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(
            status_code=400, detail="The uploaded image is unreadable or damaged."
        ) from exc


def _extract_pdf(content: bytes) -> str:
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")

    page_texts: list[str] = []
    try:
        with pymupdf.open(stream=content, filetype="pdf") as document:
            if document.needs_pass:
                raise HTTPException(
                    status_code=400,
                    detail="The uploaded PDF is password-protected and cannot be read.",
                )
            if len(document) > MAX_PDF_PAGES:
                raise HTTPException(
                    status_code=413,
                    detail="The PDF exceeds the 100-page processing limit.",
                )
            for page in document:
                embedded_text = page.get_text("text").strip()
                if len(embedded_text) >= MIN_SEARCHABLE_PAGE_CHARACTERS:
                    page_texts.append(embedded_text)
                    continue

                rasterized_pixels = page.rect.width * page.rect.height * (200 / 72) ** 2
                if rasterized_pixels > MAX_IMAGE_PIXELS:
                    raise HTTPException(
                        status_code=413,
                        detail="A PDF page exceeds the 40-megapixel OCR processing limit.",
                    )
                pixmap = page.get_pixmap(dpi=200, alpha=False)
                image = Image.frombytes(
                    "RGB",
                    (pixmap.width, pixmap.height),
                    pixmap.samples,
                )
                ocr_text = _run_ocr(image).strip()
                page_texts.append(
                    ocr_text if len(ocr_text) > len(embedded_text) else embedded_text
                )
    except HTTPException:
        raise
    except (pymupdf.FileDataError, RuntimeError, ValueError, OSError) as exc:
        raise HTTPException(
            status_code=400, detail="The uploaded PDF is unreadable or damaged."
        ) from exc

    return "\n\n".join(page_texts)


def _extract_content(extension: str, content: bytes) -> str:
    if extension in {".txt", ".md"}:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            file_type = "Markdown" if extension == ".md" else "TXT"
            raise HTTPException(
                status_code=400, detail=f"The {file_type} file is not valid UTF-8 text."
            ) from exc
        if "\x00" in text:
            raise HTTPException(
                status_code=400, detail="The uploaded text file is not readable."
            )
        return text

    if extension == ".pdf":
        return _extract_pdf(content)

    expected_format = IMAGE_FORMATS[extension]
    image = _open_image(content, expected_format)
    return _run_ocr(image)


async def extract_document_text(file: UploadFile) -> tuple[str, str]:
    filename = PurePath((file.filename or "").replace("\\", "/")).name
    extension = PurePath(filename).suffix.lower()
    try:
        if extension not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail="Unsupported file type. Upload a PDF, TXT, Markdown, PNG, JPG, JPEG, or WebP file.",
            )

        content = await file.read(settings.max_upload_bytes + 1)
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail="The uploaded file exceeds the 10 MB size limit.",
            )
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        text = await run_in_threadpool(
            _extract_content,
            extension,
            content,
        )
    finally:
        await file.close()

    text = _normalize_text(text)
    if not text:
        readable_name = filename or "uploaded document"
        raise HTTPException(
            status_code=400,
            detail=f"No readable text was found in {readable_name}. Check that it contains text or a clear scan.",
        )
    if len(text) > settings.max_text_characters:
        raise HTTPException(
            status_code=413,
            detail="The extracted document text exceeds the 50,000-character processing limit.",
        )
    return filename or "document", text
