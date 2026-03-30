"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { JobDescriptionPreview } from "./JobDescriptionPreview";
import { Spinner } from "./ui/Spinner";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onFile: (file: File) => void;
  disabled?: boolean;
  linkedInLoading?: boolean;
  linkedInError?: string | null;
  onLinkedInFetch?: (url: string) => void | Promise<void>;
  /** Set when the last successful fetch returned a title from LinkedIn */
  jobTitle?: string | null;
  /** Edit vs formatted preview (controlled by parent — e.g. switch to preview after LinkedIn fetch) */
  jobView: "edit" | "preview";
  onJobViewChange: (view: "edit" | "preview") => void;
};

/**
 * Job description: paste, load .txt, or fetch from a LinkedIn job posting URL (server-side).
 */
export function JobInput({
  value,
  onChange,
  onFile,
  disabled,
  linkedInLoading = false,
  linkedInError,
  onLinkedInFetch,
  jobTitle,
  jobView: view,
  onJobViewChange: setView,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkedInUrl, setLinkedInUrl] = useState("");

  const busy = disabled || linkedInLoading;
  const hasContent = value.trim().length > 0;

  return (
    <motion.section
      layout
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-md shadow-slate-200/60 backdrop-blur-sm transition-colors hover:border-sky-300 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20 dark:hover:border-sky-500/30"
      whileHover={{ y: -2 }}
    >
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-sky-50/90 to-white px-5 py-4 dark:border-white/10 dark:from-sky-950/40 dark:to-zinc-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Job description</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
              Paste the posting, upload a .txt file, or fetch from a LinkedIn URL. Use <strong>Preview</strong> for a
              readable layout; edit stays plain text for analysis.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50 dark:bg-sky-500/90 dark:text-sky-950 dark:hover:bg-sky-400"
          >
            Upload .txt
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="p-5 pt-4">
        {onLinkedInFetch && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20 dark:text-[#70b7f7]">
                <LinkedInGlyph className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">Fetch from LinkedIn</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">Public postings; login-only pages need a manual paste.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-400 dark:text-zinc-600">
                  <LinkIcon className="h-4 w-4" />
                </span>
                <input
                  type="url"
                  name="linkedin-job-url"
                  autoComplete="url"
                  placeholder="https://www.linkedin.com/jobs/view/…"
                  value={linkedInUrl}
                  onChange={(e) => setLinkedInUrl(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-sky-500/50"
                />
              </div>
              <button
                type="button"
                disabled={busy || !linkedInUrl.trim()}
                onClick={() => onLinkedInFetch(linkedInUrl.trim())}
                aria-busy={linkedInLoading}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50 dark:border-emerald-500 dark:bg-emerald-600 dark:shadow-emerald-900/30 dark:hover:bg-emerald-500"
              >
                {linkedInLoading ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" label="Fetching job" />
                    <span>Fetching…</span>
                  </>
                ) : (
                  <>
                    <DownloadIcon className="h-4 w-4 opacity-90" />
                    <span>Fetch job</span>
                  </>
                )}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {linkedInLoading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 dark:border-sky-500/20 dark:bg-sky-950/30">
                    <Spinner className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-sky-950 dark:text-sky-100">Pulling job posting…</p>
                      <p className="text-xs text-sky-800/80 dark:text-sky-200/70">Contacting LinkedIn and extracting the description.</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-2.5 animate-pulse rounded-md bg-slate-200/90 dark:bg-zinc-700/80" />
                    <div className="h-2.5 w-[92%] animate-pulse rounded-md bg-slate-200/80 dark:bg-zinc-700/70" />
                    <div className="h-2.5 w-[78%] animate-pulse rounded-md bg-slate-200/70 dark:bg-zinc-700/60" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {linkedInError && !linkedInLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-3 flex gap-2 rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100"
                  role="alert"
                >
                  <span className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400">
                    <AlertIcon className="h-5 w-5" />
                  </span>
                  <span>{linkedInError}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {jobTitle && hasContent && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
              <span className="text-emerald-600 dark:text-emerald-400/90">Role</span>
              <span className="truncate">{jobTitle}</span>
            </span>
          </div>
        )}

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-white/10 dark:bg-zinc-900/60">
            <button
              type="button"
              onClick={() => setView("edit")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "edit"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={!hasContent}
              onClick={() => setView("preview")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "preview"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Preview
            </button>
          </div>
          {hasContent && (
            <span className="text-xs text-slate-500 dark:text-zinc-500">
              {value.trim().split(/\s+/).filter(Boolean).length} words
            </span>
          )}
        </div>

        <div className="relative min-h-[200px]">
          <AnimatePresence mode="wait" initial={false}>
            {view === "preview" ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="max-h-[min(420px,52vh)] overflow-y-auto rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white px-4 py-4 shadow-inner dark:border-white/10 dark:from-zinc-900/50 dark:to-zinc-950/70"
              >
                <JobDescriptionPreview text={value} />
              </motion.div>
            ) : (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={busy}
                  placeholder="Job description appears here after fetch, or paste it yourself…"
                  className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-sky-500/50 dark:focus:ring-sky-500/20"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {linkedInLoading && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80"
              aria-hidden
            >
              <Spinner className="h-8 w-8 text-sky-600 dark:text-sky-400" label="Loading" />
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">Updating job text…</p>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622c1.654-1.654 1.654-4.334 0-5.988l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
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
