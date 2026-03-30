"use client";

type Props = {
  url: string;
  title?: string;
  className?: string;
};

/** Embedded PDF preview from a blob: URL (e.g. from uploaded file). */
export function ResumePdfFrame({ url, title = "Resume PDF preview", className = "" }: Props) {
  return (
    <iframe
      title={title}
      src={`${url}#toolbar=0&navpanes=0`}
      className={`w-full rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-zinc-900 ${className}`}
    />
  );
}
