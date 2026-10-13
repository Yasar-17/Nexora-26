# Nexora-26 backend

FastAPI service for extracting text from documents and images and returning an
AI-generated accessible rewrite. The OpenRouter API key stays on the server.

## Setup

Requires Python 3.10 or newer.
OCR requires the Tesseract executable and English language data on the backend
host. For Debian/Ubuntu deployments, install them before Python dependencies:

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
```

Voice transcription additionally requires `ffmpeg` on the backend host to
decode browser-recorded audio formats. The English Vosk recognition
model is bundled locally under `vendor/vosk-model-small-en-us-0.15`; voice
transcription does not download a model or use a hosted speech service.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Replace the `your_openrouter_api_key_here` placeholder with a valid OpenRouter
API key in `.env` before using either simplification endpoint. A placeholder is
detected and reported as a configuration error rather than sent to the provider.
Do not commit `.env`. Edit `OPENROUTER_MODEL` if a different model is preferred.

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or run `python main.py`; both use the configured `HOST` and `PORT`. The health
endpoint does not require an AI key.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | unset | Required server-side key for simplification |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | OpenRouter model identifier |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8000` | Bind port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed browser origins |

The API accepts at most 10 MB per upload and 50,000 characters of extracted
or pasted text. Uploads may be PDF, UTF-8 TXT, Markdown (`.md`), PNG, JPG/JPEG,
or WebP. PDF text is extracted page by page; pages without enough embedded text
are rendered and OCR-processed locally with Tesseract. Images are also OCR
processed locally. PDFs are limited to 100 pages and image/OCR pages to 40
megapixels for resource safety. OCR uses English (`eng`) and requires the
Tesseract executable and its English language data; no temporary upload files
or hosted OCR service are used.

## Offline read aloud

Read-aloud audio is synthesized locally by the bundled eSpeak NG engine and
English voice data. It does not call a cloud TTS service, download voices, or
depend on browser speech voices. The included runtime targets x86-64 Linux;
the host still needs its standard Linux shared libraries. See
[`vendor/espeak/README.md`](vendor/espeak/README.md) for version and license
notices.

## Offline voice question input

Voice questions are recorded with the browser's microphone capture API and
uploaded directly to this backend. The backend converts the recording with
`ffmpeg` and transcribes it using the bundled Vosk `small-en-us-0.15` model.
Audio is not sent to a browser speech-recognition service or third-party speech
provider. Microphone access requires the user to grant browser permission and
works on localhost or a secure (HTTPS) frontend origin. The bundled model
recognizes US English; microphone capture requires a browser/device with
`getUserMedia` and `MediaRecorder` support. Older or incompatible devices can
still type their questions.

### `POST /api/speech/transcribe`

Accepts multipart form data with `audio` (WebM, Ogg, MP4, WAV, FLAC, or MP3;
maximum 10 MB and 60 seconds). Returns:

```json
{
  "success": true,
  "data": {"transcript": "What is the application deadline?"},
  "message": "Audio transcribed locally."
}
```

The bundled Vosk model includes its upstream model README at
`vendor/vosk-model-small-en-us-0.15/README`.

## API

### `GET /health`

Returns `{"success": true, "message": "Backend is healthy"}`.

### `POST /api/simplify/text`

JSON request:

```json
{"text": "The document content", "reading_level": "simple"}
```

`reading_level` is `simple`, `very_simple`, or `detailed` and defaults to
`simple`.

### `POST /api/simplify/file`

Multipart form fields: `file` (PDF, TXT, Markdown, PNG, JPG/JPEG, or WebP) and
optional `reading_level` (same values and default as above). Files are validated
by both extension and content; extraction and OCR errors are returned in the
standard error response.

Both simplification routes return:

```json
{
  "success": true,
  "data": {
    "document_name": "Pasted text",
    "original_text": "The document content",
    "simplified_text": "A plain-language rewrite.",
    "summary": "The document's main idea.",
    "key_points": [],
    "action_items": [],
    "deadlines": [],
    "difficult_terms": [],
    "reading_level": "simple",
    "warnings": []
  },
  "message": "Document simplified successfully."
}
```

Errors use `{"success": false, "data": null, "message": "..."}` and an
appropriate 4xx or 5xx status.

### `POST /api/speech/synthesize`

Accepts JSON `{"text": "Text to read aloud"}` (up to 50,000 characters) and
returns locally generated WAV audio (`audio/wav`). No third-party speech
service is used.

### `POST /api/document/ask`

Accepts the source document text and a question:

```json
{
  "document_text": "The original document content",
  "question": "What is the application deadline?"
}
```

Both fields are required. Document text is limited to 50,000 characters and
questions to 2,000 characters. Successful answers include exact supporting
quotes copied from the source. If the topic is outside the document or the
document does not contain the answer, the API returns a fixed refusal instead
of using outside knowledge. Document text is treated as untrusted data, not as
instructions to the model.

```json
{
  "success": true,
  "data": {
    "answer": "Applications are due on 30 October 2026.",
    "answerable": true,
    "evidence": ["Applications must be submitted by 30 October 2026."]
  },
  "message": "Question answered using the provided document."
}
```
