/**
 * Normalizes model-generated LaTeX for LaTeX.js in-browser preview only.
 * The editor / downloaded .tex are unchanged in the UI — this pipeline is preview-only.
 */

const RE_BEGIN_DOC = /\\begin\s*\{\s*document\s*\}/;
const RE_END_DOC = /\\end\s*\{\s*document\s*\}/;

export function extractCodeFences(input: string): string {
  const fence = input.match(/```(?:latex)?\s*([\s\S]*?)```/i);
  return fence ? fence[1].trim() : input.trim();
}

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

function stripBomAndFixBackslashes(src: string): string {
  return src
    .replace(/^\uFEFF/, "")
    .replace(/\uFF3C/g, "\\");
}

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

function escapeRegExpLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip floats and minipages — often pull in graphics/macros LaTeX.js mishandles. */
function stripFloatLikeEnvironments(body: string): string {
  let s = body;
  for (const env of ["figure*", "table*", "figure", "table", "minipage", "wrapfigure"]) {
    const e = escapeRegExpLiteral(env);
    const re = new RegExp(`\\\\begin\\{${e}\\}[\\s\\S]*?\\\\end\\{${e}\\}`, "g");
    s = s.replace(re, "\n\n");
  }
  return s.replace(/\n{3,}/g, "\n\n");
}

/**
 * Remove command definitions and package-specific setup lines that break the preview parser.
 */
function stripHostilePreambleLines(src: string): { text: string; stripped: boolean } {
  const before = src;
  const lines = src.split("\n");
  const out: string[] = [];
  const drop =
    /^(\\newcommand|\\renewcommand|\\providecommand|\\DeclareRobustCommand|\\newenvironment|\\renewenvironment|\\hypersetup|\\geometry|\\fancyhf|\\pagestyle|\\setlength|\\addtolength|\\setcounter|\\definecolor|\\hyphenation)\b/;

  for (const line of lines) {
    if (drop.test(line.trim())) continue;
    out.push(line);
  }
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n");
  return { text, stripped: text !== before };
}

/**
 * Inline constructs that often trigger "unknown macro" or fragile parsing in LaTeX.js.
 */
function stripHostileInlineMacros(src: string): string {
  return (
    src
      // Graphics / links (packages not loaded in preview)
      .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, "")
      .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
      .replace(/\\url\{([^}]*)\}/g, "$1")
      // Spacing / rules
      .replace(/\\vspace\*?\{[^}]*\}/g, "")
      .replace(/\\hspace\*?\{[^}]*\}/g, "")
      .replace(/\\rule(?:\[[^\]]*\])?\{[^}]*\}\{[^}]*\}/g, "")
      // Color (often needs xcolor)
      .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
      .replace(/\\color\{[^}]*\}/g, "")
      .replace(/\\pagecolor\{[^}]*\}/g, "")
      // Tables: tabularx/longtable need extra packages — drop tabularx env bodies loosely
      .replace(/\\begin\{tabularx\}\{[^}]*\}\{[^}]*\}[\s\S]*?\\end\{tabularx\}/g, "\\begin{tabular}{ll}\\hline (table simplified for preview) \\\\\\hline\\end{tabular}")
  );
}

const PREVIEW_BALANCE_ENVS = new Set([
  "itemize",
  "enumerate",
  "description",
  "tabular",
  "center",
  "quote",
  "quotation",
]);

function balanceUnclosedBracesInBody(body: string): { text: string; fixed: boolean } {
  const masked: string[] = [];
  const s = body.replace(/\\[{}]/g, (m) => {
    masked.push(m);
    return `\uE000${masked.length - 1}\uE001`;
  });

  let depth = 0;
  for (const ch of s) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }

  const restored = (t: string) =>
    t.replace(/\uE000(\d+)\uE001/g, (_, idx: string) => masked[Number(idx)] ?? "");

  if (depth <= 0) {
    return { text: restored(s), fixed: false };
  }

  return { text: restored(s + "}".repeat(depth)), fixed: true };
}

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

function balancePreviewDocument(src: string): {
  source: string;
  fixed: boolean;
  envFixed: boolean;
  braceFixed: boolean;
} {
  const match = src.match(
    new RegExp(`^([\\s\\S]*?${RE_BEGIN_DOC.source})([\\s\\S]*?)(${RE_END_DOC.source})\\s*$`),
  );
  if (!match) return { source: src, fixed: false, envFixed: false, braceFixed: false };
  const [, head, body, tail] = match;

  const envBal = balanceTrackedEnvironments(body);
  let b = envBal.text;
  const braceBal = balanceUnclosedBracesInBody(b);
  b = braceBal.text;

  const fixed = envBal.fixed || braceBal.fixed;
  // Always merge `b` back: env/brace steps may normalize even when `fixed` is false (edge cases).
  return {
    source: `${head}${b}${tail}`,
    fixed,
    envFixed: envBal.fixed,
    braceFixed: braceBal.fixed,
  };
}

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

