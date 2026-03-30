import { NextResponse } from "next/server";

/**
 * Resume and CV text generation via Hugging Face Inference Router chat completions.
 *
 * `POST https://router.huggingface.co/v1/chat/completions` (OpenAI-style `messages`).
 *
 * Request body: { "prompt": string }
 * Response: { "text": string, "model": string }
 */

const ROUTER_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

/**
 * Default chat models when `HF_GENERATE_MODEL` is unset (strong instruct models on the HF router).
 * Order: try first, then fall back on provider errors or overload (502/503).
 */
const ROUTER_MODEL_FALLBACKS = [
  "meta-llama/Llama-3.1-8B-Instruct",
  "Qwen/Qwen2.5-7B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.3",
] as const;

/** Enough room for CV suggestions and LaTeX blocks without truncating mid-sentence. */
const MAX_COMPLETION_TOKENS = 2048;

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
    max_tokens: MAX_COMPLETION_TOKENS,
    temperature: 0.7,
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
  const candidates = explicit ? [explicit] : [...ROUTER_MODEL_FALLBACKS];

  console.log("[api/generate] HF_GENERATE_MODEL=%s → candidates=%s", explicit ?? "(unset)", JSON.stringify(candidates));

  try {
    const tried: string[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      console.log("[api/generate] try %d/%d model=%s", i + 1, candidates.length, model);

      const result = await routerChatOnce(token, model, prompt);

      if (result.ok) {
        console.log("[api/generate] success model=%s", result.model);
        return NextResponse.json({ text: result.text, model: result.model });
      }

      console.log("[api/generate] failed model=%s status=%s detail=%s", model, result.status, result.detail.slice(0, 200));

      tried.push(`${model}: ${result.detail}`);

      const isLast = i === candidates.length - 1;
      const canFallback =
        !explicit &&
        !isLast &&
        (shouldTryNextFallback(result.status, result.detail) ||
          result.status === 502 ||
          result.status === 503);

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
            mode: "chat",
            ...(tried.length > 1 && { attempted: tried.slice(0, -1) }),
            hint:
              explicit === undefined
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
        hint: "Accept the model license on huggingface.co if required (e.g. Llama), enable Inference Providers, or set HF_GENERATE_MODEL to a model your account can run.",
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
