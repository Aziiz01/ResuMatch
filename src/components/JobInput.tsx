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
 * Job description: paste or load a plain-text file (.txt).
 */
export function JobInput({ value, onChange, onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.section
      layout
      className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-md shadow-slate-200/60 backdrop-blur-sm transition-colors hover:border-sky-300 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20 dark:hover:border-sky-500/30"
      whileHover={{ y: -2 }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Job description</h2>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50 dark:bg-sky-500/90 dark:text-sky-950 dark:hover:bg-sky-400"
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
      <p className="mb-2 text-sm text-slate-600 dark:text-zinc-400">Paste the full posting or load a text file.</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste the job description here…"
        className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-sky-500/50 dark:focus:ring-sky-500/20"
      />
    </motion.section>
  );
}
