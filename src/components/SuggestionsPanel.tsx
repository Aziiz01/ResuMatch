"use client";

import { motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { Spinner } from "./ui/Spinner";

type Props = {
  resumeText: string;
  suggestion: string;
  onChangeSuggestion: (text: string) => void;
  onGenerate: () => void;
  onImproveSelection: (selectedText: string, instruction: string) => Promise<string>;
  onDownload: () => void;
  loading: boolean;
  error: string | null;
};

type SelectionRange = { start: number; end: number };

/**
 * Editable AI suggestion for the whole resume. Users can edit before download.
 * Generation calls /api/generate (Hugging Face) via the parent orchestrator.
 */
export function SuggestionsPanel({
  resumeText,
  suggestion,
  onChangeSuggestion,
  onGenerate,
  onImproveSelection,
  onDownload,
  loading,
  error,
}: Props) {
  const hasResume = resumeText.trim().length > 0;
  const [selectionText, setSelectionText] = useState("");
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showImproveInput, setShowImproveInput] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [revertSnapshot, setRevertSnapshot] = useState<string | null>(null);
  const interactiveRef = useRef<HTMLDivElement>(null);

  const clearSelectionUi = useCallback(() => {
    setSelectionText("");
    setSelectionRange(null);
    setMenuPos(null);
    setShowImproveInput(false);
    setInstruction("");
  }, []);

  const applyReplacement = useCallback(
    (replacement: string): boolean => {
      if (!replacement.trim()) return false;
      const source = suggestion;
      if (!source.trim()) return false;

      if (selectionRange && selectionRange.start >= 0 && selectionRange.end <= source.length) {
        const next = source.slice(0, selectionRange.start) + replacement + source.slice(selectionRange.end);
        if (next === source) return false;
        onChangeSuggestion(next);
        return true;
      }

      const idx = source.indexOf(selectionText);
      if (idx >= 0) {
        const next = source.slice(0, idx) + replacement + source.slice(idx + selectionText.length);
        if (next === source) return false;
        onChangeSuggestion(next);
        return true;
      }
      return false;
    },
    [onChangeSuggestion, selectionRange, selectionText, suggestion],
  );

  const onInteractiveMouseUp = useCallback(() => {
    const container = interactiveRef.current;
    const sel = window.getSelection();
    if (!container || !sel || sel.rangeCount === 0) {
      clearSelectionUi();
      return;
    }
    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text) {
      clearSelectionUi();
      return;
    }
    if (!container.contains(range.commonAncestorContainer)) {
      clearSelectionUi();
      return;
    }

    const startProbe = range.cloneRange();
    startProbe.selectNodeContents(container);
    startProbe.setEnd(range.startContainer, range.startOffset);
    const start = startProbe.toString().length;

    const endProbe = range.cloneRange();
    endProbe.selectNodeContents(container);
    endProbe.setEnd(range.endContainer, range.endOffset);
    const end = endProbe.toString().length;

    if (end <= start) {
      clearSelectionUi();
      return;
    }

    const selectionRect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setSelectionText(text);
    setSelectionRange({ start, end });
    setMenuPos({
      x: Math.max(8, selectionRect.left - containerRect.left),
      y: Math.max(8, selectionRect.bottom - containerRect.top + 10),
    });
    setShowImproveInput(false);
    setImproveError(null);
  }, [clearSelectionUi]);

  const runImprove = useCallback(async () => {
    if (!selectionText.trim()) return;
    setImproveError(null);
    setImproving(true);
    try {
      const improved = await onImproveSelection(selectionText, instruction);
      if (!improved.trim()) {
        setImproveError("No improved text was returned for this selection.");
        return;
      }
      const before = suggestion;
      const changed = applyReplacement(improved.trim());
      if (changed) {
        setRevertSnapshot(before);
      }
      clearSelectionUi();
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      setImproveError(e instanceof Error ? e.message : "Could not improve that selection.");
    } finally {
      setImproving(false);
    }
  }, [applyReplacement, clearSelectionUi, instruction, onImproveSelection, selectionText, suggestion]);

  return (
    <motion.section
      layout
      className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-md shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Resume suggestions</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-500">
            Get one consolidated recommendation block for your whole CV in{" "}
            <span className="font-medium text-slate-800 dark:text-zinc-300">action + result + metric</span> form. Edit
            the full suggestion, then download.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || !hasResume}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500/90 dark:text-violet-950 dark:hover:bg-violet-400"
          >
            {loading ? "Generating…" : "Generate suggestions"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={!suggestion.trim()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-white/25 dark:hover:bg-zinc-800"
          >
            Download .txt
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {error}
        </div>
      )}
      {improveError && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {improveError}
        </div>
      )}
      {revertSnapshot && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
          <span>Applied improvement to selected text.</span>
          <button
            type="button"
            onClick={() => {
              onChangeSuggestion(revertSnapshot);
              setRevertSnapshot(null);
              setImproveError(null);
            }}
            className="rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-400/40 dark:bg-zinc-900 dark:text-sky-200 dark:hover:bg-zinc-800"
          >
            Revert changes
          </button>
        </div>
      )}

      {!hasResume ? (
        <p className="text-sm text-slate-600 dark:text-zinc-500">Add resume text to generate a full CV-level suggestion.</p>
      ) : (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-zinc-950/50"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300/90">
            Unified CV suggestion
          </p>
          <div className="relative">
            <p className="mb-2 text-xs text-slate-600 dark:text-zinc-500">
              Highlight any sentence or phrase, then click <span className="font-medium">Improve</span>.
            </p>
            <div
              ref={interactiveRef}
              onMouseUp={onInteractiveMouseUp}
              onKeyUp={onInteractiveMouseUp}
              className="min-h-[220px] select-text rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-900 dark:border-violet-500/20 dark:bg-zinc-950/80 dark:text-zinc-100"
            >
              {suggestion || "Click “Generate suggestions” to get one complete recommendation for the whole CV…"}
            </div>

            {menuPos && selectionText && !showImproveInput && (
              <div
                className="absolute z-20"
                style={{ left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowImproveInput(true);
                    setInstruction("");
                  }}
                  className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-800/20 hover:bg-violet-500"
                >
                  Improve
                </button>
              </div>
            )}

            {menuPos && selectionText && showImproveInput && (
              <div
                className="absolute z-20 w-[min(360px,92%)] rounded-xl border border-violet-200 bg-white p-3 shadow-lg dark:border-violet-500/30 dark:bg-zinc-900"
                style={{ left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
              >
                <p className="mb-2 text-xs font-medium text-slate-700 dark:text-zinc-300">
                  Tell what to change in this part
                </p>
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. Make this quantified and more concise"
                  className="mb-2 w-full rounded-md border border-violet-200 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/30 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImproveInput(false)}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={runImprove}
                    disabled={improving}
                    className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
                  >
                    {improving ? (
                      <>
                        <Spinner className="h-3.5 w-3.5 text-white" label="Improving" />
                        Improving…
                      </>
                    ) : (
                      "Apply improve"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
