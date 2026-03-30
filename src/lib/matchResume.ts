import { cosineSimilarity } from "./cosine";

/** Split resume into sentence-ish chunks for embedding comparison. */
export function splitResumeChunks(resume: string, maxChunks = 24): string[] {
  const cleaned = resume.replace(/\r/g, "\n").trim();
  if (!cleaned) return [];

  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).length > 420 && buf.length > 0) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
    if (chunks.length >= maxChunks - 1) break;
  }
  if (buf.trim()) chunks.push(buf.trim());

  if (chunks.length === 0) chunks.push(cleaned.slice(0, 2000));
  return chunks.slice(0, maxChunks);
}

/**
 * BGE / E5 models are trained with asymmetric prefixes. Without them, cosine scores
 * cluster high and everything looks like a "match".
 */
export function embedTextAsSkillQuery(skill: string): string {
  const t = skill.trim();
  if (!t) return t;
  return `query: ${t}`;
}

export function embedTextAsResumePassage(chunk: string): string {
  const t = chunk.trim();
  if (!t) return t;
  return `passage: ${t}`;
}

/** Fetch embeddings from our Next.js API (proxies Hugging Face). */
export async function fetchEmbeddings(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const res = await fetch("/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (res.status === 503) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Embeddings HTTP ${res.status}`);
  }
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings;
}

/**
 * For each job skill, max cosine similarity between skill embedding and any resume chunk embedding.
 */
export async function semanticScoresForSkills(
  resume: string,
  skills: string[],
): Promise<(number | null)[]> {
  if (skills.length === 0) return [];

  const chunks = splitResumeChunks(resume);
  if (chunks.length === 0) {
    return skills.map(() => null);
  }

  let skillEmb: number[][] | null;
  let chunkEmb: number[][] | null;

  try {
    skillEmb = await fetchEmbeddings(skills.map(embedTextAsSkillQuery));
    chunkEmb = await fetchEmbeddings(chunks.map(embedTextAsResumePassage));
  } catch {
    return skills.map(() => null);
  }

  if (!skillEmb || !chunkEmb || skillEmb.length !== skills.length || chunkEmb.length !== chunks.length) {
    return skills.map(() => null);
  }

  return skills.map((_, i) => {
    let best = 0;
    for (let j = 0; j < chunkEmb.length; j++) {
      const c = cosineSimilarity(skillEmb![i], chunkEmb![j]);
      if (c > best) best = c;
    }
    return best;
  });
}

export async function generateBulletSuggestion(prompt: string): Promise<string> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (res.status === 503) {
    throw new Error("Configure HF_TOKEN in .env.local to enable suggestions.");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      upstreamStatus?: number;
    };
    const msg = [err.error, err.detail].filter(Boolean).join(": ");
    throw new Error(msg || `Generate HTTP ${res.status}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text.trim();
}
