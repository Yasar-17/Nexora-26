import asyncio
import io
import unittest
from unittest.mock import AsyncMock, patch

import pymupdf
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont
from starlette.datastructures import UploadFile

from app.document_service import extract_document_text
from app.routes import app
from app.schemas import SimplificationData


def make_text_image(text: str) -> bytes:
    image = Image.new("RGB", (1800, 320), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 76)
    draw.text((40, 90), text, fill="black", font=font)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def make_blank_image() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (800, 400), "white").save(output, format="PNG")
    return output.getvalue()


def make_pdf(pages: list[tuple[str, bytes | None]]) -> bytes:
    document = pymupdf.open()
    for text, image in pages:
        page = document.new_page(width=612, height=792)
        if image:
            page.insert_image(page.rect, stream=image)
        else:
            page.insert_textbox(
                pymupdf.Rect(50, 50, 550, 180),
                text,
                fontsize=14,
            )
    output = document.tobytes()
    document.close()
    return output


class DocumentExtractionTests(unittest.TestCase):
    def extract(self, filename: str, content: bytes) -> str:
        upload = UploadFile(filename=filename, file=io.BytesIO(content))
        _, text = asyncio.run(extract_document_text(upload))
        return text

    def assert_upload_error(
        self, filename: str, content: bytes, expected_status: int
    ) -> None:
        upload = UploadFile(filename=filename, file=io.BytesIO(content))
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(extract_document_text(upload))
        self.assertEqual(raised.exception.status_code, expected_status)

    def test_searchable_pdf_and_mixed_scanned_pdf(self) -> None:
        searchable = "This searchable page contains the original application deadline."
        self.assertIn(
            "application deadline",
            self.extract("searchable.pdf", make_pdf([(searchable, None)])).lower(),
        )

        scanned_page = make_text_image("SCANNED PAGE APPLICATION DEADLINE")
        mixed_text = self.extract(
            "mixed.pdf",
            make_pdf(
                [
                    ("This page contains normal searchable PDF text.", None),
                    ("", scanned_page),
                ]
            ),
        ).lower()
        self.assertIn("searchable pdf text", mixed_text)
        self.assertIn("scanned page application deadline", mixed_text)

    def test_image_formats_use_ocr(self) -> None:
        png = make_text_image("IMAGE OCR DEADLINE")
        self.assertIn("image ocr deadline", self.extract("notice.png", png).lower())

        source = Image.open(io.BytesIO(png)).convert("RGB")
        for extension, image_format in (
            ("jpg", "JPEG"),
            ("jpeg", "JPEG"),
            ("webp", "WEBP"),
        ):
            output = io.BytesIO()
            source.save(output, format=image_format, quality=95)
            self.assertIn(
                "image ocr deadline",
                self.extract(f"notice.{extension}", output.getvalue()).lower(),
            )

    def test_text_and_markdown_are_normalized(self) -> None:
        self.assertEqual(
            self.extract("notice.txt", b"\xef\xbb\xbfFirst line.\r\n\r\n\r\nSecond line."),
            "First line.\n\nSecond line.",
        )
        self.assertEqual(
            self.extract("notice.md", b"# Heading\r\n\r\n- Important item"),
            "# Heading\n\n- Important item",
        )

    def test_rejects_unsupported_mismatched_corrupted_and_empty_files(self) -> None:
        self.assert_upload_error("notice.docx", b"not supported", 415)
        self.assert_upload_error("notice.png", b"plain text", 400)
        self.assert_upload_error("notice.pdf", b"%PDF-damaged", 400)
        self.assert_upload_error("notice.txt", b"", 400)
        self.assert_upload_error("blank.pdf", make_pdf([("", None)]), 400)
        self.assert_upload_error("broken.png", b"not a PNG", 400)
        self.assert_upload_error("blank.png", make_blank_image(), 400)

    def test_rejects_oversized_uploads(self) -> None:
        self.assert_upload_error(
            "large.txt",
            b"x" * (10 * 1024 * 1024 + 1),
            413,
        )

    def test_reports_ocr_failures_without_exposing_provider_details(self) -> None:
        with patch(
            "app.document_service.pytesseract.image_to_string",
            side_effect=RuntimeError("private OCR subprocess details"),
        ):
            upload = UploadFile(
                filename="notice.png",
                file=io.BytesIO(make_text_image("OCR FAILURE TEST")),
            )
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(extract_document_text(upload))
        self.assertEqual(raised.exception.status_code, 422)
        self.assertNotIn("private OCR", str(raised.exception.detail))

    def test_file_endpoint_keeps_the_shared_response_schema(self) -> None:
        expected_data = SimplificationData(
            document_name="guide.md",
            original_text="# Guide\n\nSubmit the form.",
            simplified_text="Send in the form.",
            summary="The form must be submitted.",
            key_points=[],
            action_items=["Submit the form."],
            deadlines=[],
            difficult_terms=[],
            reading_level="simple",
            warnings=[],
        )
        with patch(
            "app.routes.simplify_document",
            new=AsyncMock(return_value=expected_data),
        ):
            response = TestClient(app).post(
                "/api/simplify/file",
                files={
                    "file": (
                        "guide.md",
                        b"# Guide\r\n\r\nSubmit the form.",
                        "text/markdown",
                    )
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(
            set(body),
            {"success", "data", "message"},
        )
        self.assertEqual(body["data"]["document_name"], "guide.md")
        self.assertEqual(body["data"]["original_text"], "# Guide\n\nSubmit the form.")
        self.assertEqual(
            set(body["data"]),
            {
                "document_name",
                "original_text",
                "simplified_text",
                "summary",
                "key_points",
                "action_items",
                "deadlines",
                "difficult_terms",
                "reading_level",
                "warnings",
            },
        )


if __name__ == "__main__":
    unittest.main()
