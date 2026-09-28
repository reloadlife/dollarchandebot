/** Stateless-looking alert wizard. The in-progress choice lives in KV for 10 minutes. */

export type WizardDirection = "above" | "below" | "move_pct";

export type PendingAlert = {
  symbol: string;
  direction: WizardDirection;
  threshold?: number;
};

export function pendingAlertKey(chatId: string | number): string {
  return `alert:wiz:${chatId}`;
}

export function parseAlertAmount(raw: string): number | null {
  let s = raw.trim();
  s = s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  s = s.replace(/[,_\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function encodePending(p: PendingAlert): string {
  return JSON.stringify(p);
}

export function decodePending(raw: string | null): PendingAlert | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PendingAlert;
    if (!v || typeof v.symbol !== "string") return null;
    if (v.direction !== "above" && v.direction !== "below" && v.direction !== "move_pct") {
      return null;
    }
    if (v.threshold != null && (!Number.isFinite(v.threshold) || v.threshold <= 0)) return null;
    return v;
  } catch {
    return null;
  }
}
