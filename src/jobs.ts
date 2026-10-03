import type { Env, JobMessage } from "./env";
import { scrapeBonbast } from "./scrape/bonbast";
import { scrapeTetherland } from "./scrape/tetherland";
import { scrapeAllUsdtExchanges, type ExchangeQuote } from "./scrape/exchanges";
import { probeCandidates } from "./scrape/probe";
import { scrapeTgju } from "./scrape/tgju";
import { scrapeAlanchand } from "./scrape/alanchand";
import { fillMissing, type BoardQuote } from "./scrape/board";
import { configureProxy, proxyConfigured } from "./lib/proxy";
import { ingestScrapes, getAllLatest, type TetherSource } from "./db/prices";
import { saveExchangeQuotes } from "./db/exchanges";
import { checkAlerts } from "./db/alerts";
import { getSettings } from "./db/settings";
import { cast6hCharts, castDaily, castPriceList } from "./cast/messages";
import { runGroupFeeds } from "./group/feeds";
import { sendMessage } from "./telegram/api";
import { escapeHtml, formatPrice } from "./lib/format";
import { t } from "./lib/i18n";
import { displayName, quoteUnit, resolveSymbol } from "./symbols";

/** Channel list interval (ms). Scrape is every 5m; list posts every 10m. */
const LIST_CAST_EVERY_MS = 10 * 60 * 1000;

/**
 * Charts fire once per Tehran day at 00:00.
 * Cron is every 5 minutes — allow minute 0-9 so a late CF cron still hits midnight.
 */
const CHART_MIDNIGHT_GRACE_MIN = 10;

const KV_LAST_LIST = "cast:last_list_ms";
/** Tehran day key (YYYY-MM-DD) when midnight charts last ran */
const KV_LAST_CHART_DAY = "cast:last_chart_day";

function tehranParts(d = new Date()): { hour: number; minute: number; dayKey: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  // en-GB parts are separate types — build ISO-like day key
  const dayKey = `${get("year")}-${get("month")}-${get("day")}`;
  return { hour, minute, dayKey };
}

/** True in [00:00, 00:grace) Tehran. */
function isTehranMidnightWindow(hour: number, minute: number): boolean {
  return hour === 0 && minute < CHART_MIDNIGHT_GRACE_MIN;
}

