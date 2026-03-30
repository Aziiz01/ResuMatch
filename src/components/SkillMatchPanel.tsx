"use client";

import { motion } from "framer-motion";
import type { SkillResult } from "@/lib/skills";

type Props = {
  results: SkillResult[];
  matchPct: number;
  semanticAvailable: boolean;
};

/**
 * Visual skill matrix: green = matched (keyword or semantic), red = gap.
 * Progress bar animates overall match percentage.
 */
export function SkillMatchPanel({ results, matchPct, semanticAvailable }: Props) {
  const safePct = Math.min(100, Math.max(0, matchPct));

  return (
    <motion.section
      layout
      className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-md shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Skill match</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-500">
            Green = found in résumé (exact keyword or strong embedding match vs your text). Red = gap. Semantic
            matches use a strict, job-relative cutoff so scores are not all 100%.{" "}
            {!semanticAvailable && (
              <span className="text-amber-700 dark:text-amber-400/90"></span>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{safePct}%</div>
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-500">overall</div>
        </div>
      </div>

      <div className="mb-5 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-400 to-cyan-400"
          initial={{ width: 0 }}
          animate={{ width: `${safePct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {results.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-zinc-500">Run analysis to see skills from the job description.</p>
        ) : (
          results.map((r, i) => (
            <motion.span
              key={`${r.skill}-${i}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              title={
                r.keywordMatch
                  ? "Keyword match"
                  : r.semanticScore != null
                    ? `Semantic similarity: ${(r.semanticScore * 100).toFixed(0)}%`
                    : "No match"
              }
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition hover:brightness-[0.98] dark:hover:brightness-110 ${
                r.matched
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/80 dark:bg-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-500/40"
                  : "bg-rose-100 text-rose-900 ring-1 ring-rose-300/80 dark:bg-rose-500/20 dark:text-rose-100 dark:ring-rose-500/35"
              }`}
            >
              {r.skill}
              {!r.keywordMatch && r.matched && (
                <span className="ml-1 text-[10px] uppercase text-emerald-700/90 dark:text-emerald-300/80">sem</span>
              )}
            </motion.span>
          ))
        )}
      </div>
    </motion.section>
  );
}
