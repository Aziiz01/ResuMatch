"use client";

import { motion } from "framer-motion";

type Props = {
  resumeText: string;
  suggestion: string;
  onChangeSuggestion: (text: string) => void;
  onGenerate: () => void;
  onDownload: () => void;
  loading: boolean;
  error: string | null;
};

/**
 * Editable AI suggestion for the whole resume. Users can edit before download.
 * Generation calls /api/generate (Hugging Face) via the parent orchestrator.
 */
export function SuggestionsPanel({
  resumeText,
  suggestion,
  onChangeSuggestion,
  onGenerate,
  onDownload,
  loading,
  error,
}: Props) {
  const hasResume = resumeText.trim().length > 0;

  return (
    <motion.section
      layout
      className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-md shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Resume suggestions</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-500">
            Get one consolidated recommendation block for your whole CV in{" "}
            <span className="font-medium text-slate-800 dark:text-zinc-300">action + result + metric</span> form. Edit
            the full suggestion, then download.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || !hasResume}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500/90 dark:text-violet-950 dark:hover:bg-violet-400"
          >
            {loading ? "Generating…" : "Generate suggestions"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={!suggestion.trim()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-white/25 dark:hover:bg-zinc-800"
          >
            Download .txt
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {error}
        </div>
      )}

      {!hasResume ? (
        <p className="text-sm text-slate-600 dark:text-zinc-500">Add resume text to generate a full CV-level suggestion.</p>
      ) : (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-zinc-950/50"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300/90">
            Unified CV suggestion
          </p>
          <textarea
            value={suggestion}
            onChange={(e) => onChangeSuggestion(e.target.value)}
            placeholder="Click “Generate suggestions” to get one complete recommendation for the whole CV…"
            className="min-h-[220px] w-full resize-y rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/20 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-violet-500/50 dark:focus:ring-violet-500/20"
          />
        </motion.div>
      )}
    </motion.section>
  );
}
