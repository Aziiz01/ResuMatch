import { AUTHOR } from "@/lib/projectMeta";

type Props = {
  className?: string;
  /** Tighter copy for footers and sidebars */
  variant?: "default" | "compact";
};

/**
 * “Built by Aziz …” with website + LinkedIn. Copy lives in `projectMeta.AUTHOR`.
 */
export function AuthorAttribution({ className = "", variant = "default" }: Props) {
  const isCompact = variant === "compact";
  const textSize = isCompact ? "text-[11px] leading-relaxed" : "text-xs sm:text-sm leading-relaxed";

  return (
    <p className={`text-slate-500 dark:text-zinc-500 ${textSize} ${className}`}>
      Built by{" "}
      <span className="font-semibold text-slate-700 dark:text-zinc-300">{AUTHOR.name}</span>{" "}
      <span className="text-slate-600 dark:text-zinc-400">({AUTHOR.praise})</span>
      {" · "}
      <a
        href={AUTHOR.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-cyan-700 underline decoration-cyan-500/40 underline-offset-2 transition hover:text-cyan-600 hover:decoration-cyan-500 dark:text-cyan-400/90 dark:hover:text-cyan-300"
      >
        Website
      </a>
      {" · "}
      <a
        href={AUTHOR.linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-cyan-700 underline decoration-cyan-500/40 underline-offset-2 transition hover:text-cyan-600 hover:decoration-cyan-500 dark:text-cyan-400/90 dark:hover:text-cyan-300"
      >
        LinkedIn
      </a>
    </p>
  );
}
