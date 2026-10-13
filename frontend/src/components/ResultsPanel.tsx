import React, { useState } from 'react';
import {
  FileText,
  ListChecks,
  Zap,
  Calendar,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { SimplifiedDocument } from '../types/document';
import { AccessibilityToolbar } from './AccessibilityToolbar';
import { DocumentQuestion } from './DocumentQuestion';

const LEVEL_LABELS: Record<string, string> = {
  simple: 'Simple',
  very_simple: 'Very Simple',
  detailed: 'Detailed',
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = `section-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition-shadow duration-200">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {icon}
          {title}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div id={id} className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
};

interface ResultsPanelProps {
  result: SimplifiedDocument;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onReset: () => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  result,
  fontSize,
  onFontSizeChange,
  onReset,
}) => {
  const [showOriginal, setShowOriginal] = useState(false);

  const displayText = showOriginal ? result.original_text : result.simplified_text;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              SIMPLIFIED DOCUMENT
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Level: <strong className="text-slate-700 dark:text-slate-300">{LEVEL_LABELS[result.reading_level] ?? result.reading_level}</strong>
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{result.document_name}</h2>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 self-start sm:self-auto cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Process another document
        </button>
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 shadow-xs">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
            Executive Summary
          </p>
          <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-normal">{result.summary}</p>
        </div>
      )}

      <DocumentQuestion documentText={result.original_text} />

      {/* Accessibility toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between p-4 bg-slate-50/80 dark:bg-slate-850/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs">
        <AccessibilityToolbar
          key={displayText}
          textToRead={displayText}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          documentName={result.document_name}
        />
        {/* Toggle original/simplified */}
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          aria-label={showOriginal ? 'Show simplified text' : 'Show original text'}
          aria-pressed={showOriginal}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer shadow-2xs ${
            showOriginal
              ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {showOriginal ? (
            <ToggleRight className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          ) : (
            <ToggleLeft className="w-4 h-4" aria-hidden="true" />
          )}
          {showOriginal ? 'Showing Original' : 'Show Original'}
        </button>
      </div>

      {/* Main document text */}
      <Section
        title={showOriginal ? 'Original Document' : 'Simplified Document'}
        icon={<FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
      >
        <div
          className="text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap transition-all duration-200 max-w-prose"
          style={{ fontSize: `${fontSize}px` }}
          aria-live="polite"
        >
          {displayText}
        </div>
      </Section>

      {/* Key points */}
      {result.key_points.length > 0 && (
        <Section
          title="Key Points"
          icon={<ListChecks className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
        >
          <ul className="space-y-2.5">
            {result.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 ring-1 ring-emerald-500/20">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Action items */}
      {result.action_items.length > 0 && (
        <Section
          title="Action Items"
          icon={<Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />}
        >
          <ul className="space-y-2.5">
            {result.action_items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300 text-sm">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-300 shrink-0 ring-2 ring-amber-400/20" aria-hidden="true" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Deadlines */}
      {result.deadlines.length > 0 && (
        <Section
          title="Deadlines & Important Dates"
          icon={<Calendar className="w-4 h-4 text-rose-500 dark:text-rose-400" aria-hidden="true" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {result.deadlines.map((d, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 shadow-2xs">
                <div className="shrink-0">
                  <time className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded-md block">{d.date}</time>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{d.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Difficult terms */}
      {result.difficult_terms.length > 0 && (
        <Section
          title="Glossary — Difficult Terms"
          icon={<BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />}
          defaultOpen={false}
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.difficult_terms.map((t, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
                <dt className="text-sm font-bold text-purple-700 dark:text-purple-300">{t.term}</dt>
                <dd className="text-xs text-slate-600 dark:text-slate-300 mt-1 ml-0 leading-relaxed">{t.explanation}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Section
          title="Warnings & Limitations"
          icon={<AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />}
        >
          <ul className="space-y-2">
            {result.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
};
