"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ResumeInput } from "./ResumeInput";
import { JobInput } from "./JobInput";
import { SkillMatchPanel } from "./SkillMatchPanel";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { LatexCvPanel } from "./LatexCvPanel";
import { ThemeToggle } from "./ThemeToggle";
import { extractTextFromFile } from "@/lib/extractText";
import {
  combineMatches,
  extractJobSkills,
  keywordMatch,
  matchPercentage,
  type SkillResult,
} from "@/lib/skills";
import { generateBulletSuggestion, semanticScoresForSkills } from "@/lib/matchResume";
import { buildLatexCvPrompt, buildWholeResumePrompt } from "@/lib/resumeBullets";

/**
 * Orchestrates resume + JD state, skill analysis (keyword + optional HF embeddings),
 * and bullet rewrite generation via `/api/generate`.
 */
export function Dashboard() {
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [skillResults, setSkillResults] = useState<SkillResult[]>([]);
  const [matchPct, setMatchPct] = useState(0);
  const [semanticAvailable, setSemanticAvailable] = useState(false);

  const [cvSuggestion, setCvSuggestion] = useState("");
  const [latexCode, setLatexCode] = useState("");
  const [latexLoading, setLatexLoading] = useState(false);
  const [latexError, setLatexError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const onResumeFile = useCallback(async (file: File) => {
    setBusy(true);
    setAnalyzeError(null);
    try {
      const text = await extractTextFromFile(file);
      setResume(text);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Could not read file.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onJobFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setJob(text);
    } catch {
      setAnalyzeError("Could not read job file.");
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    setAnalyzeError(null);
    if (!resume.trim() || !job.trim()) {
      setAnalyzeError("Add both a resume and a job description.");
      return;
    }

    setBusy(true);
    setSkillResults([]);
    setSemanticAvailable(false);

    try {
      const resumeNorm = resume.toLowerCase();
      const skills = extractJobSkills(job);
      const keywordFlags = skills.map((s) => keywordMatch(resumeNorm, s));

      let semanticScores: (number | null)[] = skills.map(() => null);
      try {
        semanticScores = await semanticScoresForSkills(resume, skills);
        const anySem = semanticScores.some((x) => x != null);
        setSemanticAvailable(anySem);
      } catch {
        setSemanticAvailable(false);
      }

      const combined = combineMatches(skills, keywordFlags, semanticScores);
      setSkillResults(combined);
      setMatchPct(matchPercentage(combined));

      setCvSuggestion("");
      setLatexCode("");
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }, [resume, job]);

  const onGenerate = useCallback(async () => {
    setGenError(null);
    if (!resume.trim()) {
      setGenError("Add resume content first.");
      return;
    }
    if (!job.trim()) {
      setGenError("Job description required for targeted rewrites.");
      return;
    }

    setGenLoading(true);
    try {
      const prompt = buildWholeResumePrompt(job, resume);
      const text = await generateBulletSuggestion(prompt);
      setCvSuggestion(text);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenLoading(false);
    }
  }, [job, resume]);

  const onChangeSuggestion = useCallback((text: string) => {
    setCvSuggestion(text);
  }, []);

  const onDownload = useCallback(() => {
    const value = cvSuggestion.trim();
    if (!value) return;
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailored-cv-suggestion.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [cvSuggestion]);

  const onGenerateLatex = useCallback(async () => {
    setLatexError(null);
    if (!resume.trim()) {
      setLatexError("Add resume content first.");
      return;
    }
    if (!job.trim()) {
      setLatexError("Job description is required to tailor the LaTeX CV.");
      return;
    }

    setLatexLoading(true);
    try {
      const prompt = buildLatexCvPrompt(job, resume);
      const text = await generateBulletSuggestion(prompt);
      setLatexCode(text);
    } catch (e) {
      setLatexError(e instanceof Error ? e.message : "LaTeX generation failed.");
    } finally {
      setLatexLoading(false);
    }
  }, [job, resume]);

  const onDownloadTex = useCallback(() => {
    const value = latexCode.trim();
    if (!value) return;
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailored-resume.tex";
    a.click();
    URL.revokeObjectURL(url);
  }, [latexCode]);

  const atsMissing = useMemo(
    () => skillResults.filter((r) => !r.matched).map((r) => r.skill),
    [skillResults],
  );

  const altRoles = useMemo(() => {
    const s = skillResults.filter((r) => r.matched).map((r) => r.skill.toLowerCase()).join(" ");
    const roles: string[] = [];
    if (/react|vue|angular|svelte|frontend|css|html/.test(s)) roles.push("Frontend Engineer");
    if (/node|backend|api|java|spring|django|fastapi|\.net|go\b/.test(s)) roles.push("Backend Engineer");
    if (/aws|azure|gcp|kubernetes|docker|terraform|devops|ci\/?cd/.test(s))
      roles.push("DevOps / Platform Engineer");
    if (/ml|pytorch|tensorflow|nlp|llm|data science/.test(s)) roles.push("ML Engineer");
    if (roles.length === 0) roles.push("Software Engineer", "Full-stack Engineer");
    return [...new Set(roles)].slice(0, 4);
  }, [skillResults]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400/90">
            Resume ↔ Job matcher
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-4xl">
            AI-assisted fit & bullet rewrites
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-zinc-400">
            Upload or paste your resume and a job description, run analysis for keyword + embedding
            skill coverage, then generate editable bullet suggestions tuned to the role.
          </p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <ThemeToggle />
        </div>
      </motion.header>

      <div className="grid gap-6 lg:grid-cols-2">
        <ResumeInput value={resume} onChange={setResume} onFile={onResumeFile} disabled={busy} />
        <JobInput value={job} onChange={setJob} onFile={onJobFile} disabled={busy} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={busy}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-105 disabled:opacity-50 dark:shadow-emerald-900/40"
        >
          {busy ? "Analyzing…" : "Run skill analysis"}
        </button>
        {analyzeError && (
          <span className="text-sm text-rose-700 dark:text-rose-300">{analyzeError}</span>
        )}
      </div>

      <SkillMatchPanel
        results={skillResults}
        matchPct={matchPct}
        semanticAvailable={semanticAvailable}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.aside
          layout
          className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm shadow-amber-100/50 dark:border-amber-500/20 dark:bg-amber-500/[0.07] dark:shadow-none"
        >
          <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">ATS keyword gaps</h3>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/70">
            Terms from the job that are still missing from your resume (add naturally where true).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {atsMissing.length === 0 ? (
              <span className="text-sm text-slate-600 dark:text-zinc-500">Run analysis to see gaps.</span>
            ) : (
              atsMissing.map((k) => (
                <span
                  key={k}
                  className="rounded-md bg-rose-100 px-2 py-0.5 text-xs text-rose-900 ring-1 ring-rose-300/80 dark:bg-rose-500/20 dark:text-rose-100 dark:ring-rose-400/30"
                >
                  {k}
                </span>
              ))
            )}
          </div>
        </motion.aside>

        <motion.aside
          layout
          className="rounded-2xl border border-violet-200 bg-violet-50/90 p-5 shadow-sm shadow-violet-100/50 dark:border-violet-500/20 dark:bg-violet-500/[0.07] dark:shadow-none"
        >
          <h3 className="text-sm font-semibold text-violet-950 dark:text-violet-100">Alternative roles (heuristic)</h3>
          <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-200/70">
            Based on skills that matched the posting—use as inspiration, not a verdict.
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-violet-900 dark:text-violet-100/90">
            {altRoles.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </motion.aside>
      </div>

      <SuggestionsPanel
        resumeText={resume}
        suggestion={cvSuggestion}
        onChangeSuggestion={onChangeSuggestion}
        onGenerate={onGenerate}
        onDownload={onDownload}
        loading={genLoading}
        error={genError}
      />

      <LatexCvPanel
        latexCode={latexCode}
        onChangeLatex={setLatexCode}
        onGenerateLatex={onGenerateLatex}
        onDownloadTex={onDownloadTex}
        loading={latexLoading}
        error={latexError}
      />
    </div>
  );
}