export type LatexPreviewResult = {
  /** String passed to LaTeX.js */
  source: string;
  /** Human-readable notes (may be empty) */
  warnings: string[];
};

/**
 * Full preview-only pipeline: isolate body, strip macros/packages, balance braces/envs.
 */
export function buildLatexPreviewSource(input: string): LatexPreviewResult {
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
    src = `\\documentclass{article}
\\begin{document}
${src.trim()}
\\end{document}`;
    warnings.push("No \\begin{document} found; content was wrapped in a minimal article for preview.");
  }

  const hostileLines = stripHostilePreambleLines(src);
  src = hostileLines.text;
  if (hostileLines.stripped) {
    warnings.push("Preview removed \\newcommand, \\geometry, \\hypersetup, and similar preamble lines.");
  }

  // Body-only: strip floats/tabularx and hostile inline macros (preview only)
  const docMatch = src.match(
    new RegExp(`^([\\s\\S]*?${RE_BEGIN_DOC.source})([\\s\\S]*?)(${RE_END_DOC.source})\\s*$`),
  );
  if (docMatch) {
    let body = docMatch[2];
    body = stripFloatLikeEnvironments(body);
    body = stripHostileInlineMacros(body);
    src = `${docMatch[1]}${body}${docMatch[3]}`;
  } else {
    src = stripHostileInlineMacros(stripFloatLikeEnvironments(src));
  }

  const macroStripped = stripUnsupportedPreviewMacros(src);
  src = macroStripped.text;
  if (macroStripped.stripped) {
    warnings.push("NFSS/font commands (e.g. \\fontsize, \\selectfont) were removed for preview.");
  }

  const titleFixed = fixTitleAuthorDateForPreview(src);
  src = titleFixed.text;
  if (titleFixed.fixed) {
    warnings.push("\\title / \\author / \\date were normalized to use {…} arguments.");
  }

  if (stripped || simplified) {
    const bits: string[] = [];
    if (stripped) bits.push("\\usepackage lines removed (browser cannot load CTAN packages)");
    if (simplified) bits.push("only document body is shown inside a minimal article shell");
    warnings.push(
      `Preview note: ${bits.join("; ")}. Your editor and .tex download still hold the full source.`,
    );
  }

  const balanced = balancePreviewDocument(src);
  src = normalizeUnicodeForLatexJs(balanced.source);
  if (balanced.fixed) {
    const bits: string[] = [];
    if (balanced.envFixed) bits.push("missing \\end{…} for some environments");
    if (balanced.braceFixed) bits.push("missing closing `}` for some groups");
    warnings.push(`Preview auto-closed: ${bits.join(" and ")}.`);
  }

  return { source: src, warnings };
}

/** Smart quotes and odd Unicode sometimes confuse the in-browser parser. */
function normalizeUnicodeForLatexJs(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u00a0\u2007\u202f]/g, " ");
}

/**
 * If the full sanitize pipeline still fails LaTeX.js `parse`, strip constructs that often break it.
 * Level 1: drop tables (tabular / tabular*, booktabs, multicolumn).
 * Level 2: also flatten \\section/\\subsection to bold headings and remove \\maketitle.
 */
/** Re-run environment/brace balancing + Unicode cleanup (e.g. after escalation). */
export function finalizePreviewSource(src: string): string {
  return normalizeUnicodeForLatexJs(balancePreviewDocument(src).source);
}

export function escalatePreviewForLatexJs(source: string, level: 1 | 2): string {
  let s = normalizeUnicodeForLatexJs(source);

  for (const env of ["tabular*", "tabular"]) {
    const e = escapeRegExpLiteral(env);
    s = s.replace(
      new RegExp(`\\\\begin\\{${e}\\}[\\s\\S]*?\\\\end\\{${e}\\}`, "g"),
      "\n\n\\textit{(Table omitted in preview)}\\par\n\n",
    );
  }

  s = s
    .replace(/\\multicolumn\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\hline\b/g, "")
    .replace(/\\cline(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\(?:toprule|midrule|bottomrule|cmidrule)(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, "");

  if (level >= 2) {
    s = s.replace(/\\maketitle\b/g, "");
    s = s
      .replace(/\\subsubsection\*?\{([^}]*)\}/g, (_, t: string) => `\\textbf{${t}}\\par\\smallskip\n`)
      .replace(/\\subsection\*?\{([^}]*)\}/g, (_, t: string) => `\\textbf{\\large ${t}}\\par\\smallskip\n`)
      .replace(/\\section\*?\{([^}]*)\}/g, (_, t: string) => `\\textbf{\\Large ${t}}\\par\\medskip\n`);
  }

  return s.replace(/\n{3,}/g, "\n\n");
}

