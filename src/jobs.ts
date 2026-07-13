import type { Env, JobMessage } from "./env";
import { scrapeBonbast } from "./scrape/bonbast";
import { scrapeTetherland } from "./scrape/tetherland";
import { ingestScrapes } from "./db/prices";
import { cast6hCharts, castDaily, castPriceList } from "./cast/messages";

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
  const [bonbast, tether] = await Promise.all([
    scrapeBonbast(),
    scrapeTetherland(["USDT"]),
  ]);
  return ingestScrapes(env, bonbast, tether);
}

/**
 * Main pipeline: scrape first, then cast.
 * 15m list always; 6h charts at 00/06/12/18 Tehran; daily at 09:00 Tehran.
 */
export async function runScrapeAndCast(env: Env, force = false): Promise<string> {
  const n = await runScrape(env);
  await castPriceList(env);

  const { hour, minute } = tehranParts();
  // only on the :00 slot of 15m cadence for heavier casts
  const onHour = minute < 15;

  let extra = "";
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
