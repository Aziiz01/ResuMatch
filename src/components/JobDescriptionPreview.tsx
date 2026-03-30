"use client";

/**
 * Renders plain job description text with readable typography: paragraphs, lists, line breaks.
 */
export function JobDescriptionPreview({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) {
    return (
      <p className="text-sm italic text-slate-500 dark:text-zinc-500">Nothing to preview yet.</p>
    );
  }

  const chunks = trimmed.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="space-y-4 text-[0.9375rem] leading-relaxed text-slate-800 dark:text-zinc-200">
      {chunks.map((chunk, i) => (
        <Block key={i} chunk={chunk} />
      ))}
    </div>
  );
}

function Block({ chunk }: { chunk: string }) {
  const rawLines = chunk.split("\n").map((l) => l.trim());
  const lines = rawLines.filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  const listMatch = (line: string) => {
    const bullet = /^[-•*]\s+(.+)$/.exec(line);
    if (bullet) return { kind: "bullet" as const, text: bullet[1] };
    const num = /^\d+[.)]\s+(.+)$/.exec(line);
    if (num) return { kind: "num" as const, text: num[1] };
    return null;
  };

  const first = listMatch(lines[0]);
  const restList = lines.slice(1).every((l) => listMatch(l));
  if (first && restList && lines.length >= 2) {
    return (
      <ul className="ml-1 list-none space-y-2 border-l-2 border-emerald-500/35 pl-4 dark:border-emerald-400/25">
        {lines.map((line, j) => {
          const m = listMatch(line);
          const content = m?.text ?? line;
          return (
            <li key={j} className="pl-0.5 text-slate-800 dark:text-zinc-200">
              <span className="text-emerald-700 dark:text-emerald-400/90">▸</span>{" "}
              <span>{content}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  const paraLines = chunk.split("\n");
  return (
    <p className="text-pretty text-slate-800 dark:text-zinc-200">
      {paraLines.map((line, j) => (
        <span key={j}>
          {line}
          {j < paraLines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}
