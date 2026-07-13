import type { Env, JobMessage } from "./env";
import { scrapeBonbast } from "./scrape/bonbast";
import { scrapeTetherland } from "./scrape/tetherland";
import { scrapeAllUsdtExchanges } from "./scrape/exchanges";
import { ingestScrapes, getLatest } from "./db/prices";
import { saveExchangeQuotes } from "./db/exchanges";
import { checkAlerts } from "./db/alerts";
import { cast6hCharts, castDaily, castPriceList } from "./cast/messages";
import { sendMessage } from "./telegram/api";

function tehranParts(d = new Date()): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
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

export async function runScrapeAndCast(env: Env, force = false): Promise<string> {
  const n = await runScrape(env);

  const { hour, minute } = tehranParts();
  const castList = force || minute % 15 === 0;
  const onHour = minute < 5;

  let extra = "";
  if (castList) {
    await castPriceList(env);
    extra += " +list";
  }
  if (force || (onHour && hour % 6 === 0)) {
    await cast6hCharts(env);
    extra += " +6h";
  }
  if (force || (onHour && hour === 9)) {
    await castDaily(env);
    extra += " +daily";
  }

  return `scraped ${n}${extra}`;
}

export async function handleJob(env: Env, job: JobMessage): Promise<string> {
  switch (job.type) {
    case "scrape_and_cast":
      return runScrapeAndCast(env, job.force);
    case "cast_15m":
      await castPriceList(env);
      return "cast_15m";
    case "cast_6h":
      await cast6hCharts(env);
      return "cast_6h";
    case "cast_daily":
      await castDaily(env);
      return "cast_daily";
    default:
      return `unknown ${(job as JobMessage).type}`;
  }
}
