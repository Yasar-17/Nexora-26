import React, { useRef, useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  File as FileIcon,
} from 'lucide-react';

const ACCEPTED_TYPES = ['.pdf', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentInputProps {
  selectedFile: File | null;
  pastedText: string;
  onFileChange: (file: File | null) => void;
  onTextChange: (text: string) => void;
  disabled?: boolean;
  uploadProgress?: number | null;
  processingStatus?: string;
}

export const DocumentInput: React.FC<DocumentInputProps> = ({
  selectedFile,
  pastedText,
  onFileChange,
  onTextChange,
  disabled = false,
  uploadProgress = null,
  processingStatus = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'file' | 'text'>(
    selectedFile ? 'file' : 'text'
  );
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSet = useCallback(
    (file: File) => {
      setFileError(null);
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) {
        setFileError('Supported files: PDF, TXT, Markdown, PNG, JPG, JPEG, and WebP.');
        onFileChange(null);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError('File exceeds the 10 MB limit.');
        onFileChange(null);
        return;
      }
      onFileChange(file);
    },
    [onFileChange]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSet(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSet(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRemoveFile = () => {
    onFileChange(null);
    setFileError(null);
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div role="tablist" aria-label="Input method" className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 gap-1">
        <button
          role="tab"
          aria-selected={activeTab === 'file'}
          aria-controls="panel-file"
          id="tab-file"
          onClick={() => setActiveTab('file')}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer ${
            activeTab === 'file'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          Upload File
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'text'}
          aria-controls="panel-text"
          id="tab-text"
          onClick={() => setActiveTab('text')}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer ${
            activeTab === 'text'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          Paste Text
        </button>
      </div>

      {/* File upload panel */}
      {activeTab === 'file' && (
        <div
          id="panel-file"
          role="tabpanel"
          aria-labelledby="tab-file"
          className="animate-fade-in"
        >
          {!selectedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`group border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 scale-[1.01]'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-850/40 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-slate-800/80'
              }`}
              onClick={() => !disabled && fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && !disabled && fileInputRef.current?.click()}
              tabIndex={disabled ? -1 : 0}
              role="button"
              aria-label="Upload a supported document or image file. Click or drag and drop."
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3.5 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200 shadow-xs">
                <Upload className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm">Drag &amp; drop or click to upload</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Supported: PDF, TXT, Markdown, PNG, JPG, JPEG, WebP &bull; Max size: 10 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
                onChange={handleFileInput}
                className="sr-only"
                aria-label="Choose a supported document or image file"
                disabled={disabled}
              />
            </div>
          ) : (
            <div className="p-4 border border-slate-200 dark:border-slate-700/90 rounded-xl bg-slate-50/50 dark:bg-slate-800/80 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl shrink-0 text-blue-600 dark:text-blue-400">
                  <FileIcon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedFile.name.split('.').pop()?.toUpperCase()} &bull; {formatBytes(selectedFile.size)}
                  </p>
                </div>
                <button
                  onClick={handleRemoveFile}
                  disabled={disabled}
                  aria-label={`Remove ${selectedFile.name}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors focus-visible:outline-2 focus-visible:outline-red-500 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              {processingStatus && (
                <div className="mt-3 space-y-1.5" aria-live="polite">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300">{processingStatus}</p>
                    {uploadProgress !== null && (
                      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{uploadProgress}%</span>
                    )}
                  </div>
                  {uploadProgress !== null && (
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
                      role="progressbar"
                      aria-label="File upload progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={uploadProgress}
                    >
                      <div
                        className="h-full rounded-full bg-blue-600 transition-[width]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Replace file */}
          {selectedFile && (
            <button
              onClick={() => { handleRemoveFile(); fileInputRef.current?.click(); }}
              disabled={disabled}
              className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 rounded cursor-pointer"
            >
              Replace file
            </button>
          )}

          {fileError && (
            <div role="alert" className="flex items-center gap-2 mt-3 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{fileError}</span>
            </div>
          )}
        </div>
      )}

      {/* Paste text panel */}
      {activeTab === 'text' && (
        <div
          id="panel-text"
          role="tabpanel"
          aria-labelledby="tab-text"
          className="animate-fade-in"
        >
          <label htmlFor="paste-textarea" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
            Paste your document content
          </label>
          <textarea
            id="paste-textarea"
            value={pastedText}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={disabled}
            placeholder="Paste the document text here — legal contracts, medical forms, government documents…"
            rows={10}
            className="w-full resize-y rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 transition-all duration-200 shadow-2xs"
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{pastedText.length.toLocaleString()} characters</span>
            {pastedText.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-medium">Ready to simplify</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};
