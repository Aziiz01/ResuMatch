/** Split resume text into bullet lines for per-bullet rewriting. */

export function extractBullets(resume: string): string[] {
  const lines = resume
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\u2022]+\s*/, "").trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // If few long paragraphs, split on sentence boundaries into pseudo-bullets.
  if (lines.length <= 3 && lines.some((l) => l.length > 240)) {
    const merged = lines.join(" ");
    const parts = merged.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    return parts.slice(0, 12);
  }

  return lines.slice(0, 24);
}

export function buildRewritePrompt(jobDescription: string, bullet: string): string {
  const jdShort = jobDescription.slice(0, 2800);
  return `You are a professional resume editor. I will provide a resume bullet and a job description. Rewrite the bullet so that it:

1. Starts with a strong action verb (e.g., Developed, Designed, Implemented).
2. Shows measurable results or impact if possible (e.g., improved performance by 30%).
3. Uses keywords from the job description naturally.
4. Remains concise (one sentence).

Output only the rewritten bullet as a single sentence. Do not include quotes, bullet symbols, labels, or the words "Example Output".

Example Input:
Resume Bullet: "Built web apps using React"
Job Description: "Looking for a front-end developer with React and Node.js experience, deployed on cloud platforms"

Example Output:
Developed web applications using React and Node.js, deployed on cloud platforms, improving load times by 30%.

---

Job description:
${jdShort}

Resume bullet to rewrite:
${bullet}

Rewritten bullet:`;
}

export function buildWholeResumePrompt(jobDescription: string, resumeText: string): string {
  const jdShort = jobDescription.slice(0, 2800);
  const resumeShort = resumeText.slice(0, 6000);

  return `You are a professional resume editor. I will provide a resume and a job description.
Rewrite and improve the resume content as one unified recommendation block so it better matches the role.

Rules:
1. Keep the output concise and practical for CV editing.
2. Use strong action verbs and include measurable impact where reasonable.
3. Naturally incorporate relevant keywords from the job description.
4. Return one combined suggestion block (not separate suggestions per sentence).
5. Output plain text only (no markdown, no labels, no bullet symbols unless they are part of the final recommended wording).
6. Do NOT include meta commentary, explanations, or self-referential notes (e.g., no "Note:", no "I kept/removed", no "I emphasized", no "This resume").
7. Return only the improved resume content itself, nothing before or after.

Job description:
${jdShort}

Resume:
${resumeShort}

Unified CV improvement suggestion:`;
}

/** Remove model meta-commentary that sometimes leaks into generation output. */
export function sanitizeCvSuggestionOutput(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const lines = text.split("\n");
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (/^note\s*:/i.test(t)) return false;
    if (/^(explanation|rationale|summary)\s*:/i.test(t)) return false;
    if (/^i\s+(kept|removed|emphasized|focused|updated|rewrote)\b/i.test(t)) return false;
    if (/^this\s+(resume|version|output)\b/i.test(t)) return false;
    return true;
  });

  const joined = kept.join("\n").trim();
  // Fall back to original if sanitization would wipe everything.
  return joined || text;
}

export function buildSelectionImprovePrompt(
  jobDescription: string,
  fullSuggestion: string,
  selectedText: string,
  instruction: string,
): string {
  const jdShort = jobDescription.slice(0, 2400);
  const suggestionShort = fullSuggestion.slice(0, 5000);
  const selected = selectedText.trim().slice(0, 800);
  const ask = instruction.trim().slice(0, 500);

  return `You are a professional resume editor.
You will improve ONLY one selected part from a larger CV suggestion block.

Rules:
1. Rewrite only the selected part and return only replacement text.
2. Keep it concise and resume-ready.
3. Preserve factual meaning unless the user instruction asks otherwise.
4. Use strong action verbs and measurable impact where possible.
5. Incorporate relevant keywords from the job description naturally.
6. Output plain text only (no quotes, no markdown, no labels).

Job description:
${jdShort}

Current full suggestion block (for context):
${suggestionShort}

Selected part to improve:
${selected}

User instruction for this part:
${ask || "Make this clearer, more specific, and more impactful."}

Improved replacement text:`;
}

/**
 * Models sometimes emit HTML tags in LaTeX. Convert common tags to LaTeX and strip the rest.
 */
