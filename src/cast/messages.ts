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
import { renderLineChartPng } from "../lib/chart";
import { sendMessage, sendPhoto } from "../telegram/api";

function unit(env: Env): string {
  return env.PRICE_UNIT || "Toman";
}

/** Compact ticker labels for channel FX board (hybrid v2). */
const FX_TICKER: Array<{ id: string; label: string }> = [
  { id: "USD", label: "$USD" },
  { id: "EUR", label: "€EUR" },
  { id: "GBP", label: "£GBP" },
  { id: "CHF", label: "₣CHF" },
  { id: "CAD", label: "C$CAD" },
  { id: "TRY", label: "₺TRY" },
  { id: "KWD", label: "KD KWD" },
  { id: "BHD", label: ".BD BHD" },
  { id: "USDT", label: "₮USDT" },
];

const GOLD_IDS = ["MITHQAL", "GOLD18"] as const;
const GOLD_LABEL: Record<string, string> = {
  MITHQAL: "Mithqal",
  GOLD18: "18k/g",
};
const COIN_IDS = ["EMAMI", "AZADI", "HALF", "QUARTER", "GERAMI"] as const;
const COIN_LABEL: Record<string, string> = {
  EMAMI: "Emami",
  AZADI: "Azadi",
  HALF: "½",
  QUARTER: "¼",
  GERAMI: "Gerami",
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

function tickerLine(label: string, price: number | undefined): string {
  const lab = label.padEnd(8, " ");
  const val = price != null ? formatPrice(price).padStart(10, " ") : "—".padStart(10, " ");
  return `${lab} ${val}`;
}

function usdtArbLines(exchanges: ExchangeRow[]): string[] {
  const ok = exchanges.filter(
    (e) => saneUsdtToman(e.mid) || saneUsdtToman(e.buy) || saneUsdtToman(e.sell),
  );
  if (!ok.length) return [];

  const withMid = ok
    .map((e) => {
      const buyN = saneUsdtToman(e.buy) ? e.buy! : null;
      const sellN = saneUsdtToman(e.sell) ? e.sell! : null;
      let midN: number | null = saneUsdtToman(e.mid) ? e.mid! : null;
      if (midN == null && buyN != null && sellN != null) midN = Math.round((buyN + sellN) / 2);
      if (midN == null) midN = buyN ?? sellN;
      return { ...e, midN, buyN, sellN };
    })
    .filter((e): e is typeof e & { midN: number } => saneUsdtToman(e.midN));

  if (!withMid.length) return [];

  const hi = withMid.reduce((a, b) => (b.midN > a.midN ? b : a));
  const lo = withMid.reduce((a, b) => (b.midN < a.midN ? b : a));

  const buyers = withMid.filter((e) => e.buyN != null);
  const sellers = withMid.filter((e) => e.sellN != null);
  const cheapBuy = buyers.length
    ? buyers.reduce((a, b) => (b.buyN! < a.buyN! ? b : a))
    : null;
  const bestSell = sellers.length
    ? sellers.reduce((a, b) => (b.sellN! > a.sellN! ? b : a))
    : null;

  const lines = [
    `💸 <b>USDT</b>  ⬆ ${escapeHtml(hi.name)} <b>${formatPrice(hi.midN)}</b> · ⬇ ${escapeHtml(lo.name)} <b>${formatPrice(lo.midN)}</b>`,
  ];
  if (cheapBuy?.buyN != null && bestSell?.sellN != null) {
    const spread = bestSell.sellN - cheapBuy.buyN;
    lines.push(
      `<i>arb buy ${escapeHtml(cheapBuy.name)} → sell ${escapeHtml(bestSell.name)} · ${formatPrice(spread)} Δ</i>`,
    );
  }
  return lines;
}

/**
 * Channel list · hybrid v2
 * mood + Jalali + FX ticker + GOLD/COINS + USDT arb + footer
 */
export async function buildPriceListHtml(env: Env): Promise<string> {
  const [rows, exchanges] = await Promise.all([
    getAllLatest(env.DB),
    listExchanges(env.DB).catch(() => [] as ExchangeRow[]),
  ]);
  const map = new Map(rows.map((r) => [r.symbol, r]));
  const u = unit(env);
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const ts = newest || Math.floor(Date.now() / 1000);
  const mood = marketMood(map);

  const fxBlock = FX_TICKER.map(({ id, label }) =>
    tickerLine(label, map.get(id)?.price),
  ).join("\n");

  const usd = map.get("USD")?.price;
  const usdt = map.get("USDT")?.price;
  const usdtUsd =
    usd != null && usdt != null ? usdt - usd : null;

  const goldLines = GOLD_IDS.map((id) => {
    const row = map.get(id);
    const lab = (GOLD_LABEL[id] ?? id).padEnd(8, " ");
    if (!row) return `  ${lab} —`;
    const d = formatDeltaQuiet(row.price, row.prev_price);
    return `  ${lab} <b>${formatPrice(row.price)}</b>${d ? `  ${escapeHtml(d)}` : ""}`;
  });

  const coinParts = COIN_IDS.map((id) => {
    const row = map.get(id);
    const lab = COIN_LABEL[id] ?? id;
    if (!row) return `${lab} —`;
    return `${lab} <b>${formatPrice(row.price)}</b>`;
  });
  // two compact coin lines (matches approved mock)
  const coinsLine1 = coinParts.slice(0, 2).join(" · ");
  const coinsLine2 = coinParts.slice(2).join(" · ");

  const out: string[] = [
    `✨ <b>DollarChande</b>`,
    `بازار الان: ${mood.emoji} <b>${mood.label}</b>`,
    `<i>(${escapeHtml(mood.sub)})</i>`,
    "",
    `⏰ ${escapeHtml(formatJalaliTehran(ts))} · ${escapeHtml(u)}`,
    "",
    `<code>${fxBlock}</code>`,
  ];

  if (usdtUsd != null) {
    out.push(`<i>₮−$ · ${formatPrice(usdtUsd)}</i>`);
  }

  out.push("", "🥇 <b>GOLD</b>", ...goldLines, "", "🪙 <b>COINS</b>", `  ${coinsLine1}`, `  ${coinsLine2}`);

  const arb = usdtArbLines(exchanges);
  if (arb.length) {
    out.push("", ...arb);
  }

  out.push(
    "",
    `🤖 @${escapeHtml(env.BOT_USERNAME)} · 📣 @${escapeHtml(env.CHANNEL_USERNAME)}`,
  );

  return out.join("\n");
}

export async function castPriceList(env: Env): Promise<void> {
  if (!env.TELEGRAM_CHANNEL_ID) {
    throw new Error("TELEGRAM_CHANNEL_ID secret is empty — cannot cast price list");
  }
  const text = await buildPriceListHtml(env);
  const chatId = env.TELEGRAM_CHANNEL_ID;
  try {
    await sendMessage(env, chatId, text);
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
    );
  }

  ohlcLines.push("", `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, ohlcLines.join("\n"));
}
