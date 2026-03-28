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

const DEFAULT_MODEL =
  process.env.HF_EMBEDDINGS_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";

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

  console.log("[api/embeddings] model=%s batchSize=%d", DEFAULT_MODEL, texts.length);

  const client = new InferenceClient(token);

  try {
    const raw = await client.featureExtraction({
      model: DEFAULT_MODEL,
      inputs: texts,
    });

    const embeddings = normalizeEmbeddings(raw, texts.length);
    return NextResponse.json({ embeddings, model: DEFAULT_MODEL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "Hugging Face embeddings request failed",
        detail: msg,
        hint: "Confirm HF_TOKEN is valid and has Inference API access; try another HF_EMBEDDINGS_MODEL if the model is unavailable.",
      },
      { status: 502 },
    );
  }
}
