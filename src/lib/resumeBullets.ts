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

Job description:
${jdShort}

Resume:
${resumeShort}

Unified CV improvement suggestion:`;
}

export function buildLatexCvPrompt(jobDescription: string, resumeText: string): string {
  const jdShort = jobDescription.slice(0, 2800);
  const resumeShort = resumeText.slice(0, 6000);

  return `You are a professional resume writer and LaTeX expert.
Generate a complete ATS-friendly one-page resume in valid LaTeX code.

Requirements:
- Return ONLY LaTeX code, no explanations and no markdown fences.
- Use an "article" document with clean formatting and readable spacing.
- Avoid external package dependencies when possible (minimize \\usepackage usage).
- Include sections: Summary, Skills, Experience, Projects (if possible), Education.
- Use strong action verbs and measurable impact where possible.
- Naturally include relevant keywords from the job description.
- Keep content concise and realistic.
- Ensure syntax compiles as a standalone .tex document.
- Every \\begin{itemize}, \\begin{enumerate}, \\begin{tabular}, etc. must have a matching \\end{...} before \\end{document}.
- Prefer standard switches (\\small, \\normalsize, \\large) over NFSS font setup (\\fontsize, \\selectfont) unless necessary.
- Use braced arguments for \\title{...}, \\author{...}, and \\date{...} (not bare \\title or \\title Name on one line).

Job description:
${jdShort}

Candidate resume input:
${resumeShort}

Valid LaTeX resume code:`;
}
