import { api } from './api';
import axios from 'axios';
import type { SimplifyApiResponse, ReadingLevel } from '../types/document';

/**
 * Simplify pasted text via POST /api/simplify/text
 */
export async function simplifyText(
  text: string,
  reading_level: ReadingLevel
): Promise<SimplifyApiResponse> {
  const response = await api.post<SimplifyApiResponse>('/api/simplify/text', {
    text,
    reading_level,
  }, {
    timeout: 60000,
  });
  return response.data;
}

/**
 * Simplify uploaded file via POST /api/simplify/file
 * NOTE: Do NOT set Content-Type manually — let browser/Axios handle multipart boundary.
 */
export async function simplifyFile(
  file: File,
  reading_level: ReadingLevel,
  onUploadProgress?: (percent: number) => void
): Promise<SimplifyApiResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('reading_level', reading_level);

  const response = await api.post<SimplifyApiResponse>('/api/simplify/file', formData, {
    timeout: 180000,
    onUploadProgress: (event) => {
      if (event.total) {
        onUploadProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    },
  });
  return response.data;
}

export async function synthesizeSpeech(text: string): Promise<Blob> {
  try {
    const response = await api.post<Blob>(
      '/api/speech/synthesize',
      { text },
      { responseType: 'blob', timeout: 90000 }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError<Blob>(error) && error.response?.data instanceof Blob) {
      let message: string | undefined;
      try {
        message = (JSON.parse(await error.response.data.text()) as { message?: string }).message;
      } catch {
        message = undefined;
      }
      if (message) throw new Error(message);
    }
    throw error;
  }
}

export async function transcribeVoiceQuestion(audio: Blob): Promise<string> {
  const formData = new FormData();
  const extension = audio.type.includes('webm')
    ? 'webm'
    : audio.type.includes('ogg')
      ? 'ogg'
      : audio.type.includes('mp4')
        ? 'm4a'
        : 'wav';
  formData.append('audio', audio, `voice-question.${extension}`);
  const response = await api.post<{
    success: boolean;
    data: { transcript: string };
    message: string;
  }>('/api/speech/transcribe', formData, { timeout: 90000 });
  return response.data.data.transcript;
}

export interface DocumentAnswer {
  answer: string;
  answerable: boolean;
  evidence: string[];
}

export async function askDocumentQuestion(
  documentText: string,
  question: string
): Promise<DocumentAnswer> {
  const response = await api.post<{
    success: boolean;
    data: DocumentAnswer;
    message: string;
  }>(
    '/api/document/ask',
    { document_text: documentText, question },
    { timeout: 60000 }
  );
  return response.data.data;
}

/**
 * Health check via GET /health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await api.get('/health', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
