"use client";

import { useState } from "react";

export function CopyBlock({ text, label }: { text: string; label: string }) {
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
    <div className="rounded-[16px] border border-border bg-card">
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6" dir="ltr">
        {text}
      </pre>
      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-11 items-center justify-center rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground transition-transform duration-150 ease-out hover:brightness-110 active:scale-[0.98]"
        >
          {note}
        </button>
      </div>
    </div>
  );
}
