/**
 * Skill extraction + keyword/semantic matching.
 *
 * - Pulls candidate skills from the job description (known tech list + phrases).
 * - Keyword match: normalized substring / word-boundary checks against resume text.
 * - Semantic match: optional; caller passes per-skill similarity scores from embeddings.
 */

const STOP = new Set([
  "and", "or", "the", "a", "an", "to", "of", "in", "for", "on", "with", "as", "at",
  "by", "from", "our", "your", "we", "you", "will", "be", "is", "are", "was", "been",
  "have", "has", "had", "this", "that", "these", "those", "all", "any", "can", "may",
  "must", "should", "work", "team", "role", "job", "position", "company", "years",
  "year", "experience", "looking", "seeking", "responsible", "including", "such",
  "etc", "other", "strong", "excellent", "good", "ability", "skills", "skill",
]);

/** Curated tech + role terms often found in JDs (extend as needed). */
export const KNOWN_SKILLS: string[] = [
  "javascript", "typescript", "python", "java", "kotlin", "swift", "go", "golang", "rust",
  "c#", "c++", "ruby", "php", "scala", "r", "sql", "html", "css", "sass", "scss", "less",
  "react", "react.js", "next.js", "nextjs", "vue", "vue.js", "angular", "svelte", "nuxt",
  "node.js", "nodejs", "express", "nestjs", "django", "flask", "fastapi", "spring", "spring boot",
  ".net", "dotnet", "asp.net", "graphql", "rest", "api", "grpc", "websocket",
  "aws", "azure", "gcp", "google cloud", "kubernetes", "k8s", "docker", "terraform",
  "jenkins", "gitlab ci", "github actions", "ci/cd", "cicd", "ansible", "linux", "unix",
  "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch", "kafka", "rabbitmq",
  "snowflake", "databricks", "spark", "hadoop", "airflow", "dbt", "etl", "ml", "ai",
  "machine learning", "deep learning", "nlp", "llm", "pytorch", "tensorflow", "keras",
  "pandas", "numpy", "scikit-learn", "opencv", "tableau", "power bi", "looker",
  "figma", "sketch", "agile", "scrum", "kanban", "jira", "confluence", "microservices",
  "serverless", "lambda", "oauth", "jwt", "sso", "ldap", "oauth2", "ssl", "tls",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract quoted or parenthetical phrases and comma-separated chunks from JD. */
function rawChunks(jd: string): string[] {
  const text = jd.replace(/\r/g, "\n");
  const parts: string[] = [];
  const re = /["'“”‘’]([^"'"'“”‘’]{2,80})["'“”‘’]|\(([^)]{2,80})\)|([^,\n;•|/]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const chunk = (m[1] || m[2] || m[3] || "").trim();
    if (chunk.length >= 2) parts.push(chunk);
  }
  if (parts.length === 0) {
    text.split(/[\n;•]+/).forEach((p) => parts.push(p.trim()));
  }
  return parts;
}

function tokenCandidates(chunk: string): string[] {
  const out: string[] = [];
  const cleaned = chunk.replace(/^[-*•\d.)]+\s*/, "").trim();
  if (cleaned.length < 2) return out;
  out.push(cleaned);
  cleaned.split(/[/|+&,]/).forEach((bit) => {
    const t = bit.trim();
    if (t.length >= 2) out.push(t);
  });
  return out;
}

/** Build a deduped list of skills to score from the job description + known list hits. */
export function extractJobSkills(jobDescription: string, maxSkills = 48): string[] {
  const jd = normalize(jobDescription);
  const seen = new Set<string>();
  const ordered: string[] = [];

  const add = (s: string) => {
    const n = normalize(s);
    if (n.length < 2 || n.length > 64) return;
    if (STOP.has(n)) return;
    if (/^\d+$/.test(n)) return;
    const key = n;
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(s.trim());
  };

  for (const k of KNOWN_SKILLS) {
    if (jd.includes(k)) add(k);
  }

  for (const chunk of rawChunks(jobDescription)) {
    for (const c of tokenCandidates(chunk)) {
      add(c);
    }
  }

  return ordered.slice(0, maxSkills);
}

/** True if `skill` appears in resume text (word boundary or substring for short tokens). */
export function keywordMatch(resumeNorm: string, skill: string): boolean {
  const s = normalize(skill);
  if (s.length < 2) return false;
  if (!resumeNorm.includes(s)) return false;
  if (s.length <= 3 || /[#.+]/.test(s)) return true;
  const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(resumeNorm);
}

export type SkillResult = {
  skill: string;
  keywordMatch: boolean;
  semanticScore: number | null;
  /** Effective match for UI: keyword OR semantic above threshold. */
  matched: boolean;
};

const SEMANTIC_THRESHOLD = 0.42;

/**
 * Combine keyword flags with optional semantic scores (same order as skills array).
 * semanticScores[i] is max cosine vs resume chunks for skills[i], or null if skipped.
 */
export function combineMatches(
  skills: string[],
  keywordFlags: boolean[],
  semanticScores: (number | null)[],
): SkillResult[] {
  return skills.map((skill, i) => {
    const kw = keywordFlags[i] ?? false;
    const sem = semanticScores[i] ?? null;
    const semanticOk = sem !== null && sem >= SEMANTIC_THRESHOLD;
    const matched = kw || semanticOk;
    return {
      skill,
      keywordMatch: kw,
      semanticScore: sem,
      matched,
    };
  });
}

export function matchPercentage(results: SkillResult[]): number {
  if (results.length === 0) return 0;
  const n = results.filter((r) => r.matched).length;
  return Math.round((n / results.length) * 1000) / 10;
}
