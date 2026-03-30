import { InferenceClient } from "@huggingface/inference";
import { NextResponse } from "next/server";

/**
 * Server proxy for Hugging Face sentence embeddings (feature extraction).
 * Uses `@huggingface/inference` so requests go through the current Inference
 * Providers stack — raw `https://api-inference.huggingface.co/models/...`
 * calls often fail (410/404) after the legacy serverless API was retired.
 *
 * Request body: { "texts": string[] }
 * Response: { "embeddings": number[][] } — one vector per input string.
 */

/** Strong retrieval / similarity models (feature extraction). Tried in order if unset. */
const EMBEDDING_MODEL_DEFAULTS = [
  "BAAI/bge-large-en-v1.5",
  "intfloat/e5-large-v2",
  "sentence-transformers/all-mpnet-base-v2",
] as const;

function embeddingCandidates(): string[] {
  const env = process.env.HF_EMBEDDINGS_MODEL?.trim();
  if (env) return [env];
  return [...EMBEDDING_MODEL_DEFAULTS];
}

function meanPool(tokenRows: number[][]): number[] {
  const dim = tokenRows[0].length;
  const acc = new Array(dim).fill(0);
  for (const row of tokenRows) {
    for (let i = 0; i < dim; i++) acc[i] += row[i];
  }
  for (let i = 0; i < dim; i++) acc[i] /= tokenRows.length;
  return acc;
}

/** Normalize HF feature-extraction tensors to one row per input text. */
function normalizeEmbeddings(raw: unknown, batchSize: number): number[][] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Empty embedding response from provider");
  }

  const first = raw[0];

  // Single sequence, pooled vector: [0.12, -0.34, ...]
  if (typeof first === "number") {
    if (batchSize !== 1) {
      throw new Error("Received one vector but multiple inputs were sent");
    }
    return [raw as number[]];
  }

  // Batch of pooled vectors: [[...], [...]]
  if (Array.isArray(first) && typeof (first as number[])[0] === "number") {
    const rows = raw as number[][];
    if (rows.length !== batchSize) {
      throw new Error(`Expected ${batchSize} embedding rows, got ${rows.length}`);
    }
    return rows;
  }

  // Token-level: [[[tok dim], ...], ...] → mean-pool each sequence
  if (
    Array.isArray(first) &&
    Array.isArray((first as number[][])[0]) &&
    typeof (first as number[][][])[0][0][0] === "number"
  ) {
    const pooled = (raw as number[][][]).map(meanPool);
    if (pooled.length !== batchSize) {
      throw new Error(`Expected ${batchSize} sequences after pooling, got ${pooled.length}`);
    }
    return pooled;
  }

  throw new Error("Unrecognized embedding tensor shape from provider");
}

export async function POST(req: Request) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "HF_TOKEN is not set. Add it to .env.local to enable semantic matching." },
      { status: 503 },
    );
  }

  let body: { texts?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const texts = body.texts?.filter((t) => typeof t === "string" && t.length > 0) ?? [];
  if (texts.length === 0) {
    return NextResponse.json({ error: "texts[] required" }, { status: 400 });
  }

  const models = embeddingCandidates();
  console.log("[api/embeddings] candidates=%s batchSize=%d", JSON.stringify(models), texts.length);

  const client = new InferenceClient(token);
  const tried: string[] = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const raw = await client.featureExtraction({
        model,
        inputs: texts,
      });
      const embeddings = normalizeEmbeddings(raw, texts.length);
      if (i > 0) {
        console.log("[api/embeddings] success after fallback model=%s", model);
      }
      return NextResponse.json({ embeddings, model });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tried.push(`${model}: ${msg.slice(0, 200)}`);
      const isLast = i === models.length - 1;
      if (isLast) {
        return NextResponse.json(
          {
            error: "Hugging Face embeddings request failed for all candidate models",
            detail: msg,
            attempted: tried,
            hint: "Confirm HF_TOKEN and Inference Providers; set HF_EMBEDDINGS_MODEL to a model you can run (e.g. BAAI/bge-large-en-v1.5).",
          },
          { status: 502 },
        );
      }
      console.log("[api/embeddings] model=%s failed, trying next: %s", model, msg.slice(0, 120));
    }
  }

  return NextResponse.json({ error: "No embedding models to try" }, { status: 500 });
}
