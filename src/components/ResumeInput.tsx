"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { JobDescriptionPreview } from "./JobDescriptionPreview";
import { ResumePdfFrame } from "./ResumePdfFrame";
import { Spinner } from "./ui/Spinner";

const ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onFile: (file: File) => void;
  /** Clears resume and returns to upload/paste — parent should reset file name and errors too */
  onChangeCv: () => void;
  disabled?: boolean;
  loading?: boolean;
  parseError?: string | null;
  uploadedLabel?: string | null;
  /** When the resume came from a PDF file, native PDF preview (blob URL from parent). */
  pdfObjectUrl?: string | null;
};

/**
 * Resume capture: file drop/browse or paste. After text is present, shows read-only preview and Change CV only.
 */
export function ResumeInput({
  value,
  onChange,
  onFile,
  onChangeCv,
  disabled = false,
  loading = false,
  parseError,
  uploadedLabel,
  pdfObjectUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [invalidTypeHint, setInvalidTypeHint] = useState<string | null>(null);

  const busy = disabled || loading;
  const hasContent = value.trim().length > 0;

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const ok =
        /\.(pdf|docx|txt)$/i.test(file.name) ||
        /pdf|word|plain|officedocument/i.test(file.type);
      if (!ok) {
        setInvalidTypeHint("Please use a PDF, DOCX, or TXT file.");
        window.setTimeout(() => setInvalidTypeHint(null), 4500);
        return;
      }
      setInvalidTypeHint(null);
      onFile(file);
    },
    [onFile],
  );

  return (
    <motion.section
      layout
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-md shadow-slate-200/60 backdrop-blur-sm transition-colors hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20 dark:hover:border-emerald-500/30"
      whileHover={{ y: -2 }}
    >
      {hasContent && !loading ? (
        <>
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-emerald-50/90 to-white px-5 py-4 dark:border-white/10 dark:from-emerald-950/35 dark:to-zinc-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Your CV</h2>
                {uploadedLabel ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    <span className="font-medium text-slate-800 dark:text-zinc-200">{uploadedLabel}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Ready for matching.</p>
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onChangeCv}
                className="shrink-0 rounded-lg border border-emerald-600/40 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/50 dark:bg-zinc-900/60 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
              >
                Change CV
              </button>
            </div>
          </div>
          <div className="p-5 pt-4">
            {pdfObjectUrl ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  PDF preview — extracted text is used for skill matching and suggestions.
                </p>
                <ResumePdfFrame url={pdfObjectUrl} className="min-h-[min(520px,62vh)]" />
              </div>
            ) : (
              <div className="max-h-[min(520px,62vh)] overflow-y-auto rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white px-4 py-4 shadow-inner dark:border-white/10 dark:from-zinc-900/50 dark:to-zinc-950/70">
                <JobDescriptionPreview text={value} />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-emerald-50/90 to-white px-5 py-4 dark:border-white/10 dark:from-emerald-950/35 dark:to-zinc-950/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Resume</h2>
                <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
                  Drop a file or paste below. Text is extracted in your browser for matching.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={pickFile}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500/90 dark:text-emerald-950 dark:hover:bg-emerald-400"
              >
                Browse files
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="p-5 pt-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => !busy && pickFile()}
              onKeyDown={(e) => {
                if (busy) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pickFile();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!busy) setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                if (busy) return;
                const f = e.dataTransfer.files?.[0];
                handleFile(f);
              }}
              className={`group relative mb-4 cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                dragOver && !busy
                  ? "border-emerald-500 bg-emerald-50/90 dark:border-emerald-400/60 dark:bg-emerald-500/10"
                  : "border-slate-300/90 bg-slate-50/50 hover:border-emerald-400/80 hover:bg-emerald-50/40 dark:border-white/15 dark:bg-zinc-900/40 dark:hover:border-emerald-500/35 dark:hover:bg-emerald-500/5"
              } ${busy ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <div className="pointer-events-none flex flex-col items-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-inner dark:bg-emerald-500/15 dark:text-emerald-300">
                  <DocumentArrowIcon className="h-7 w-7" />
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                  Drop PDF, DOCX, or TXT here
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">or click to browse</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-950/30">
                    <Spinner className="h-5 w-5 text-emerald-600 dark:text-emerald-400" label="Reading file" />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">Reading your file…</p>
                      <p className="text-xs text-emerald-900/75 dark:text-emerald-200/70">
                        Extracting text from PDF or Word in the browser.
                      </p>
                    </div>
                  </div>
                  <div className="mb-4 space-y-2">
                    <div className="h-2.5 animate-pulse rounded-md bg-emerald-200/80 dark:bg-emerald-900/50" />
                    <div className="h-2.5 w-[88%] animate-pulse rounded-md bg-emerald-200/70 dark:bg-emerald-900/45" />
                    <div className="h-2.5 w-[72%] animate-pulse rounded-md bg-emerald-200/60 dark:bg-emerald-900/40" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {invalidTypeHint && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                  role="status"
                >
                  {invalidTypeHint}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {parseError && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 flex gap-2 rounded-xl border border-rose-300/90 bg-rose-50 px-3 py-2.5 text-sm text-rose-950 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100"
                  role="alert"
                >
                  <span className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400">
                    <AlertIcon className="h-5 w-5" />
                  </span>
                  <span>{parseError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative min-h-[200px]">
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={busy}
                placeholder="Or paste your resume here…"
                className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/20"
              />
              {loading && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80"
                  aria-hidden
                >
                  <Spinner className="h-8 w-8 text-emerald-600 dark:text-emerald-400" label="Loading" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">Extracting text…</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.section>
  );
}

function DocumentArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.35} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}
