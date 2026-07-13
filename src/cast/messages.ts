import type { Env } from "../env";
import { getAllLatest, getLatest, getOhlcDays, getTicks24h, type LatestRow } from "../db/prices";
import { listExchanges, type ExchangeRow } from "../db/exchanges";
// getOhlcDays used for 7d charts
import { resolveSymbol, type SymbolDef } from "../symbols";
import {
  escapeHtml,
  formatDelta,
  formatDeltaQuiet,
  formatJalaliTehran,
  formatPrice,
  formatTimeTehran,
} from "../lib/format";
import { calcCoinBubble, COIN_SPECS } from "../lib/coin-bubble";
import { renderLineChartPng } from "../lib/chart";
import { sendMessage, sendPhoto } from "../telegram/api";

function unit(env: Env): string {
  return env.PRICE_UNIT || "Toman";
}

/** Channel FX board — Farsi names (USDT lives in its own section). */
const FX_TICKER: Array<{ id: string; label: string }> = [
  { id: "USD", label: "دلار" },
  { id: "EUR", label: "یورو" },
  { id: "GBP", label: "پوند" },
  { id: "CHF", label: "فرانک" },
  { id: "CAD", label: "دلار کانادا" },
  { id: "TRY", label: "لیر" },
  { id: "KWD", label: "دینار کویت" },
  { id: "BHD", label: "دینار بحرین" },
];

const GOLD_IDS = ["MITHQAL", "GOLD18"] as const;
const GOLD_LABEL: Record<string, string> = {
  MITHQAL: "مثقال",
  GOLD18: "گرم ۱۸",
};
const COIN_IDS = ["EMAMI", "AZADI", "HALF", "QUARTER", "GERAMI"] as const;
const COIN_LABEL: Record<string, string> = {
  EMAMI: "امامی",
  AZADI: "آزادی",
  HALF: "نیم",
  QUARTER: "ربع",
  GERAMI: "گرمی",
};

/** USDT in Toman should sit roughly here; drop broken scrapes (e.g. 10× rial). */
function saneUsdtToman(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n >= 50_000 && n <= 500_000;
}

function marketMood(map: Map<string, LatestRow>): { emoji: string; label: string; sub: string } {
  const goldMoves: Array<"up" | "down"> = [];
  for (const id of GOLD_IDS) {
    const r = map.get(id);
    if (!r || r.prev_price == null || r.prev_price === 0 || r.price === r.prev_price) continue;
    goldMoves.push(r.price > r.prev_price ? "up" : "down");
  }
  const ups = goldMoves.filter((m) => m === "up").length;
  const downs = goldMoves.filter((m) => m === "down").length;

  if (ups && !downs) {
    return { emoji: "🟢", label: "کمی مثبت", sub: "طلا کمی سبز · بقیه آرام" };
  }
  if (downs && !ups) {
    return { emoji: "🟡", label: "آرام", sub: "بیشتر نمادها بدون تغییر · طلا کمی قرمز" };
  }
  if (ups && downs) {
    return { emoji: "🟡", label: "آرام", sub: "بازار متعادل" };
  }
  return { emoji: "🟡", label: "آرام", sub: "بیشتر نمادها بدون تغییر" };
}

/** Farsi name + bold price + optional tick Δ (same style as طلا). */
function faPriceLine(
  name: string,
  price: number | undefined,
  prev?: number | null,
): string {
  if (price == null) return `${escapeHtml(name)}  —`;
  const d = formatDeltaQuiet(price, prev);
  return `${escapeHtml(name)}  <b>${formatPrice(price)}</b>${d ? `  ${escapeHtml(d)}` : ""}`;
}

