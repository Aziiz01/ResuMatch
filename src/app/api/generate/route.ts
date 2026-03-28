import { InferenceClient } from "@huggingface/inference";
import { NextResponse } from "next/server";

/**
 * Resume bullet rewrites via Hugging Face Inference.
 *
 * - **Chat / instruct models** → `POST /v1/chat/completions` (OpenAI-style `messages`).
 * - **Text2text models** (e.g. `google/flan-t5-small`) → **not** chat models. They use the
 *   HF Inference text-generation route: `router.huggingface.co/hf-inference/models/<model>`
 *   with `{ inputs, parameters }`, via `@huggingface/inference` `textGeneration` + `endpointUrl`.
 *
 * Request body: { "prompt": string }
 * Response: { "text": string, "model": string }
 */

const ROUTER_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

/** Models that must use text-generation, not chat completions. */
function isText2TextModel(modelId: string): boolean {
  return /^google\/flan-t5-(small|base|large|xl|xxl)$/.test(modelId);
}

function hfInferenceModelUrl(modelId: string): string {
  return `https://router.huggingface.co/hf-inference/models/${modelId}`;
}

/**
 * Chat fallbacks when `HF_GENERATE_MODEL` is unset (instruct / chat models only).
 */
const ROUTER_MODEL_FALLBACKS = [
  "meta-llama/Llama-3.2-1B-Instruct",
  "Qwen/Qwen2.5-1.5B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.3",
] as const;

/** Default when unset: user-requested text2text model. */
const DEFAULT_MODEL = "google/flan-t5-small";

type RouterError = {
  error?: { message?: string; type?: string };
  message?: string;
};

function summarizeRouterFailure(status: number, body: unknown, rawText: string): string {
  if (body && typeof body === "object") {
    const r = body as RouterError;
    const m = r.error?.message ?? r.message;
    if (typeof m === "string" && m.length > 0) return m;
    try {
      return JSON.stringify(body).slice(0, 900);
    } catch {
      /* fall through */
    } 
  }
  return rawText.slice(0, 600) || `HTTP ${status}`;
}

function shouldTryNextFallback(status: number, detail: string): boolean {
  const d = detail.toLowerCase();
  if (status === 401) return false;
  if (status === 429) return false;
  if (d.includes("not supported by any provider")) return true;
  if (d.includes("model_not_found")) return true;
  if (d.includes("unknown model")) return true;
  if (status === 404) return true;
  return false;
}

/**
 * FLAN-T5 / text2text: classic HF inference payload (not chat).
 */
async function routerTextGenerationOnce(
  token: string,
  model: string,
  prompt: string,
): Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; detail: string; parsed?: unknown }
> {
  const client = new InferenceClient(token);
  const endpointUrl = hfInferenceModelUrl(model);

  try {
    const out = await client.textGeneration({
      model,
      endpointUrl,
      inputs: prompt,
      parameters: {
        max_new_tokens: 220,
        temperature: 0.65,
        return_full_text: false,
      },
    });

    const generated =
      out &&
      typeof out === "object" &&
      "generated_text" in out &&
      typeof (out as { generated_text: unknown }).generated_text === "string"
        ? (out as { generated_text: string }).generated_text
        : "";

    const text = generated.trim();
    if (!text) {
      return {
        ok: false,
        status: 502,
        detail: "Empty generated_text from text-generation API",
        parsed: out,
      };
    }
    return { ok: true, text, model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 502, detail: msg };
  }
}

async function routerChatOnce(
  token: string,
  model: string,
  prompt: string,
): Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; detail: string; parsed: unknown }
> {
  const payload = {
    model,
    messages: [{ role: "user" as const, content: prompt }],
    max_tokens: 220,
    temperature: 0.65,
  };

  const run = async () => {
    const res = await fetch(ROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const rawText = await res.text();
    let parsed: unknown = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }
    return { res, rawText, parsed };
  };

  let { res, rawText, parsed } = await run();
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 2500));
    ({ res, rawText, parsed } = await run());
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      detail: summarizeRouterFailure(res.status, parsed, rawText),
      parsed,
    };
  }

  const data = parsed as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    return {
      ok: false,
      status: 502,
      detail: "Empty assistant message from router",
      parsed,
    };
  }

  return { ok: true, text, model };
}

export async function POST(req: Request) {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "HF_TOKEN is not set. Add it to .env.local for AI suggestions." },
      { status: 503 },
    );
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 10) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const explicit = process.env.HF_GENERATE_MODEL?.trim();
  const candidates = explicit
    ? [explicit]
    : [DEFAULT_MODEL, ...ROUTER_MODEL_FALLBACKS];

  console.log("[api/generate] HF_GENERATE_MODEL=%s → candidates=%s", explicit ?? "(unset)", JSON.stringify(candidates));

  try {
    const tried: string[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const mode = isText2TextModel(model) ? "text-generation" : "chat";
      console.log(
        "[api/generate] try %d/%d model=%s mode=%s",
        i + 1,
        candidates.length,
        model,
        mode,
      );

      const result = isText2TextModel(model)
        ? await routerTextGenerationOnce(token, model, prompt)
        : await routerChatOnce(token, model, prompt);

      if (result.ok) {
        console.log("[api/generate] success model=%s mode=%s", result.model, mode);
        return NextResponse.json({ text: result.text, model: result.model });
      }

      console.log("[api/generate] failed model=%s status=%s detail=%s", model, result.status, result.detail.slice(0, 200));

      tried.push(`${model}: ${result.detail}`);

      const isLast = i === candidates.length - 1;
      const canFallback =
        !explicit &&
        !isLast &&
        (shouldTryNextFallback(result.status, result.detail) ||
          (isText2TextModel(model) && (result.status === 502 || result.status === 503)));

      if (!canFallback) {
        console.log("[api/generate] no further fallback; returning error for model=%s", model);
        const status =
          result.status >= 400 && result.status < 600 ? result.status : 502;
        return NextResponse.json(
          {
            error: "Hugging Face inference returned an error",
            detail: result.detail,
            upstreamStatus: result.status,
            model,
            mode: isText2TextModel(model) ? "text-generation" : "chat",
            ...(tried.length > 1 && { attempted: tried.slice(0, -1) }),
            hint: isText2TextModel(model)
              ? "Text2text models (e.g. FLAN-T5) use /hf-inference/models/..., not chat. If this fails, check HF_TOKEN and that the model is available on Inference Providers."
              : explicit === undefined
                ? "Enable inference providers at https://hf.co/settings/inference-providers or set HF_GENERATE_MODEL."
                : "Set HF_GENERATE_MODEL to a model your enabled providers support.",
          },
          { status },
        );
      }

      console.log("[api/generate] falling back to next candidate");
    }

    console.log("[api/generate] all candidates exhausted");
    return NextResponse.json(
      {
        error: "All candidate models failed",
        attempted: tried,
        hint: "Set HF_GENERATE_MODEL=google/flan-t5-small for FLAN-T5, or enable providers for chat fallbacks.",
      },
      { status: 502 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "Request to Hugging Face failed",
        detail: msg,
      },
      { status: 502 },
    );
  }
}
