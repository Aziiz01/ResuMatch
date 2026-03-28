"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

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

function extractCodeFences(input: string): string {
  const fence = input.match(/```(?:latex)?\s*([\s\S]*?)```/i);
  return fence ? fence[1].trim() : input.trim();
}

/**
 * latex.js loads each \\usepackage via dynamic imports in the browser; many CTAN
 * packages are not bundled → console noise and broken preview. Preview uses a
 * package-free subset; users keep full \\usepackage list in the editor / .tex download.
 */
function stripPreviewIncompatiblePreamble(src: string): { text: string; stripped: boolean } {
  const normalized = src.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];
  let stripped = false;

  for (const line of lines) {
    const t = line.trim();
    if (
      /\\usepackage\b/.test(t) ||
      /\\RequirePackage\b/.test(t) ||
      /\\PassOptionsToPackage\b/.test(t)
    ) {
      stripped = true;
      continue;
    }
    out.push(line);
  }

  return {
    text: out.join("\n").replace(/\n{3,}/g, "\n\n"),
    stripped,
  };
}

/** Matches \\begin{document} with optional spaces (latex.js is stricter than this regex). */
const RE_BEGIN_DOC = /\\begin\s*\{\s*document\s*\}/;
const RE_END_DOC = /\\end\s*\{\s*document\s*\}/;

function stripBomAndFixBackslashes(src: string): string {
  return src
    .replace(/^\uFEFF/, "")
    .replace(/\uFF3C/g, "\\"); // fullwidth reverse solidus → backslash
}

/**
 * latex.js parses the full preamble; after stripping \\usepackage, leftover commands like
 * \\geometry or font setup can leave the parser expecting \\begin{document} in the wrong state.
 * For preview, keep only the document body and wrap with a minimal article preamble.
 */
function isolateDocumentBodyForPreview(src: string): { source: string; simplified: boolean } {
  const paired = src.match(
    new RegExp(`${RE_BEGIN_DOC.source}([\\s\\S]*?)${RE_END_DOC.source}`, "m"),
  );
  if (paired) {
    return {
      source: `\\documentclass{article}
\\begin{document}
${paired[1].trim()}
\\end{document}`,
      simplified: true,
    };
  }

  const open = src.match(new RegExp(`${RE_BEGIN_DOC.source}([\\s\\S]*)$`, "m"));
  if (open) {
    return {
      source: `\\documentclass{article}
\\begin{document}
${open[1].trim()}
\\end{document}`,
      simplified: true,
    };
  }

  return { source: src, simplified: false };
}

function hasBeginDocument(src: string): boolean {
  return RE_BEGIN_DOC.test(src);
}

/** Environments that often break latex.js preview when \\begin/\\end counts disagree. */
const PREVIEW_BALANCE_ENVS = new Set(["itemize", "enumerate", "description", "tabular"]);

/**
 * Append missing \\end{...} at EOF in stack order (models sometimes omit the last \\end{itemize}).
 * Only handles well-nested markup; mismatched \\end in the middle may still fail to parse.
 */
function balanceTrackedEnvironments(body: string): { text: string; fixed: boolean } {
  const stack: string[] = [];
  const re = /\\(begin|end)\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const cmd = m[1];
    const env = m[2].trim();
    if (!PREVIEW_BALANCE_ENVS.has(env)) continue;
    if (cmd === "begin") {
      stack.push(env);
    } else if (stack.length > 0 && stack[stack.length - 1] === env) {
      stack.pop();
    }
  }
  if (stack.length === 0) return { text: body, fixed: false };
  const suffix = [...stack].reverse().map((e) => `\\end{${e}}`).join("\n");
  return { text: `${body.trimEnd()}\n${suffix}\n`, fixed: true };
}

function balancePreviewDocument(src: string): { source: string; fixed: boolean } {
  // No multiline flag: ^/$ must be whole string so body is not truncated at an inner newline.
  const match = src.match(
    new RegExp(`^([\\s\\S]*?${RE_BEGIN_DOC.source})([\\s\\S]*?)(${RE_END_DOC.source})\\s*$`),
  );
  if (!match) return { source: src, fixed: false };
  const [, head, body, tail] = match;
  const balanced = balanceTrackedEnvironments(body);
  if (!balanced.fixed) return { source: src, fixed: false };
  return { source: `${head}${balanced.text}${tail}`, fixed: true };
}

/**
 * LaTeX.js does not implement several NFSS/font primitives (e.g. \\fontsize, \\selectfont).
 * Strip them for preview only; the editor / .tex download stay unchanged.
 */
function stripUnsupportedPreviewMacros(src: string): { text: string; stripped: boolean } {
  const before = src;
  let text = src
    .replace(/\\fontsize\s*\{[^}]*\}\s*\{[^}]*\}(?:\s*\\selectfont)?/g, "")
    .replace(/\\selectfont\b/g, "")
    .replace(/\\fontseries\s*\{[^}]*\}/g, "")
    .replace(/\\fontshape\s*\{[^}]*\}/g, "")
    .replace(/\\fontencoding\s*\{[^}]*\}/g, "")
    .replace(/\\fontfamily\s*\{[^}]*\}/g, "")
    .replace(/\\linespread\s*\{[^}]*\}/g, "")
    .replace(/\n{3,}/g, "\n\n");
  return { text, stripped: text !== before };
}

