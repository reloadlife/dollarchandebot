/** Daily totals for starts, alerts, new group feeds, and plugin downloads. */

export const USAGE_KINDS = [
  "start",
  "alert",
  "feed",
  "dl_woocommerce",
  "dl_wordpress",
  "dl_whmcs",
] as const;

export type UsageKind = (typeof USAGE_KINDS)[number];

export type UsageBag = Partial<Record<UsageKind, number>>;

export type UsageReport = {
  day: string;
  today: UsageBag;
  total: UsageBag;
};

const KIND_SET = new Set<string>(USAGE_KINDS);

export function usageDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isUsageKind(kind: string): kind is UsageKind {
  return KIND_SET.has(kind);
}

export async function bumpUsage(db: D1Database, kind: UsageKind, now = new Date()): Promise<void> {
  const day = usageDay(now);
  await db
    .prepare(
      `INSERT INTO usage_daily (day, kind, n) VALUES (?, ?, 1)
       ON CONFLICT(day, kind) DO UPDATE SET n = n + 1`,
    )
    .bind(day, kind)
    .run();
}

function bag(rows: Array<{ kind: string; n: number }> | undefined): UsageBag {
  const out: UsageBag = {};
  for (const row of rows ?? []) {
    if (!isUsageKind(row.kind)) continue;
    out[row.kind] = Number(row.n) || 0;
  }
  return out;
}

export async function usageReport(db: D1Database, now = new Date()): Promise<UsageReport> {
  const day = usageDay(now);
  const today = await db
    .prepare(`SELECT kind, n FROM usage_daily WHERE day = ?`)
    .bind(day)
    .all<{ kind: string; n: number }>();
  const total = await db
    .prepare(`SELECT kind, SUM(n) AS n FROM usage_daily GROUP BY kind`)
    .all<{ kind: string; n: number }>();
  return { day, today: bag(today.results), total: bag(total.results) };
}

function downloads(bag: UsageBag): number {
  return (bag.dl_woocommerce ?? 0) + (bag.dl_wordpress ?? 0) + (bag.dl_whmcs ?? 0);
}

/** Operator text. Counts only, no chat ids. */
export function formatUsage(lang: "fa" | "en", report: UsageReport): string {
  const fa = lang === "fa";
  const label = {
    start: fa ? "شروع ربات" : "Bot starts",
    alert: fa ? "هشدار" : "Alerts",
    feed: fa ? "گروه" : "Group feeds",
    download: fa ? "دانلود افزونه" : "Plugin downloads",
    today: fa ? "امروز" : "Today",
    total: fa ? "جمع" : "Total",
  };
  const block = (title: string, row: UsageBag) =>
    [
      `<b>${title}</b>`,
      `${label.start} · ${row.start ?? 0}`,
      `${label.alert} · ${row.alert ?? 0}`,
      `${label.feed} · ${row.feed ?? 0}`,
      `${label.download} · ${downloads(row)}`,
    ].join("\n");
  return `${block(label.today, report.today)}\n\n${block(label.total, report.total)}`;
}