async function kvGetNum(env: Env, key: string): Promise<number> {
  const v = await env.CACHE.get(key);
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function kvPut(env: Env, key: string, value: string): Promise<void> {
  // No expiry — last-cast markers should stick
  await env.CACHE.put(key, value);
}

/** Venues required before a derived USDT median is publishable. */
const USDT_QUORUM = 3;

/** Exchange rows plus the TGJU and Alanchand tether figures, cheapest mid first. */
export function listBoards(
  venues: ExchangeQuote[],
  tgjuUsdt: number | null,
  alan: { buy: number; sell: number; mid: number } | null,
): ExchangeQuote[] {
  const out = venues.slice();
  if (tgjuUsdt != null && !out.some((q) => q.exchange === "tgju")) {
    out.push({ exchange: "tgju", name: "TGJU", buy: tgjuUsdt, sell: tgjuUsdt, mid: tgjuUsdt });
  }
  if (alan && !out.some((q) => q.exchange === "alanchand")) {
    out.push({ exchange: "alanchand", name: "Alanchand", buy: alan.buy, sell: alan.sell, mid: alan.mid });
  }
  out.sort((a, b) => (a.mid ?? 0) - (b.mid ?? 0));
  return out;
}

/** Median of the exchange mids — USDT fallback when tetherland is down. */
export function medianUsdt(quotes: Array<{ mid: number | null }>): number | null {
  const mids = quotes.map((q) => q.mid).filter((m): m is number => m != null).sort((a, b) => a - b);
  if (!mids.length) return null;
  const i = mids.length >> 1;
  return mids.length % 2 ? mids[i]! : Math.round((mids[i - 1]! + mids[i]!) / 2);
}

export async function runScrape(env: Env): Promise<number> {
  configureProxy(env);
  // One flaky source must not kill the whole scrape+cast pipeline.
  const [bonbastR, tetherR, exchangesR, tgjuR, alanR] = await Promise.allSettled([
    scrapeBonbast(),
    scrapeTetherland(["USDT"]),
    scrapeAllUsdtExchanges(),
    scrapeTgju(),
    scrapeAlanchand(),
  ]);

  const bonbast = bonbastR.status === "fulfilled" ? bonbastR.value : [];
  let tether: Array<{ sourceKey: string; price: number; source?: TetherSource }> =
    tetherR.status === "fulfilled" ? tetherR.value : [];
  const exchanges =
    exchangesR.status === "fulfilled" ? exchangesR.value : { quotes: [], errors: [] };
  const tgju = tgjuR.status === "fulfilled" ? tgjuR.value : { quotes: [], usdt: null, usdtState: "missing" as const };
  const alan = alanR.status === "fulfilled" ? alanR.value : { quotes: [], usdt: null };

  if (bonbastR.status === "rejected") console.error("scrape bonbast failed", bonbastR.reason);
  if (tetherR.status === "rejected") console.error("scrape tetherland failed", tetherR.reason);
  if (exchangesR.status === "rejected") console.error("scrape exchanges failed", exchangesR.reason);
  if (tgjuR.status === "rejected") console.error("scrape tgju failed", tgjuR.reason);
  if (alanR.status === "rejected") console.error("scrape alanchand failed", alanR.reason);

  // TGJU is the published FX, gold, and coin board. Bonbast, then Alanchand, fill what it missed.
  const board: BoardQuote[] = fillMissing(
    fillMissing(
      tgju.quotes,
      bonbast.map((q) => ({ ...q, source: "bonbast" as const })),
    ),
    alan.quotes,
  );
  const fromBonbast = board.filter((q) => q.source === "bonbast").length;
  const fromAlan = board.filter((q) => q.source === "alanchand").length;
  if (fromBonbast || fromAlan) console.log("board gap-fill", { bonbast: fromBonbast, alanchand: fromAlan });

  // USDT source order: tetherland → tgju → venue median → alanchand.
  // A single board quote outranks a thin median. The median stays exchange-only.
  if (!tether.length && tgju.usdt != null) {
    tether = [{ sourceKey: "USDT", price: tgju.usdt, source: "tgju" }];
    console.log("usdt from tgju", tgju.usdt);
  }

  // Still nothing → derive from the venues, but only with a real quorum:
  // a "median" of one venue is an unverified number, not a market rate.
  if (!tether.length) {
    const med = USDT_QUORUM <= exchanges.quotes.filter((q) => q.mid != null).length
      ? medianUsdt(exchanges.quotes)
      : null;
    if (med == null) {
      console.error("usdt fallback skipped: quorum not met", exchanges.quotes.length, "venues");
    }
    if (med != null) {
      tether = [{ sourceKey: "USDT", price: med, source: "venue_median" }];
      console.log("usdt fallback: exchange median", med, "from", exchanges.quotes.length, "venues");
    }
  }

  if (!tether.length && alan.usdt != null) {
    tether = [{ sourceKey: "USDT", price: alan.usdt.mid, source: "alanchand" }];
    console.log("usdt from alanchand", alan.usdt.mid);
  }

  const listed = listBoards(exchanges.quotes, tgju.usdt, alan.usdt);

  if (!board.length && !tether.length && !listed.length) {
    throw new Error("scrape: all sources failed");
  }

  const n = await ingestScrapes(env, board, tether);
  if (listed.length) {
    await saveExchangeQuotes(env.DB, listed);
  }
  console.log(
    proxyConfigured() ? "exchanges ok (proxy on):" : "exchanges ok:",
    listed.map((q) => q.exchange).join(",") || "(none)",
  );
  if (exchanges.errors.length) {
    // Full list, not a slice — the failure matrix is the whole diagnostic.
    console.log("exchange scrape errors\n" + exchanges.errors.join("\n"));
  }

  // Fire alerts (cheap: one SELECT all alerts)
  try {
    await fireAlerts(env);
  } catch (e) {
    console.error("alerts", e);
  }

  return n + listed.length;
}

async function fireAlerts(env: Env): Promise<void> {
  const rows = await getAllLatest(env.DB);
  const prices = new Map(rows.map((row) => [row.symbol, row.price]));
  const fired = await checkAlerts(env.DB, prices);
  for (const a of fired) {
    const lang = (await getSettings(env.DB, a.chat_id)).lang;
    const dir =
      a.direction === "above"
        ? `${t(lang, "dirAbove")} ${formatPrice(a.threshold)}`
        : a.direction === "below"
          ? `${t(lang, "dirBelow")} ${formatPrice(a.threshold)}`
          : `${t(lang, "dirMove")} ≥ ${a.threshold}%`;
    const modeNote =
      a.mode === "once" ? t(lang, "alertOnceNote") : t(lang, "alertRepeatNote");
    const def = resolveSymbol(a.symbol);
    const name = escapeHtml(def ? displayName(def, lang) : a.symbol);
    const unit = escapeHtml(quoteUnit(a.symbol, lang, t(lang, "cardUnit")));
    await sendMessage(
      env,
      a.chat_id,
      `🔔 <b>${t(lang, "alertFired")} #${a.id}</b> ${name}\n${t(lang, "alertPrice")} <b>${formatPrice(a.price)}</b> ${unit} (${dir})\n<i>${modeNote}</i>`,
    ).catch((e) => console.error("alert send", e));
  }
}

/**
 * Decide + run channel casts.
 *
 * - Price list: every ~10m (KV last-cast — CF cron is often late).
 * - Charts + daily OHLC: once per Tehran day at 00:00 sharp
 *   (grace 00:00-00:09 so delayed 5m cron still fires).
 */
export async function runCasts(env: Env, force = false, atMs = Date.now()): Promise<string> {
  const now = atMs;
  const { hour, minute, dayKey } = tehranParts(new Date(now));
  let extra = "";

  const lastList = await kvGetNum(env, KV_LAST_LIST);
  const dueList = force || now - lastList >= LIST_CAST_EVERY_MS;
  if (dueList) {
    try {
      await castPriceList(env);
      await kvPut(env, KV_LAST_LIST, String(now));
      extra += " +list";
      console.log("cast list ok", {
        chat: env.TELEGRAM_CHANNEL_ID,
        tehran: `${hour}:${String(minute).padStart(2, "0")}`,
      });
    } catch (e) {
      console.error("cast list failed", e);
      throw e;
    }
  }

  // Charts only at Tehran midnight (not every 6h)
  const lastChartDay = (await env.CACHE.get(KV_LAST_CHART_DAY)) ?? "";
  const dueCharts =
    force || (lastChartDay !== dayKey && isTehranMidnightWindow(hour, minute));
  if (dueCharts) {
    try {
      await cast6hCharts(env);
      extra += " +charts";
      console.log("cast charts ok", { dayKey, hour, minute });
    } catch (e) {
      console.error("cast charts failed", e);
      throw e;
    }
    try {
      await castDaily(env);
      extra += " +daily";
      console.log("cast daily ok", { dayKey });
    } catch (e) {
      console.error("cast daily failed", e);
      throw e;
    }
    // Mark day only after both succeed so retries re-run on failure
    await kvPut(env, KV_LAST_CHART_DAY, dayKey);
  }

  try {
    const groups = await runGroupFeeds(env, now);
    if (groups) extra += ` +groups:${groups}`;
  } catch (e) {
    console.error("group feeds failed", e);
  }

  return extra || " (no cast due)";
}

export async function runScrapeAndCast(env: Env, force = false, atMs = Date.now()): Promise<string> {
  const n = await runScrape(env);
  // Cast errors must not prevent scrape from counting as success on retry,
  // but we still throw so the queue retries the cast half.
  const extra = await runCasts(env, force, atMs);
  return `scraped ${n}${extra}`;
}

export async function handleJob(env: Env, job: JobMessage): Promise<string> {
  const at = job.at && Number.isFinite(job.at) ? job.at : Date.now();
  switch (job.type) {
    case "scrape_and_cast":
      return runScrapeAndCast(env, job.force, at);
    case "cast_15m":
      await castPriceList(env);
      await kvPut(env, KV_LAST_LIST, String(Date.now()));
      return "cast_15m";
    case "cast_6h": {
      const { dayKey } = tehranParts();
      await cast6hCharts(env);
      // Manual force does not flip midnight day marker unless daily also ran
      return `cast_6h (${dayKey})`;
    }
    case "probe": {
      const rows = await probeCandidates();
      console.log("probe:\n" + rows.join("\n"));
      return `probed ${rows.length}`;
    }
    case "cast_daily": {
      const { dayKey } = tehranParts();
      await castDaily(env);
      await kvPut(env, KV_LAST_CHART_DAY, dayKey);
      return "cast_daily";
    }
    default:
      return `unknown ${(job as JobMessage).type}`;
  }
}
