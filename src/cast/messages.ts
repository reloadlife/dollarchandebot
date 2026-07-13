import type { Env } from "../env";
import { getAllLatest, getLatest, getOhlcDays, getTicks24h, type LatestRow } from "../db/prices";
// getOhlcDays used for 7d charts
import { channelSymbols, resolveSymbol, type SymbolDef } from "../symbols";
import { escapeHtml, formatDelta, formatPrice, formatTimeTehran } from "../lib/format";
import { renderLineChartPng } from "../lib/chart";
import { sendMessage, sendPhoto } from "../telegram/api";

function unit(env: Env): string {
  return env.PRICE_UNIT || "Toman";
}

function lineFor(def: SymbolDef, row: LatestRow | undefined, u: string): string {
  if (!row) return `${def.emoji} <b>${escapeHtml(def.name)}</b> <code>${def.id}</code>: —`;
  const delta = formatDelta(row.price, row.prev_price);
  return `${def.emoji} <b>${escapeHtml(def.name)}</b> <code>${def.id}</code>: <b>${formatPrice(row.price)}</b> ${u}  <i>(${escapeHtml(delta)})</i>`;
}

export async function buildPriceListHtml(env: Env): Promise<string> {
  const rows = await getAllLatest(env.DB);
  const map = new Map(rows.map((r) => [r.symbol, r]));
  const u = unit(env);
  const lines = channelSymbols().map((s) => lineFor(s, map.get(s.id), u));
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const when = newest ? formatTimeTehran(newest) : formatTimeTehran(Math.floor(Date.now() / 1000));

  return [
    `📡 <b>Free-market rates</b> · ${escapeHtml(when)} (Tehran)`,
    `Unit: <b>${escapeHtml(u)}</b> · Sources: Bonbast + Tetherland`,
    "",
    ...lines,
    "",
    `🤖 @${escapeHtml(env.BOT_USERNAME)} · send a symbol (e.g. <code>USD</code>) for a 24h chart`,
    `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`,
  ].join("\n");
}

export async function castPriceList(env: Env): Promise<void> {
  const text = await buildPriceListHtml(env);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, text);
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
