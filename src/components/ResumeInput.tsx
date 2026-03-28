"use client";

import { motion } from "framer-motion";
import { useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onFile: (file: File) => void;
  disabled?: boolean;
};

/**
 * Resume capture: drag/drop or pick PDF/DOCX/TXT, or paste plain text.
 * File parsing happens in the parent via extractTextFromFile().
 */
export function ResumeInput({ value, onChange, onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.section
      layout
      className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-md shadow-slate-200/60 backdrop-blur-sm transition-colors hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20 dark:hover:border-emerald-500/30"
      whileHover={{ y: -2 }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Resume</h2>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500/90 dark:text-emerald-950 dark:hover:bg-emerald-400"
        >
          Upload PDF / DOCX / TXT
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mb-2 text-sm text-slate-600 dark:text-zinc-400">
        Paste text or upload a file. Text is processed in your browser (PDF/DOCX extracted
        client-side).
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste your resume here, or upload a file…"
        className="min-h-[180px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/20"
      />
    </motion.section>
  );
}