export function escapeHtmlForSrcDoc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractBodyForCompatibilityPreview(src: string): string {
  const paired = src.match(
    new RegExp(`${RE_BEGIN_DOC.source}([\\s\\S]*?)${RE_END_DOC.source}`, "m"),
  );
  if (paired) return paired[1].trim();
  return src.trim();
}

function stripLatexCommandsToText(line: string): string {
  return (
    line
      .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
      .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
      .replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>")
      .replace(/\\(?:quad|qquad|smallskip|medskip|bigskip|par)\b/g, " ")
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
      .replace(/[{}]/g, "")
      .replace(/\\\\/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function buildCompatibilityPreviewHtml(sanitizedSource: string): string {
  const body = extractBodyForCompatibilityPreview(sanitizedSource);
  const lines = body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("%"));

  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const section = raw.match(/^\\section\*?\{([^}]*)\}/);
    if (section) {
      closeList();
      out.push(`<h2>${escapeHtmlForSrcDoc(section[1].trim())}</h2>`);
      continue;
    }
    const subsection = raw.match(/^\\subsection\*?\{([^}]*)\}/);
    if (subsection) {
      closeList();
      out.push(`<h3>${escapeHtmlForSrcDoc(subsection[1].trim())}</h3>`);
      continue;
    }
    if (/^\\begin\{itemize\}/.test(raw) || /^\\begin\{enumerate\}/.test(raw)) {
      closeList();
      inList = true;
      out.push("<ul>");
      continue;
    }
    if (/^\\end\{itemize\}/.test(raw) || /^\\end\{enumerate\}/.test(raw)) {
      closeList();
      continue;
    }
    if (/^\\item\b/.test(raw)) {
      if (!inList) {
        inList = true;
        out.push("<ul>");
      }
      const item = stripLatexCommandsToText(raw.replace(/^\\item\s*/, ""));
      if (item) out.push(`<li>${escapeHtmlForSrcDoc(item)}</li>`);
      continue;
    }
    const text = stripLatexCommandsToText(raw);
    if (!text) continue;
    closeList();
    out.push(`<p>${escapeHtmlForSrcDoc(text)}</p>`);
  }
  closeList();

  return out.join("\n");
}

/**
 * Minimal HTML shown when LaTeX.js throws — still useful for checking structure.
 */
export function buildPreviewFallbackHtml(sanitizedSource: string): string {
  const compatibility = buildCompatibilityPreviewHtml(sanitizedSource);
  const esc = escapeHtmlForSrcDoc(sanitizedSource);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { margin:0; font-family: ui-serif, Georgia, serif; background:#fafafa; color:#1e293b; }
  .dark body { background:#0a0a0b; color:#e4e4e7; }
  .wrap { padding: 1rem 1.25rem; max-width: 52rem; }
  .note { font-size: 13px; color:#64748b; margin-bottom: 12px; line-height: 1.5; }
  .dark .note { color:#a1a1aa; }
  .compat h2 { margin: 1rem 0 .35rem; font-size: 1.05rem; letter-spacing: .01em; text-transform: uppercase; }
  .compat h3 { margin: .75rem 0 .35rem; font-size: .95rem; font-weight: 700; }
  .compat p { margin: .2rem 0; line-height: 1.45; font-size: .92rem; }
  .compat ul { margin: .35rem 0 .6rem 1.15rem; padding: 0; }
  .compat li { margin: .18rem 0; line-height: 1.42; font-size: .9rem; }
  details { margin-top: .9rem; }
  summary { cursor: pointer; font-size: 12px; color:#64748b; }
  pre { margin:0; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.45; border:1px solid #e2e8f0; border-radius:8px; padding:12px; background:#fff; }
  .dark pre { border-color:#27272a; background:#18181b; }
</style></head><body><div class="wrap"><p class="note">The in-browser LaTeX renderer could not fully parse this document. Showing a compatibility preview below. Download <strong>.tex</strong> for exact local compilation output.</p><div class="compat">${compatibility}</div><details><summary>Show sanitized LaTeX source</summary><pre>${esc}</pre></details></div></body></html>`;
}