/**
 * LaTeX.js errors with "group argument expected" if \\title / \\author / \\date lack `{...}`.
 * Models sometimes emit bare commands or unbraced one-line titles.
 * Skips lines where the argument `{...}` opens on the following line (valid LaTeX).
 */
function fixTitleAuthorDateForPreview(src: string): { text: string; fixed: boolean } {
  const before = src;
  const lines = src.split("\n");
  const nextMeaningfulLine = (from: number): string => {
    for (let j = from + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t.length > 0) return lines[j];
    }
    return "";
  };

  for (let i = 0; i < lines.length; i++) {
    for (const cmd of ["title", "author", "date"] as const) {
      const bareOnly = new RegExp(`^(\\s*)\\\\${cmd}\\s*$`);
      const m = lines[i].match(bareOnly);
      if (!m) continue;
      const next = nextMeaningfulLine(i).trimStart();
      if (next.startsWith("{") || next.startsWith("[")) continue;
      lines[i] = `${m[1]}\\${cmd}{}`;
    }
  }

  let text = lines.join("\n");
  for (const cmd of ["title", "author", "date"] as const) {
    text = text.replace(
      new RegExp(`\\\\${cmd}\\s+(?!\\[)(?!\\{)([^\\n]+)`, "g"),
      (_whole, rest: string) => `\\${cmd}{${rest.trimEnd()}}`,
    );
  }
  return { text, fixed: text !== before };
}

function normalizeLatexForPreview(input: string): { source: string; warning: string | null } {
  let src = stripBomAndFixBackslashes(extractCodeFences(input));
  const warnings: string[] = [];

  const { text, stripped } = stripPreviewIncompatiblePreamble(src);
  src = text;

  let simplified = false;
  if (hasBeginDocument(src)) {
    const isolated = isolateDocumentBodyForPreview(src);
    src = isolated.source;
    simplified = isolated.simplified;
  } else {
    // Body-only / fragment: wrap into a minimal article document.
    src = `\\documentclass{article}
\\begin{document}
${src.trim()}
\\end{document}`;
    warnings.push("No \\begin{document} found; content was wrapped in a minimal article for preview.");
  }

  const macroStripped = stripUnsupportedPreviewMacros(src);
  src = macroStripped.text;
  if (macroStripped.stripped) {
    warnings.push(
      "NFSS/font commands not supported by LaTeX.js preview (e.g. \\fontsize, \\selectfont, \\linespread) were removed for preview only.",
    );
  }

  const titleFixed = fixTitleAuthorDateForPreview(src);
  src = titleFixed.text;
  if (titleFixed.fixed) {
    warnings.push(
      "\\title / \\author / \\date were normalized to use `{...}` where needed for LaTeX.js preview.",
    );
  }

  if (stripped || simplified) {
    const bits: string[] = [];
    if (stripped) {
      bits.push(
        "\\usepackage lines are removed (LaTeX.js cannot load most CTAN packages in the browser)",
      );
    }
    if (simplified) {
      bits.push(
        "only the text between \\begin{document} and \\end{document} is shown, inside a minimal preamble",
      );
    }
    warnings.push(
      `Preview note: ${bits.join("; ")}. The editor and downloaded .tex still contain your full source—compile locally with pdflatex or xelatex for the real layout.`,
    );
  }

  const balanced = balancePreviewDocument(src);
  if (balanced.fixed) {
    src = balanced.source;
    warnings.push(
      "Missing \\end{…} for list or tabular environments was auto-inserted at the end of the document body for preview (fix the LaTeX in the editor for a valid .tex).",
    );
  }

  return { source: src, warning: warnings.length ? warnings.join(" ") : null };
}

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
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);

  const hasLatex = latexCode.trim().length > 0;

  useEffect(() => {
    if (!hasLatex) {
      setPreviewHtml("");
      setPreviewError(null);
      setPreviewWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const normalized = normalizeLatexForPreview(latexCode);
        setPreviewWarning(normalized.warning);

        const latex = await import("latex.js");
        const generator = new (latex as unknown as { HtmlGenerator: new (opts: { hyphenate: boolean }) => unknown }).HtmlGenerator({
          hyphenate: false,
        });
        const parsed = (latex as unknown as { parse: (src: string, opts: { generator: unknown }) => unknown }).parse(
          normalized.source,
          { generator },
        ) as {
          stylesAndScripts: (base: string) => Node;
          domFragment: () => DocumentFragment;
        };

        const doc = document.implementation.createHTMLDocument("latex-preview");
        doc.head.appendChild(parsed.stylesAndScripts(LATEX_CDN_BASE));
        doc.body.appendChild(parsed.domFragment());

        const wrapped = `<!doctype html>${doc.documentElement.outerHTML}`;
        setPreviewHtml(wrapped);
        setPreviewError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not render LaTeX preview.";
        setPreviewError(`${msg}. Try adding a complete document with \\begin{document} ... \\end{document}.`);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [hasLatex, latexCode]);

  const downloadHtml = useMemo(() => {
    return !!previewHtml && !previewError;
  }, [previewHtml, previewError]);

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

      {previewError && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Preview error: {previewError}
        </div>
      )}

      {previewWarning && (
        <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
          {previewWarning}
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
              sandbox=""
              className="h-[560px] w-full bg-white"
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

