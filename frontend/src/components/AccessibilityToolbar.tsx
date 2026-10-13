import React, { useState, useEffect, useRef } from 'react';
import {
  Type,
  Volume2,
  Copy,
  Download,
  Check,
  Minus,
  Plus,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import { synthesizeSpeech } from '../services/documentApi';

interface AccessibilityToolbarProps {
  textToRead: string;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  documentName?: string;
}

export const AccessibilityToolbar: React.FC<AccessibilityToolbarProps> = ({
  textToRead,
  fontSize,
  onFontSizeChange,
  documentName = 'simplified-document',
}) => {
  const [speechState, setSpeechState] = useState<
    'idle' | 'loading' | 'ready' | 'playing' | 'paused'
  >('idle');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechSession = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      speechSession.current += 1;
      audio?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const toggleSpeech = () => {
    const audio = audioRef.current;
    if (speechState === 'playing') {
      audio?.pause();
      setSpeechState('paused');
      return;
    }
    if (speechState === 'paused') {
      void audio?.play().catch(() => {
        setSpeechError('Audio playback could not resume. Use the audio player controls to try again.');
      });
      return;
    }

    if (audioUrl && audio) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        setSpeechError('Audio playback could not start. Use the audio player controls to try again.');
      });
      return;
    }

    const session = ++speechSession.current;
    setSpeechError(null);
    setSpeechState('loading');
    void synthesizeSpeech(textToRead)
      .then((audioBlob) => {
        if (speechSession.current !== session) return;
        if (audioBlob.type !== 'audio/wav' || audioBlob.size === 0) {
          throw new Error('The backend returned an invalid audio file.');
        }
        const url = URL.createObjectURL(audioBlob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setSpeechState('ready');
        const player = audioRef.current;
        if (player) {
          player.src = url;
          player.load();
          void player.play().catch(() => {
            setSpeechError('Audio is ready. Press Play in the audio controls to start listening.');
          });
        }
      })
      .catch((error: unknown) => {
        if (speechSession.current !== session) return;
        setSpeechState('idle');
        setSpeechError(
          error instanceof Error ? error.message : 'Local speech generation failed.'
        );
      });
  };

  const stopSpeech = () => {
    speechSession.current += 1;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setSpeechState(audioUrl ? 'ready' : 'idle');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToRead);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silent fail
    }
  };

  const handleDownload = () => {
    const blob = new Blob([textToRead], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = documentName.replace(/\.[^.]+$/, '') + '-simplified.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const MIN_FONT = 14;
  const MAX_FONT = 26;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Accessibility controls"
    >
      {/* Font size */}
      <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-2 py-1 shadow-2xs">
        <Type className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
        <button
          onClick={() => onFontSizeChange(Math.max(MIN_FONT, fontSize - 2))}
          disabled={fontSize <= MIN_FONT}
          aria-label="Decrease text size"
          className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600 active:scale-95 transition-all cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 w-8 text-center" aria-live="polite">
          {fontSize}px
        </span>
        <button
          onClick={() => onFontSizeChange(Math.min(MAX_FONT, fontSize + 2))}
          disabled={fontSize >= MAX_FONT}
          aria-label="Increase text size"
          className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Read aloud */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={toggleSpeech}
          disabled={!textToRead.trim() || speechState === 'loading'}
          aria-label={
            speechState === 'playing'
              ? 'Pause reading aloud'
              : speechState === 'paused'
                ? 'Resume reading aloud'
                : speechState === 'loading'
                  ? 'Preparing read-aloud audio'
                  : 'Read displayed text aloud'
          }
          aria-pressed={speechState === 'playing'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed ${
            speechState === 'playing'
              ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 animate-pulse'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
        >
          {speechState === 'playing' ? (
            <Pause className="w-4 h-4" aria-hidden="true" />
          ) : speechState === 'paused' ? (
            <Play className="w-4 h-4" aria-hidden="true" />
          ) : speechState === 'loading' ? (
            <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
          ) : (
            <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          )}
          <span>
            {speechState === 'playing'
              ? 'Pause'
              : speechState === 'paused'
                ? 'Resume'
                : speechState === 'loading'
                ? 'Preparing audio…'
                : audioUrl
                  ? 'Play Again'
                  : 'Read Aloud'}
          </span>
        </button>
        {(speechState === 'playing' || speechState === 'paused') && (
          <button
            onClick={stopSpeech}
            aria-label="Stop reading aloud"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-red-600"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>Stop</span>
          </button>
        )}
      </div>
      {audioUrl && (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={audioUrl}
          aria-label="Read-aloud audio playback"
          className="basis-full w-full max-w-xl"
          onPlay={() => setSpeechState('playing')}
          onPause={(event) => {
            if (event.currentTarget.ended) {
              setSpeechState('ready');
            } else if (event.currentTarget.currentTime > 0) {
              setSpeechState('paused');
            }
          }}
          onEnded={() => setSpeechState('ready')}
          onError={() => {
            setSpeechState('ready');
            setSpeechError('The generated audio could not be played by this browser.');
          }}
        />
      )}

      {speechError && (
        <span className="basis-full text-xs text-red-600" role="alert">
          {speechError}
        </span>
      )}
      {speechState !== 'idle' && (
        <span className="sr-only" role="status" aria-live="polite">
          {speechState === 'loading'
            ? 'Preparing offline read-aloud audio.'
            : speechState === 'paused'
              ? 'Reading paused.'
              : speechState === 'ready'
                ? 'Audio is ready to play.'
                : speechState === 'playing'
                ? 'Reading aloud.'
                : ''}
        </span>
      )}

      {/* Copy */}
      <button
        onClick={handleCopy}
        aria-label="Copy simplified text to clipboard"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer shadow-2xs"
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
        )}
        <span>{copied ? 'Copied!' : 'Copy'}</span>
      </button>

      {/* Download */}
      <button
        onClick={handleDownload}
        aria-label="Download simplified text as a .txt file"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer shadow-2xs"
      >
        <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
        <span>Download .txt</span>
      </button>
    </div>
  );
};