/** Signed spread / bubble, e.g. +850 or −50 */
function formatSignedSpread(n: number): string {
  const abs = formatPrice(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return "0";
}

/** Compact bubble tag: حباب +12.3M (+7.5%) */
function formatBubbleTag(bubble: number, pct: number): string {
  const sign = bubble > 0 ? "+" : bubble < 0 ? "−" : "";
  const abs = Math.abs(bubble);
  // shorten millions for channel scan
  let amount: string;
  if (abs >= 1_000_000) {
    amount = `${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    amount = `${formatPrice(abs / 1_000)}k`;
  } else {
    amount = formatPrice(abs);
  }
  const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return `حباب ${sign}${amount} (${pctStr})`;
}

function coinSectionLines(map: Map<string, LatestRow>): string[] {
  const gold18 = map.get("GOLD18")?.price;
  const lines: string[] = ["🪙 <b>سکه</b>"];
  if (gold18 == null) {
    lines.push("  <i>گرم ۱۸ در دسترس نیست — حباب محاسبه نشد</i>");
  }

  for (const id of COIN_IDS) {
    const row = map.get(id);
    const lab = COIN_LABEL[id] ?? id;
    if (!row) {
      lines.push(`  ${escapeHtml(lab)}  —`);
      continue;
    }
    const d = formatDeltaQuiet(row.price, row.prev_price);
    let line = `  ${escapeHtml(lab)}  <b>${formatPrice(row.price)}</b>`;
    if (d) line += `  ${escapeHtml(d)}`;

    const spec = COIN_SPECS[id];
    if (spec && gold18 != null && gold18 > 0) {
      const b = calcCoinBubble(row.price, gold18, spec);
      line += `  · <i>${escapeHtml(formatBubbleTag(b.bubble, b.bubblePct))}</i>`;
    }
    lines.push(line);
  }
  return lines;
}

type ExMid = ExchangeRow & { midN: number; buyN: number | null; sellN: number | null };

function normalizeExchanges(exchanges: ExchangeRow[]): ExMid[] {
  return exchanges
    .map((e) => {
      const buyN = saneUsdtToman(e.buy) ? e.buy! : null;
      const sellN = saneUsdtToman(e.sell) ? e.sell! : null;
      let midN: number | null = saneUsdtToman(e.mid) ? e.mid! : null;
      if (midN == null && buyN != null && sellN != null) midN = Math.round((buyN + sellN) / 2);
      if (midN == null) midN = buyN ?? sellN;
      return { ...e, midN, buyN, sellN };
    })
    .filter((e): e is ExMid => saneUsdtToman(e.midN));
}

/**
 * Dedicated تتر block: mid price, vs دلار, high/low exchange, arb path.
 */
function usdtSection(
  usdtMid: number | undefined,
  usdMid: number | undefined,
  exchanges: ExchangeRow[],
): string[] {
  const lines: string[] = ["💰 <b>تتر</b>"];

  if (usdtMid != null) {
    lines.push(`  قیمت  <b>${formatPrice(usdtMid)}</b>`);
  } else {
    lines.push("  قیمت  —");
  }

  if (usdtMid != null && usdMid != null) {
    const diff = usdtMid - usdMid;
    const hint =
      diff > 0 ? "تتر گران‌تر از دلار" : diff < 0 ? "تتر ارزان‌تر از دلار" : "هم‌قیمت با دلار";
    lines.push(`  اختلاف با دلار  <b>${formatSignedSpread(diff)}</b>  <i>(${hint})</i>`);
  }

  const withMid = normalizeExchanges(exchanges);
  if (withMid.length) {
    const hi = withMid.reduce((a, b) => (b.midN > a.midN ? b : a));
    const lo = withMid.reduce((a, b) => (b.midN < a.midN ? b : a));
    lines.push(
      `  ⬆ بالاترین  <b>${escapeHtml(hi.name)}</b> · ${formatPrice(hi.midN)}`,
      `  ⬇ پایین‌ترین  <b>${escapeHtml(lo.name)}</b> · ${formatPrice(lo.midN)}`,
    );

    const buyers = withMid.filter((e) => e.buyN != null);
    const sellers = withMid.filter((e) => e.sellN != null);
    const cheapBuy = buyers.length
      ? buyers.reduce((a, b) => (b.buyN! < a.buyN! ? b : a))
      : null;
    const bestSell = sellers.length
      ? sellers.reduce((a, b) => (b.sellN! > a.sellN! ? b : a))
      : null;

    if (cheapBuy?.buyN != null && bestSell?.sellN != null) {
      const spread = bestSell.sellN - cheapBuy.buyN;
      lines.push(
        `  آربیتراژ  خرید <b>${escapeHtml(cheapBuy.name)}</b> → فروش <b>${escapeHtml(bestSell.name)}</b> · <b>${formatSignedSpread(spread)}</b>`,
      );
    }
  }

  return lines;
}

/**
 * Channel list · hybrid v2 (FA)
 * Jalali + FX (fa) + طلا/سکه + تتر block + mood + footer
 */
export async function buildPriceListHtml(env: Env): Promise<string> {
  const [rows, exchanges] = await Promise.all([
    getAllLatest(env.DB),
    listExchanges(env.DB).catch(() => [] as ExchangeRow[]),
  ]);
  const map = new Map(rows.map((r) => [r.symbol, r]));
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const ts = newest || Math.floor(Date.now() / 1000);
  const mood = marketMood(map);

  const fxLines = FX_TICKER.map(({ id, label }) => {
    const row = map.get(id);
    return faPriceLine(label, row?.price, row?.prev_price);
  });

  const goldLines = GOLD_IDS.map((id) => {
    const row = map.get(id);
    const lab = GOLD_LABEL[id] ?? id;
    if (!row) return `  ${escapeHtml(lab)}  —`;
    const d = formatDeltaQuiet(row.price, row.prev_price);
    return `  ${escapeHtml(lab)}  <b>${formatPrice(row.price)}</b>${d ? `  ${escapeHtml(d)}` : ""}`;
  });

  const usd = map.get("USD")?.price;
  const usdt = map.get("USDT")?.price;

  const out: string[] = [
    `⏰ ${escapeHtml(formatJalaliTehran(ts))} · تومان`,
    "",
    ...fxLines,
    "",
    "🥇 <b>طلا</b>",
    ...goldLines,
    "",
    ...coinSectionLines(map),
    "",
    ...usdtSection(usdt, usd, exchanges),
    "",
    `📊 ${mood.emoji} <b>${mood.label}</b>`,
    `<i>${escapeHtml(mood.sub)}</i>`,
    "",
    `🤖 @${escapeHtml(env.BOT_USERNAME)} · 📣 @${escapeHtml(env.CHANNEL_USERNAME)}`,
  ];

  return out.join("\n");
}

/** Channel posts should not ding subscribers. */
const CHANNEL_SILENT = { disable_notification: true } as const;

export async function castPriceList(env: Env): Promise<void> {
  if (!env.TELEGRAM_CHANNEL_ID) {
    throw new Error("TELEGRAM_CHANNEL_ID secret is empty — cannot cast price list");
  }
  const text = await buildPriceListHtml(env);
  const chatId = env.TELEGRAM_CHANNEL_ID;
  try {
    await sendMessage(env, chatId, text, CHANNEL_SILENT);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("castPriceList sendMessage failed", { chatId, err: msg });
    throw e;
  }
}

export async function buildSymbolCaption(
  env: Env,
  def: SymbolDef,
  row: LatestRow | null,
): Promise<string> {
  const u = unit(env);
  if (!row) {
    return `${def.emoji} <b>${escapeHtml(def.name)}</b> (<code>${def.id}</code>)\nNo data yet — wait for next scrape.`;
  }
  const delta = formatDelta(row.price, row.prev_price);
  const when = formatTimeTehran(row.updated_at);
  return [
    `${def.emoji} <b>${escapeHtml(def.name)}</b> · <code>${def.id}</code>`,
    `💵 <b>${formatPrice(row.price)}</b> ${escapeHtml(u)}`,
    `Δ ${escapeHtml(delta)}`,
    row.buy != null && row.sell != null
      ? `Buy ${formatPrice(row.buy)} · Sell ${formatPrice(row.sell)}`
      : null,
    `⏱ ${escapeHtml(when)} (Tehran) · 24h chart`,
    `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function chartPngForSymbol(
  env: Env,
  def: SymbolDef,
  range: "24h" | "7d" = "24h",
): Promise<{
  png: Uint8Array;
  caption: string;
  row: LatestRow | null;
}> {
  const row = await getLatest(env.DB, def.id);
  let points: Array<{ ts: number; price: number }> = [];

  if (range === "7d") {
    const ohlc = await getOhlcDays(env.DB, def.id, 7);
    points = ohlc.map((d) => ({
      ts: Math.floor(new Date(d.day + "T12:00:00Z").getTime() / 1000),
      price: d.close,
    }));
  } else {
    points = await getTicks24h(env.DB, def.id);
  }

  if (points.length < 2 && row) {
    points = [
      { ts: row.updated_at - 300, price: row.prev_price ?? row.price },
      { ts: row.updated_at, price: row.price },
    ];
  }

  const caption = await buildSymbolCaption(env, def, row);
  const png = await renderLineChartPng(points, {
    title: `${def.id} · ${def.name}`,
    subtitle: `${range} · ${unit(env)} · DollarChande`,
  });
  return { png, caption, row };
}

export async function cast6hCharts(env: Env): Promise<void> {
  // Keep it cheap: only top symbols for 6h chart dump
  const top = ["USD", "USDT", "EUR", "GOLD18", "EMAMI"];
  for (const id of top) {
    const def = resolveSymbol(id);
    if (!def) continue;
    const { png, caption } = await chartPngForSymbol(env, def);
    await sendPhoto(
      env,
      env.TELEGRAM_CHANNEL_ID,
      png,
      `📊 <b>6-hour update</b>\n${caption}`,
      CHANNEL_SILENT,
    );
  }
}

export async function castDaily(env: Env): Promise<void> {
  const focus = ["USD", "USDT", "EUR", "GOLD18", "EMAMI"];
  const u = unit(env);
  const ohlcLines: string[] = [`📅 <b>Daily OHLC</b> · ${escapeHtml(u)}`, ""];

  for (const id of focus) {
    const def = resolveSymbol(id);
    if (!def) continue;
    const days = await getOhlcDays(env.DB, def.id, 1);
    const d = days[days.length - 1];
    if (!d) {
      ohlcLines.push(`${def.emoji} <code>${def.id}</code>: no bar yet`);
      continue;
    }
    ohlcLines.push(
      `${def.emoji} <b>${escapeHtml(def.name)}</b> <code>${def.id}</code> · ${escapeHtml(d.day)}`,
      `   O ${formatPrice(d.open)} · H ${formatPrice(d.high)} · L ${formatPrice(d.low)} · C ${formatPrice(d.close)}`,
    );

    const { png, caption } = await chartPngForSymbol(env, def);
    await sendPhoto(
      env,
      env.TELEGRAM_CHANNEL_ID,
      png,
      `🗓 <b>Daily chart</b>\n${caption}`,
      CHANNEL_SILENT,
    );
  }

  ohlcLines.push("", `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, ohlcLines.join("\n"), CHANNEL_SILENT);
}
