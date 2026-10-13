import asyncio
import json
import logging
import subprocess
import threading
from pathlib import Path

from fastapi import HTTPException
from vosk import KaldiRecognizer, Model, SetLogLevel

logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BACKEND_DIR / "vendor" / "vosk-model-small-en-us-0.15"
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_AUDIO_SECONDS = 60
SAMPLE_RATE = 16_000

_model: Model | None = None
_model_lock = threading.Lock()


def _get_model() -> Model:
    global _model
    with _model_lock:
        if _model is None:
            if not (MODEL_PATH / "am" / "final.mdl").is_file():
                raise HTTPException(
                    status_code=503,
                    detail="The bundled offline speech model is missing.",
                )
            SetLogLevel(-1)
            try:
                _model = Model(str(MODEL_PATH))
            except (RuntimeError, OSError) as exc:
                logger.error("Could not load the bundled offline speech model.")
                raise HTTPException(
                    status_code=503,
                    detail="The offline speech model could not be loaded.",
                ) from exc
    return _model


def _decode_audio(audio: bytes) -> bytes:
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-nostdin",
                "-v",
                "error",
                "-i",
                "pipe:0",
                "-map",
                "0:a:0",
                "-ac",
                "1",
                "-ar",
                str(SAMPLE_RATE),
                "-t",
                str(MAX_AUDIO_SECONDS + 1),
                "-f",
                "s16le",
                "pipe:1",
            ],
            input=audio,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="Local audio decoding is unavailable because ffmpeg is not installed on the backend.",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=400, detail="Audio conversion took too long.") from exc
    if result.returncode != 0:
        raise HTTPException(
            status_code=400,
            detail="The recording could not be decoded. Record a new audio clip and try again.",
        )
    max_pcm_bytes = MAX_AUDIO_SECONDS * SAMPLE_RATE * 2
    if len(result.stdout) > max_pcm_bytes:
        raise HTTPException(
            status_code=413, detail="Voice recordings must be 60 seconds or shorter."
        )
    if not result.stdout:
        raise HTTPException(status_code=400, detail="The recording contains no audio.")
    return result.stdout


def _transcribe(audio: bytes) -> str:
    if not audio:
        raise HTTPException(status_code=400, detail="The audio recording is empty.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio recordings must not exceed 10 MB.")
    supported_signatures = (
        b"\x1a\x45\xdf\xa3",  # WebM/Matroska
        b"OggS",  # Ogg
        b"RIFF",  # WAV
        b"fLaC",  # FLAC
        b"ID3",  # MP3
    )
    if not any(audio.startswith(signature) for signature in supported_signatures) and not (
        len(audio) >= 12 and audio[4:8] == b"ftyp"
    ):
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio format. Record audio in a supported browser format and try again.",
        )

    pcm_bytes = _decode_audio(audio)
    try:
        recognizer = KaldiRecognizer(_get_model(), SAMPLE_RATE)
        recognizer.SetWords(False)
        for offset in range(0, len(pcm_bytes), SAMPLE_RATE * 2):
            recognizer.AcceptWaveform(pcm_bytes[offset : offset + SAMPLE_RATE * 2])
        result = json.loads(recognizer.FinalResult())
    except (json.JSONDecodeError, RuntimeError) as exc:
        logger.error("Could not transcribe converted voice recording.")
        raise HTTPException(
            status_code=500, detail="The audio could not be transcribed."
        ) from exc

    transcript = result.get("text", "").strip()
    if not transcript:
        raise HTTPException(
            status_code=422,
            detail="No speech was detected. Speak clearly and try recording again.",
        )
    return transcript


async def transcribe_audio(audio: bytes) -> str:
    return await asyncio.to_thread(_transcribe, audio)
