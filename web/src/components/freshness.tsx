"use client";
import { useEffect, useState } from "react";
import { freshness } from "@/lib/freshness";
export function Freshness({ updatedAt, failed = false }: { updatedAt?: number | null; failed?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  if (!now || (updatedAt === undefined && !failed)) return null;
  const state = freshness(updatedAt, now);
  return <span role="status" className={`block my-1 text-xs ${failed || state.stale ? "text-destructive" : "text-muted-foreground"}`}>{failed ? "اتصال قطع شد؛ " : ""}{state.text}</span>;
}
