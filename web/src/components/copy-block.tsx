"use client";

import { useState } from "react";

export function CopyBlock({ text, label, caption }: { text: string; label: string; caption?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1600);
  }

  const note = state === "done" ? "کپی شد" : state === "failed" ? "کپی نشد. متن را انتخاب کن." : label;

  return (
    <div className="overflow-hidden rounded-[16px] border border-border">
      <div className="flex h-[60px] items-center justify-between gap-3 bg-[oklch(0.1_0.025_48)] px-4">
        <p className="min-w-0 truncate font-mono text-xs text-[oklch(0.84_0.05_85)]" dir="ltr">
          {caption ?? "request"}
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-[16px] bg-brand px-3 text-sm font-semibold text-brand-foreground transition-transform duration-150 ease-out hover:brightness-110 active:scale-[0.98]"
        >
          <span key={state} className="copy-swap">
            {note}
          </span>
        </button>
      </div>
      <pre className="totem-well overflow-x-auto whitespace-pre-wrap break-all rounded-none px-4 py-4 font-mono text-[13px] leading-7" dir="ltr">
        {text}
      </pre>
    </div>
  );
}
