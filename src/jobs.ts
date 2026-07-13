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
/** 6h chart dump interval. */
const CHARTS_CAST_EVERY_MS = 6 * 60 * 60 * 1000;

const KV_LAST_LIST = "cast:last_list_ms";
const KV_LAST_6H = "cast:last_6h_ms";
const KV_LAST_DAILY_DAY = "cast:last_daily_day"; // Tehran YYYY-MM-DD

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
  // en-GB: day/month/year
  const dayKey = `${get("year")}-${get("month")}-${get("day")}`;
  return { hour, minute, dayKey };
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
 * Why not `minute % 15 === 0`?
 * Cloudflare cron can fire 1–3 minutes late. A 5-minute cron scheduled at :00
 * that actually runs at :01 would skip every list cast forever while scrape
 * still looks healthy. We use last-cast timestamps in KV instead.
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
      console.log("cast list ok", { chat: env.TELEGRAM_CHANNEL_ID, tehran: `${hour}:${String(minute).padStart(2, "0")}` });
    } catch (e) {
      console.error("cast list failed", e);
      throw e;
    }
  }

  const last6h = await kvGetNum(env, KV_LAST_6H);
  const due6h = force || now - last6h >= CHARTS_CAST_EVERY_MS;
  // Prefer near top-of-window (first ~10m of each 6h block) unless forced / very overdue
  const near6hSlot = hour % 6 === 0 && minute < 15;
  const overdue6h = now - last6h >= CHARTS_CAST_EVERY_MS + 30 * 60 * 1000;
  if (force || (due6h && (near6hSlot || overdue6h))) {
    try {
      await cast6hCharts(env);
      await kvPut(env, KV_LAST_6H, String(now));
      extra += " +6h";
      console.log("cast 6h ok");
    } catch (e) {
      console.error("cast 6h failed", e);
      throw e;
    }
  }

  const lastDailyDay = (await env.CACHE.get(KV_LAST_DAILY_DAY)) ?? "";
  // Daily ~09:00 Tehran; window 09:00–09:20 so a delayed cron still hits
  const dueDaily =
    force || (lastDailyDay !== dayKey && hour === 9 && minute < 20);
  if (dueDaily) {
    try {
      await castDaily(env);
      await kvPut(env, KV_LAST_DAILY_DAY, dayKey);
      extra += " +daily";
      console.log("cast daily ok", { dayKey });
    } catch (e) {
      console.error("cast daily failed", e);
      throw e;
    }
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
    case "cast_6h":
      await cast6hCharts(env);
      await kvPut(env, KV_LAST_6H, String(Date.now()));
      return "cast_6h";
    case "cast_daily": {
      const { dayKey } = tehranParts();
      await castDaily(env);
      await kvPut(env, KV_LAST_DAILY_DAY, dayKey);
      return "cast_daily";
    }
    default:
      return `unknown ${(job as JobMessage).type}`;
  }
}
