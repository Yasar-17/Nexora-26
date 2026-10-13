import React, { useState, useEffect, useCallback } from 'react';
import { FileSearch2, WifiOff, Sun, Moon, Sparkles, ArrowRight } from 'lucide-react';
import { DocumentInput } from './components/DocumentInput';
import { ReadingLevelSelector } from './components/ReadingLevelSelector';
import { ResultsPanel } from './components/ResultsPanel';
import { simplifyText, simplifyFile, checkHealth } from './services/documentApi';
import type { ReadingLevel, AppState, SimplifiedDocument } from './types/document';

type BackendStatus = 'checking' | 'online' | 'offline';

export const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('simple');
  const [appState, setAppState] = useState<AppState>({ stage: 'idle' });
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');

  // Theme state: defaults to light ('light')
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark'; // Light theme by default unless explicitly saved as 'dark'
    }
    return false;
  });

  // Apply or remove .dark class on <html> document element
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Check backend health on mount
  useEffect(() => {
    checkHealth().then((ok) => setBackendStatus(ok ? 'online' : 'offline'));
  }, []);

  const hasInput = selectedFile !== null || pastedText.trim().length > 0;
  const isLoading = appState.stage === 'loading';

  const handleSubmit = useCallback(async () => {
    setValidationError(null);

    if (!hasInput) {
      setValidationError('Please upload a file or paste some text before submitting.');
      return;
    }

    setUploadProgress(selectedFile ? 0 : null);
    setProcessingStatus(selectedFile ? 'Preparing upload…' : '');
    setAppState({ stage: 'loading' });

    try {
      let response;
      if (selectedFile) {
        response = await simplifyFile(selectedFile, readingLevel, (percent) => {
          setUploadProgress(percent);
          setProcessingStatus(
            percent >= 100
              ? 'Upload complete. Extracting text and simplifying…'
              : 'Uploading file…'
          );
        });
      } else {
        response = await simplifyText(pastedText.trim(), readingLevel);
      }

      if (response.success && response.data) {
        setAppState({ stage: 'success', result: response.data as SimplifiedDocument });
      } else {
        setAppState({
          stage: 'error',
          message: response.message ?? 'The AI service returned an unexpected response.',
          detail: 'Please try again or use different input.',
        });
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; detail?: string }; status?: number };
        request?: unknown;
        message?: string;
      };

      if (axiosErr.response) {
        const status = axiosErr.response.status;
        const msg = axiosErr.response.data?.message ?? 'The server returned an error.';
        const detail = axiosErr.response.data?.detail;
        if (status === 422) {
          setAppState({
            stage: 'error',
            message: 'The document could not be read or processed.',
            detail: detail ?? msg,
          });
        } else {
          setAppState({ stage: 'error', message: msg, detail: detail });
        }
      } else if (axiosErr.request) {
        setAppState({
          stage: 'error',
          message: 'Cannot reach the backend server.',
          detail:
            'Make sure the backend is running at http://localhost:8000.',
        });
        setBackendStatus('offline');
      } else {
        setAppState({
          stage: 'error',
          message: axiosErr.message ?? 'An unexpected error occurred.',
        });
      }
    } finally {
      setUploadProgress(null);
      setProcessingStatus('');
    }
  }, [hasInput, selectedFile, pastedText, readingLevel]);

  const handleReset = () => {
    setAppState({ stage: 'idle' });
    setSelectedFile(null);
    setPastedText('');
    setValidationError(null);
    setUploadProgress(null);
    setProcessingStatus('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50/80 to-slate-100/70 dark:from-slate-950 dark:via-slate-900/90 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-250">
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium shadow-lg"
      >
        Skip to main content
      </a>

      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors shadow-xs" role="banner">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 ring-1 ring-white/20 transition-transform hover:scale-105 duration-200"
              aria-hidden="true"
            >
              <FileSearch2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight leading-none block">
                AccessibleDoc AI
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                Document Accessibility Reader
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Backend status indicator */}
            <div aria-live="polite" aria-atomic="true">
              {backendStatus === 'online' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 font-medium shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Backend online
                </span>
              )}
              {backendStatus === 'offline' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 font-medium shadow-2xs">
                  <WifiOff className="w-3 h-3 text-red-500" />
                  Backend offline
                </span>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:shadow-xs active:scale-95 transition-all duration-150 cursor-pointer"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-45 duration-300" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 transition-transform rotate-0 hover:-rotate-12 duration-300" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 animate-fade-in">
        {appState.stage !== 'success' && (
          <>
            <div className="mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                AI Document Simplification
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                Understand any document,{' '}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  in plain language
                </span>
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400 text-base max-w-2xl leading-relaxed">
                Upload a PDF, text/Markdown file, or image, or paste text. Scanned pages and images are read with OCR; our AI rewrites the content in clear language and
                highlights key points, action items, and deadlines.
              </p>
            </div>

            {/* Offline banner */}
            {backendStatus === 'offline' && (
              <div
                role="alert"
                className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/40 text-orange-900 dark:text-orange-200 shadow-xs"
              >
                <WifiOff className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Backend not reachable</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Make sure the backend server is running at{' '}
                    <code className="font-mono bg-orange-100 dark:bg-orange-900/50 px-1.5 py-0.5 rounded text-xs">http://localhost:8000</code>.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 space-y-8 shadow-sm hover:shadow-md transition-shadow duration-300">
              {/* Document input */}
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">1</span>
                  Add your document
                </h2>
                <DocumentInput
                  selectedFile={selectedFile}
                  pastedText={pastedText}
                  onFileChange={setSelectedFile}
                  onTextChange={setPastedText}
                  disabled={isLoading}
                  uploadProgress={uploadProgress}
                  processingStatus={processingStatus}
                />
              </div>

              {/* Reading level */}
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">2</span>
                  Choose reading level
                </h2>
                <ReadingLevelSelector
                  value={readingLevel}
                  onChange={setReadingLevel}
                  disabled={isLoading}
                />
              </div>

              {/* Validation error */}
              {validationError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-800/40"
                >
                  <span className="font-medium">{validationError}</span>
                </div>
              )}

              {/* Error state */}
              {appState.stage === 'error' && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40"
                >
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">{appState.message}</p>
                  {appState.detail && (
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{appState.detail}</p>
                  )}
                  <button
                    onClick={() => setAppState({ stage: 'idle' })}
                    className="mt-3 text-xs text-red-600 dark:text-red-400 underline font-medium focus-visible:outline-2 focus-visible:outline-red-600 rounded cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading || !hasInput}
                aria-busy={isLoading}
                aria-disabled={isLoading || !hasInput}
                className="w-full relative group flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin motion-reduce:animate-none"
                      role="status"
                      aria-label="Processing…"
                    />
                    <span>Processing document…</span>
                  </>
                ) : (
                  <>
                    <FileSearch2 className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" aria-hidden="true" />
                    <span>Simplify Document</span>
                    <ArrowRight className="w-4 h-4 opacity-80 group-hover:translate-x-1 transition-transform duration-200" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* Results */}
        {appState.stage === 'success' && (
          <div className="animate-fade-in">
            <ResultsPanel
              result={appState.result}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              onReset={handleReset}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm mt-auto transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          AccessibleDoc AI &mdash; Making documents accessible for everyone.
        </div>
      </footer>
    </div>
  );
};

export default App;