export function sanitizeLatexModelOutput(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n").trim();
  if (!s) return "";

  for (let i = 0; i < 24; i++) {
    const before = s;
    s = s
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, "\\textbf{$1}")
      .replace(/<b>([\s\S]*?)<\/b>/gi, "\\textbf{$1}")
      .replace(/<em>([\s\S]*?)<\/em>/gi, "\\textit{$1}")
      .replace(/<i>([\s\S]*?)<\/i>/gi, "\\textit{$1}");
    if (s === before) break;
  }

  s = s.replace(/<br\s*\/?>/gi, "\\\\\n");
  s = s.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "");

  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildFinalOptimizedCvPrompt(
  jobDescription: string,
  resumeText: string,
  suggestionsText: string,
): string {
  const jdShort = jobDescription.slice(0, 2800);
  const resumeShort = resumeText.slice(0, 6000);
  const suggestionsShort = suggestionsText.slice(0, 4000);

  return `You are a senior resume writer.
Generate a final optimized CV text tailored to the role.

Rules:
1. Output only the final CV content in plain text.
2. Use clear sections (e.g., Summary, Skills, Experience, Projects, Education) where relevant.
3. Keep it concise, achievement-focused, and keyword-aligned to the job description.
4. Use strong action verbs and measurable outcomes where possible.
5. Do NOT include commentary or meta notes (no "Note:", no explanations).
6. Do NOT wrap in markdown or code fences.

Job description:
${jdShort}

Original resume:
${resumeShort}

Improvement suggestions (context):
${suggestionsShort}

Final optimized CV:`;
}

export const DEFAULT_LATEX_TEMPLATE = `\\documentclass[10pt]{article}
\\title{<FULL NAME>}
\\author{<City, Country> \\;|\\; <email@example.com> \\;|\\; <+00 000 000 0000> \\;|\\; <linkedin.com/in/username>}
\\date{}

\\begin{document}
\\maketitle
\\vspace{-1.1em}
\\hrule
\\vspace{0.8em}

\\section*{Professional Summary}
<2-4 lines tailored to the target role, highlighting years of experience, strongest domain skills, and measurable impact.>

\\section*{Core Skills}
<Skill Group 1>: <keyword-rich skills> \\\\
<Skill Group 2>: <keyword-rich skills> \\\\
<Skill Group 3>: <keyword-rich skills>

\\section*{Experience}
\\textbf{<Job Title>} \\hfill \\textit{<Company>, <Location>} \\\\
\\textit{<Month YYYY> -- <Month YYYY>} \\\\
\\begin{itemize}
  \\item <Action + task + measurable result aligned to JD keywords.>
  \\item <Action + ownership + impact with number/metric where possible.>
  \\item <Action + collaboration/technology + business outcome.>
\\end{itemize}

\\textbf{<Job Title>} \\hfill \\textit{<Company>, <Location>} \\\\
\\textit{<Month YYYY> -- <Month YYYY>} \\\\
\\begin{itemize}
  \\item <Action + scope + result.>
  \\item <Action + optimization + impact.>
\\end{itemize}

\\section*{Projects}
\\textbf{<Project Name>} \\hfill \\textit{<Tech Stack>} \\\\
\\begin{itemize}
  \\item <Problem solved + implementation + measurable outcome.>
\\end{itemize}

\\section*{Education}
\\textbf{<Degree>} \\hfill \\textit{<Institution>, <Location>} \\\\
\\textit{<Year or Date Range>} \\\\
<Optional: honors, relevant coursework, certifications.>

\\end{document}`;

export function buildLatexCvPrompt(jobDescription: string, resumeText: string): string {
  const jdShort = jobDescription.slice(0, 2800);
  const resumeShort = resumeText.slice(0, 6000);

  return `You are a professional resume writer and LaTeX expert.
Generate a complete ATS-friendly one-page resume in valid LaTeX code.
Use the provided default template style so the result is clean and visually strong.

Output rules:
- Return ONLY LaTeX, no markdown fences (\`\`\`), no commentary before or after the code.
- Never use HTML tags (no <strong>, <em>, <b>, <i>, <br>, <p>, etc.). Use only LaTeX: \\textbf{}, \\textit{}, \\emph{}, and line breaks with \\\\ or blank lines.
- Use \\documentclass{article}, then \\begin{document} ... \\end{document}.
- Prefer **no** \\usepackage, or at most one simple package. Do NOT use fontspec, geometry, hyperref, fancyhdr, graphicx, tikz, tabularx, longtable, or font packages.
- Structure: \\section{} and \\subsection{}; use \\textbf{}, \\textit{}, \\emph{} for emphasis.
- Lists: only \\begin{itemize} or \\begin{enumerate} with \\item rows; each must have \\end{itemize} or \\end{enumerate}.
- Tables: only plain \\begin{tabular}{...} ... \\end{tabular} with column letters like {l l} or {|l|l|}. No tabularx, multirow, or booktabs.
- Do NOT use: \\newcommand, \\includegraphics, \\href, \\fontsize, \\selectfont, figure/table floats, minipage, multicolumn, color packages, or custom macros.
- Every { must have a matching } on the same logical line or properly nested. Close all groups before \\end{document}.
- Use \\title{...}, \\author{...}, \\date{...} with braces; then \\maketitle if you want a header block.
- Follow this template's structure and style cues (section order, heading style, spacing, and concise bullets), replacing placeholders with real content.
- Keep output to one page worth of concise content.

Default template to follow:
${DEFAULT_LATEX_TEMPLATE}

Sections to cover where relevant: Summary, Skills, Experience, Projects, Education.
Use strong verbs, measurable impact, and keywords from the job description. Keep it concise.

Job description:
${jdShort}

Candidate resume input:
${resumeShort}

LaTeX resume (article class, minimal packages):`;
}
