import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { LoaderCircle, MessageCircle, Mic, MicOff, Send } from 'lucide-react';
import {
  askDocumentQuestion,
  transcribeVoiceQuestion,
  type DocumentAnswer,
} from '../services/documentApi';

interface QuestionEntry {
  question: string;
  response: DocumentAnswer;
}

interface DocumentQuestionProps {
  documentText: string;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ??
      'Could not get an answer from the document. Please try again.'
    );
  }
  return error instanceof Error
    ? error.message
    : 'Could not get an answer from the document. Please try again.';
}

export const DocumentQuestion: React.FC<DocumentQuestionProps> = ({
  documentText,
}) => {
  const [voiceInputAvailable] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined'
  );
  const [question, setQuestion] = useState('');
  const [entries, setEntries] = useState<QuestionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording') {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopRecording = () => {
    if (recordingTimer.current !== null) {
      window.clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleVoiceInput = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (!voiceInputAvailable) {
      setVoiceError(
        'This browser cannot record microphone audio. Use a modern browser or type your question instead.'
      );
      return;
    }

    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (mountedRef.current) {
          setVoiceError('Microphone recording failed. Check microphone access and try again.');
          setIsRecording(false);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        if (chunks.length === 0) {
          setVoiceError('No audio was recorded. Check your microphone and try again.');
          return;
        }

        setIsTranscribing(true);
        try {
          const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const transcript = await transcribeVoiceQuestion(audio);
          if (!mountedRef.current) return;
          setQuestion(transcript.slice(0, 2000));
        } catch (transcriptionError: unknown) {
          if (!mountedRef.current) return;
          setVoiceError(
            transcriptionError instanceof Error
              ? transcriptionError.message
              : 'The backend could not transcribe the recording. Please try again.'
          );
        } finally {
          if (mountedRef.current) setIsTranscribing(false);
        }
      };
      recorder.start(250);
      setIsRecording(true);
      recordingTimer.current = window.setTimeout(stopRecording, 60_000);
    } catch (recordingError: unknown) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (!mountedRef.current) return;
      if (
        recordingError instanceof DOMException &&
        (recordingError.name === 'NotAllowedError' ||
          recordingError.name === 'SecurityError')
      ) {
        setVoiceError(
          'Microphone access was denied. Allow microphone access in your browser settings and try again.'
        );
      } else if (
        recordingError instanceof DOMException &&
        recordingError.name === 'NotFoundError'
      ) {
        setVoiceError('No microphone was found. Connect a microphone or type your question.');
      } else if (
        recordingError instanceof DOMException &&
        recordingError.name === 'NotReadableError'
      ) {
        setVoiceError('The microphone is busy or unavailable. Close other apps using it and try again.');
      } else {
        setVoiceError(
          'Could not start microphone recording. Microphone access requires HTTPS or localhost and browser permission.'
        );
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || isLoading) return;

    setIsLoading(true);
    setError(null);
    setVoiceError(null);
    try {
      const response = await askDocumentQuestion(documentText, submittedQuestion);
      setEntries((current) => [...current, { question: submittedQuestion, response }]);
      setQuestion('');
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="document-question-heading"
      className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-4"
    >
      <div>
        <h3
          id="document-question-heading"
          className="flex items-center gap-2 text-base font-semibold text-slate-900"
        >
          <MessageCircle className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          Ask about this document
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Answers use only this document. Questions outside its topic or details
          it does not contain will be declined.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Voice audio is transcribed by the backend’s bundled offline English
          speech model. Allow microphone access, record up to 60 seconds, and
          stop to transcribe. Audio stays on your backend.
        </p>
      </div>

      {entries.length > 0 && (
        <ol className="space-y-3" aria-label="Questions and answers">
          {entries.map((entry, index) => (
            <li
              key={`${index}-${entry.question}`}
              className="space-y-2 rounded-lg border border-indigo-100 bg-white p-4"
            >
              <p className="text-sm font-semibold text-slate-800">
                <span className="text-indigo-700">Question: </span>
                {entry.question}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                <span className="font-semibold text-indigo-700">Answer: </span>
                {entry.response.answer}
              </p>
              {entry.response.evidence.length > 0 && (
                <div className="border-l-2 border-indigo-300 pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    From the document
                  </p>
                  <ul className="mt-1 space-y-1">
                    {entry.response.evidence.map((quote, quoteIndex) => (
                      <li key={`${quoteIndex}-${quote}`} className="text-xs text-slate-600">
                        “{quote}”
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <label
          htmlFor="document-question-input"
          className="block text-sm font-medium text-slate-700"
        >
          Your question
        </label>
        <textarea
          id="document-question-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={2000}
          rows={2}
          disabled={isLoading || isRecording || isTranscribing}
          placeholder="For example: What is the application deadline?"
          className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500" aria-live="polite">
            {question.length.toLocaleString()} / 2,000 characters
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {voiceInputAvailable ? (
              <button
                type="button"
                onClick={() => void toggleVoiceInput()}
                disabled={isLoading || isTranscribing}
                aria-label={isRecording ? 'Stop voice recording' : 'Ask by voice'}
                aria-pressed={isRecording}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isRecording
                    ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:outline-red-600'
                    : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 focus-visible:outline-indigo-600'
                }`}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                {isRecording
                  ? 'Stop recording'
                  : isTranscribing
                    ? 'Transcribing…'
                    : 'Ask by voice'}
              </button>
            ) : (
              <span className="text-xs text-slate-500">
                Microphone recording is not supported in this browser.
              </span>
            )}
            <button
              type="submit"
              disabled={isLoading || isRecording || isTranscribing || !question.trim()}
              aria-busy={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Checking document…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Ask question
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {isRecording && (
        <p role="status" aria-live="polite" className="text-sm text-indigo-700">
          Recording… Speak your question, then choose Stop recording. Maximum
          recording length is 60 seconds.
        </p>
      )}
      {isTranscribing && (
        <p role="status" aria-live="polite" className="text-sm text-indigo-700">
          Transcribing locally on the backend…
        </p>
      )}
      {voiceError && (
        <p role="alert" className="text-sm text-amber-800">
          {voiceError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
};
