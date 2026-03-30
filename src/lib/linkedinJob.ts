/**
 * Validate and normalize LinkedIn job posting URLs (server-side fetch target).
 * Blocks open redirects / SSRF to non-LinkedIn hosts.
 */

const LINKEDIN_HOST = /^(www\.|([a-z]{2,3}\.))?linkedin\.com$/i;

export function normalizeLinkedInJobUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (!LINKEDIN_HOST.test(u.hostname)) {
    return null;
  }
  if (!u.pathname.toLowerCase().includes("/jobs/")) {
    return null;
  }
  u.hash = "";
  return u.href;
}

/** Short links (e.g. lnkd.in) — fetch must follow redirects; validate with `normalizeLinkedInJobUrl(res.url)`. */
/**
 * Numeric job posting id from a /jobs/view/… URL. Slugs often end with "-company-1234567890".
 */
export function extractLinkedInJobPostingIdFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (!LINKEDIN_HOST.test(u.hostname)) {
    return null;
  }
  const m = u.pathname.match(/\/jobs\/view\/([^/?#]+)\/?$/i);
  if (!m) return null;
  const slug = m[1];
  const lastSegment = slug.split("-").pop() ?? "";
  if (/^\d{5,}$/.test(lastSegment)) return lastSegment;
  if (/^\d{5,}$/.test(slug)) return slug;
  return null;
}

/** LinkedIn og:description / SEO snippet — not the full posting (ellipsis + "See similar jobs"). */
export function isLinkedInSeoTeaser(text: string): boolean {
  const t = text.trim();
  if (t.length < 30) return false;
  if (/see this and similar jobs on linkedin/i.test(t)) return true;
  if (/see more on linkedin/i.test(t) && t.length < 1200) return true;
  if (/^posted\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)\s*\./i.test(t) && t.length < 900) return true;
  if (/\u2026\s*see\s+(this\s+)?(and\s+)?similar/i.test(t)) return true;
  if (/\.{3}\s*see\s+this\s+and\s+similar/i.test(t)) return true;
  return false;
}

export function isLinkedInShortLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (u.hostname === "lnkd.in" || u.hostname === "www.lnkd.in") {
    return u.href;
  }
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort extraction from LinkedIn job HTML. Structure changes often; we try JSON-LD JobPosting first.
 */
export function extractJobDescriptionFromLinkedInHtml(html: string): { title?: string; text: string } | null {
  // 1) JSON-LD JobPosting (most reliable when present)
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    const inner = m[1].trim();
    if (!inner) continue;
    try {
      const data = JSON.parse(inner) as unknown;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const type = o["@type"];
        if (type !== "JobPosting" && !(Array.isArray(type) && type.includes("JobPosting"))) continue;
        const title = typeof o.title === "string" ? o.title : undefined;
        const desc = o.description;
        let text = "";
        if (typeof desc === "string") text = stripTags(desc);
        else if (desc && typeof desc === "object") {
          const d = desc as Record<string, unknown>;
          if (typeof d.text === "string") text = stripTags(d.text);
          else if (typeof d.value === "string") text = stripTags(d.value);
        }
        if (text.length >= 80) {
          const header = title ? `${title}\n\n` : "";
          return { title, text: `${header}${text}`.trim() };
        }
      }
    } catch {
      /* next block */
    }
  }

  return null;
}
