"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  buildLatexPreviewSource,
  buildPreviewFallbackHtml,
  escalatePreviewForLatexJs,
  finalizePreviewSource,
} from "@/lib/latexPreviewSanitize";

type Tab = "code" | "preview";

type Props = {
  latexCode: string;
  onChangeLatex: (value: string) => void;
  onGenerateLatex: () => void;
  onDownloadTex: () => void;
  loading: boolean;
  error: string | null;
};

const LATEX_CDN_BASE = "https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/";

/**
 * Generates, edits, and previews a full LaTeX CV.
 * Preview is isolated in an iframe to avoid style collisions with app UI.
 */
export function LatexCvPanel({
  latexCode,
  onChangeLatex,
  onGenerateLatex,
  onDownloadTex,
  loading,
  error,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("code");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewIsFallback, setPreviewIsFallback] = useState(false);

  const hasLatex = latexCode.trim().length > 0;

  useEffect(() => {
    if (!hasLatex) {
      setPreviewHtml("");
      setPreviewIsFallback(false);
      return;
    }

    const timer = setTimeout(async () => {
      const base = buildLatexPreviewSource(latexCode);

      const tryParseAndBuildHtml = async (source: string): Promise<string> => {
        const latex = await import("latex.js");
        const generator = new (latex as unknown as { HtmlGenerator: new (opts: { hyphenate: boolean }) => unknown }).HtmlGenerator({
          hyphenate: false,
        });
        const parsed = (latex as unknown as { parse: (src: string, opts: { generator: unknown }) => unknown }).parse(
          source,
          { generator },
        ) as {
          stylesAndScripts: (base: string) => Node;
          domFragment: () => DocumentFragment;
        };

        const doc = document.implementation.createHTMLDocument("latex-preview");
        doc.head.appendChild(parsed.stylesAndScripts(LATEX_CDN_BASE));
        doc.body.appendChild(parsed.domFragment());
        return `<!doctype html>${doc.documentElement.outerHTML}`;
      };

      const attempts: { label: string; source: string }[] = [
        { label: "full", source: base.source },
        { label: "no-tables", source: finalizePreviewSource(escalatePreviewForLatexJs(base.source, 1)) },
        { label: "simplified-headings", source: finalizePreviewSource(escalatePreviewForLatexJs(base.source, 2)) },
      ];

      let rendered = false;

      for (let i = 0; i < attempts.length; i++) {
        try {
          const html = await tryParseAndBuildHtml(attempts[i].source);
          setPreviewHtml(html);
          setPreviewIsFallback(false);
          rendered = true;
          break;
        } catch {
          /* try next */
        }
      }

      if (!rendered) {
        setPreviewHtml(buildPreviewFallbackHtml(base.source));
        setPreviewIsFallback(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [hasLatex, latexCode]);

  const downloadHtml = useMemo(() => !!previewHtml, [previewHtml]);

  const onDownloadPreviewHtml = () => {
    if (!downloadHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "latex-cv-preview.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.section
      layout
      className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-md shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20"
    >
      <div
        className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm leading-snug text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        role="status"
      >
        <span className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 00-3.586 0L2.5 12.5m8.92 2.67l-1.17-1.17m0 0a2.5 2.5 0 01-3.54-3.54l1.17 1.17M9.75 9.75l-1.5-1.5"
            />
          </svg>
        </span>
        <p>
          <span className="font-semibold">Work in progress.</span> LaTeX generation and in-browser preview are still
          under active development — better rendering and quality-of-life updates are on the way.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            LaTeX CV Builder
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-500">
            Generate a full resume in LaTeX, edit code, and preview it live.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerateLatex}
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50 dark:bg-sky-500/90 dark:text-sky-950 dark:hover:bg-sky-400"
          >
            {loading ? "Generating…" : "Generate LaTeX CV"}
          </button>
          <button
            type="button"
            onClick={onDownloadTex}
            disabled={!hasLatex}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-white/25 dark:hover:bg-zinc-800"
          >
            Download .tex
          </button>
          <button
            type="button"
            onClick={onDownloadPreviewHtml}
            disabled={!downloadHtml}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-white/25 dark:hover:bg-zinc-800"
          >
            Download Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
          {error}
        </div>
      )}

      {previewIsFallback && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
          In-browser LaTeX could not fully render this document. Showing a compatibility preview below—use{" "}
          <strong>Download .tex</strong> and compile locally for the real layout.
        </div>
      )}

      <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-zinc-900/60">
        <button
          type="button"
          onClick={() => setActiveTab("code")}
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            activeTab === "code"
              ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Code
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            activeTab === "preview"
              ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Preview
        </button>
      </div>

      {activeTab === "code" ? (
        <textarea
          value={latexCode}
          onChange={(e) => onChangeLatex(e.target.value)}
          placeholder="Generate LaTeX CV to start editing..."
          className="min-h-[360px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-sky-500/60"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          {previewHtml ? (
            <iframe
              title="LaTeX CV Preview"
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-same-origin"
              className="h-[560px] w-full bg-white dark:bg-zinc-950"
            />
          ) : (
            <div className="flex h-[320px] items-center justify-center bg-slate-50 text-sm text-slate-600 dark:bg-zinc-950/50 dark:text-zinc-500">
              Generate LaTeX CV to preview it here.
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}
