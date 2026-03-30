"use client";

import emailjs from "@emailjs/browser";
import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { EMAILJS_CONFIG } from "@/lib/emailjsConfig";
import { AUTHOR, PROJECT_NAME } from "@/lib/projectMeta";

function buildRateFeedbackEmailBody(opts: {
  rating: number;
  name: string;
  email: string;
  feedback: string;
}): string {
  const nameLine = opts.name.trim() || "Anonymous";
  const emailLine = opts.email.trim() || "(not provided)";
  return [
    `Project: ${PROJECT_NAME}`,
    `Built by: ${AUTHOR.name} (${AUTHOR.praise})`,
    `Site: ${AUTHOR.websiteUrl}`,
    `LinkedIn: ${AUTHOR.linkedinUrl}`,
    `Rating: ${opts.rating} / 5`,
    `Name: ${nameLine}`,
    `Email: ${emailLine}`,
    "",
    "Feedback:",
    opts.feedback.trim(),
  ].join("\n");
}

export function RateProjectFeedback() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rate-project-glow relative rounded-lg border border-cyan-400/50 bg-gradient-to-br from-cyan-50 to-sky-50 px-3 py-1.5 text-xs font-semibold text-cyan-900 shadow-sm transition hover:border-cyan-400/70 hover:from-cyan-100/90 hover:to-sky-100/80 dark:border-cyan-400/35 dark:from-cyan-500/15 dark:to-sky-600/10 dark:text-cyan-100 dark:hover:border-cyan-300/50 dark:hover:from-cyan-500/20 dark:hover:to-sky-600/15"
      >
        Rate my project
      </button>

      <AnimatePresence mode="wait">
        {open ? <RateProjectModal key="rate-modal" titleId={titleId} onClose={() => setOpen(false)} /> : null}
      </AnimatePresence>
    </>
  );
}

function RateProjectModal({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  const [rating, setRating] = useState<number>(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    setRating(0);
    setName("");
    setEmail("");
    setMessage("");
    setStatus("idle");
    setErrorMsg(null);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg("Please choose a rating from 1 to 5 stars.");
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length < 4) {
      setErrorMsg("Please write a few words of feedback.");
      return;
    }

    setErrorMsg(null);
    setStatus("sending");

    const fromName = name.trim() || "Anonymous";
    const fromEmail = email.trim();
    const fullBody = buildRateFeedbackEmailBody({
      rating,
      name,
      email,
      feedback: trimmed,
    });
    const subject = `[${PROJECT_NAME}] Feedback — ${rating}/5 stars`;

    const templateParams: Record<string, string> = {
      subject,
      from_name: fromName,
      from_email: fromEmail || "(not provided)",
      message: fullBody,
      text: fullBody,
      email_body: fullBody,
      body: fullBody,
      content: fullBody,
      rating: String(rating),
      stars_label: `${rating} / 5`,
      project: PROJECT_NAME,
      feedback: trimmed,
      user_message: fullBody,
    };
    if (fromEmail) {
      templateParams.reply_to = fromEmail;
    }

    try {
      await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams, EMAILJS_CONFIG.publicKey);
      setStatus("success");
      window.setTimeout(() => {
        reset();
        onClose();
      }, 1800);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Could not send feedback. Try again later.");
    }
  };

  return (
    <motion.div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        aria-label="Close feedback dialog"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] dark:bg-black/70"
        onClick={() => {
          reset();
          onClose();
        }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[101] w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#12141f]"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
              Rate this project
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Your feedback on <span className="font-medium text-slate-800 dark:text-zinc-200">{PROJECT_NAME}</span> is
              sent by email. Thank you for taking a moment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-800 dark:text-zinc-200">Rating</p>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`rounded-lg p-1.5 transition ${
                    rating >= n
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-slate-300 dark:text-zinc-600"
                  } hover:text-amber-400`}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  aria-pressed={rating === n ? true : rating > n ? true : false}
                >
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="rate-name" className="mb-1 block text-sm font-medium text-slate-800 dark:text-zinc-200">
              Name <span className="font-normal text-slate-500 dark:text-zinc-500">(optional)</span>
            </label>
            <input
              id="rate-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-[#0f1220] dark:text-zinc-100 dark:focus:border-cyan-400"
            />
          </div>

          <div>
            <label htmlFor="rate-email" className="mb-1 block text-sm font-medium text-slate-800 dark:text-zinc-200">
              Email <span className="font-normal text-slate-500 dark:text-zinc-500">(optional)</span>
            </label>
            <input
              id="rate-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-[#0f1220] dark:text-zinc-100 dark:focus:border-cyan-400"
            />
          </div>

          <div>
            <label htmlFor="rate-msg" className="mb-1 block text-sm font-medium text-slate-800 dark:text-zinc-200">
              Feedback
            </label>
            <textarea
              id="rate-msg"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What worked well? What could be better?"
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-[#0f1220] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-cyan-400"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
              {errorMsg}
            </p>
          )}

          {status === "success" && (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Thanks — your feedback was sent.</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === "sending" || status === "success"}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-600/25 transition hover:bg-cyan-500 disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950 dark:shadow-none dark:hover:bg-cyan-300"
            >
              {status === "sending" ? "Sending…" : status === "success" ? "Sent!" : "Send feedback"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
