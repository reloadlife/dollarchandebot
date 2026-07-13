import type { Env, JobMessage } from "./env";
import { scrapeBonbast } from "./scrape/bonbast";
import { scrapeTetherland } from "./scrape/tetherland";
import { scrapeAllUsdtExchanges } from "./scrape/exchanges";
import { ingestScrapes, getLatest } from "./db/prices";
import { saveExchangeQuotes } from "./db/exchanges";
import { checkAlerts } from "./db/alerts";
import { cast6hCharts, castDaily, castPriceList } from "./cast/messages";
import { sendMessage } from "./telegram/api";

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

export async function runScrape(env: Env): Promise<number> {
  const [bonbast, tether, exchanges] = await Promise.all([
    scrapeBonbast(),
    scrapeTetherland(["USDT"]),
    scrapeAllUsdtExchanges(),
  ]);

  const n = await ingestScrapes(env, bonbast, tether);
  if (exchanges.quotes.length) {
    await saveExchangeQuotes(env.DB, exchanges.quotes);
  }
  if (exchanges.errors.length) {
    console.log("exchange scrape errors", exchanges.errors.slice(0, 5));
  }

  // Fire alerts (cheap: one SELECT all alerts)
  try {
    await fireAlerts(env);
  } catch (e) {
    console.error("alerts", e);
  }

  return n + exchanges.quotes.length;
}

async function fireAlerts(env: Env): Promise<void> {
  const want = ["USD", "USDT", "EUR", "GOLD18", "EMAMI"];
  const prices = new Map<string, number>();
  for (const id of want) {
    const row = await getLatest(env.DB, id);
    if (row) prices.set(id, row.price);
  }
  // also any alert symbols
  const fired = await checkAlerts(env.DB, prices);
  for (const a of fired) {
    const dir =
      a.direction === "above"
        ? `≥ ${a.threshold}`
        : a.direction === "below"
          ? `≤ ${a.threshold}`
          : `moved ≥ ${a.threshold}%`;
    await sendMessage(
      env,
      a.chat_id,
      `🔔 <b>Alert #${a.id}</b> <code>${a.symbol}</code>\nPrice <b>${a.price.toLocaleString("en-US")}</b> IRT (${dir})`,
    ).catch((e) => console.error("alert send", e));
  }
}

/**
 * Decide + run channel casts.
 *
 * - Price list: every ~10m (KV last-cast — CF cron is often late).
 * - Charts + daily OHLC: once per Tehran day at 00:00 sharp
 *   (grace 00:00–00:09 so delayed */5 cron still fires).
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
