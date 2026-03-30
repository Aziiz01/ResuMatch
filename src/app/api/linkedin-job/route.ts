import { load } from "cheerio";
import { NextResponse } from "next/server";
import {
  extractJobDescriptionFromLinkedInHtml,
  extractLinkedInJobPostingIdFromUrl,
  isLinkedInSeoTeaser,
  isLinkedInShortLink,
  normalizeLinkedInJobUrl,
} from "@/lib/linkedinJob";

export const maxDuration = 30;

const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

function extractWithCheerio(html: string): { title?: string; text: string } | null {
  const $ = load(html);

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").first().text()?.trim() ||
    undefined;

  const selectors = [
    ".show-more-less-html__markup",
    ".description__text",
    ".jobs-description-content__text",
    ".jobs-description__text",
    "[data-job-description]",
    "div.jobs-description",
    "article.jobs-description",
    ".jobs-box__html-content",
  ];
  for (const sel of selectors) {
    const t = $(sel).first().text()?.trim();
    if (t && t.length > 80 && !isLinkedInSeoTeaser(t)) {
      return { title, text: t };
    }
  }

  const main = $("main").first().text()?.trim();
  if (main && main.length > 200 && !isLinkedInSeoTeaser(main)) {
    return { title, text: main.slice(0, 32000) };
  }

  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim();
  if (ogDesc && ogDesc.length > 120 && !isLinkedInSeoTeaser(ogDesc)) {
    return { title, text: ogDesc };
  }

  return null;
}

function extractFromJobHtml(html: string): { title?: string; text: string } | null {
  let out = extractJobDescriptionFromLinkedInHtml(html);
  if (out?.text && out.text.length >= 80 && !isLinkedInSeoTeaser(out.text)) {
    return out;
  }
  out = extractWithCheerio(html) ?? out;
  if (out?.text && !isLinkedInSeoTeaser(out.text)) {
    return out;
  }
  return null;
}

const GUEST_JOB_POSTING = (id: string) =>
  `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`;

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.url === "string" ? body.url.trim() : "";
  const direct = normalizeLinkedInJobUrl(raw);
  const short = isLinkedInShortLink(raw);
  const fetchUrl = direct ?? short;
  if (!fetchUrl) {
    return NextResponse.json(
      {
        error:
          "Enter a LinkedIn job URL (e.g. https://www.linkedin.com/jobs/view/123456789) or an lnkd.in short link that opens a job posting.",
      },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `LinkedIn returned HTTP ${res.status}. Try pasting the job description manually, or open the posting while logged in and copy the text.`,
        },
        { status: 502 },
      );
    }

    const finalUrl = res.url;
    if (!normalizeLinkedInJobUrl(finalUrl)) {
      return NextResponse.json(
        {
          error:
            "That link did not open a LinkedIn job posting (after redirects). Use a /jobs/view/… URL or paste the description.",
        },
        { status: 400 },
      );
    }

    let html = await res.text();
    if (html.length < 500) {
      return NextResponse.json(
        {
          error:
            "The page was too short—LinkedIn may require login in the browser. Paste the job description manually.",
        },
        { status: 422 },
      );
    }

    const loginHints = /sign in|join linkedin|authwall|checkpoint/i;
    if (loginHints.test(html.slice(0, 8000))) {
      return NextResponse.json(
        {
          error:
            "LinkedIn returned a login wall from the server. Copy the job description from the posting while logged in and paste it here.",
        },
        { status: 422 },
      );
    }

    const jobId = extractLinkedInJobPostingIdFromUrl(finalUrl);
    let extracted: { title?: string; text: string } | null = null;

    if (jobId) {
      try {
        const guestRes = await fetch(GUEST_JOB_POSTING(jobId), {
          headers: FETCH_HEADERS,
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });
        if (guestRes.ok) {
          const guestHtml = await guestRes.text();
          if (guestHtml.length > 800) {
            extracted = extractFromJobHtml(guestHtml);
          }
        }
      } catch {
        /* fall through to public page */
      }
    }

    if (!extracted?.text || extracted.text.length < 60 || isLinkedInSeoTeaser(extracted.text)) {
      extracted = extractFromJobHtml(html) ?? extracted;
    }

    if (extracted?.text && isLinkedInSeoTeaser(extracted.text)) {
      extracted = null;
    }

    if (!extracted?.text || extracted.text.length < 40) {
      return NextResponse.json(
        {
          error:
            "LinkedIn only returned a short preview of this job (not the full description). Copy the full text from the job page while logged in and paste it here.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text: extracted.text,
      title: extracted.title ?? null,
      url: finalUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Request failed: ${msg}. You can still paste the job description manually.`,
      },
      { status: 502 },
    );
  }
}
