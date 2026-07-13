/**
 * Rich message HTML (Bot API sendRichMessage) for normal PV/group replies.
 * Guest/inline keep classic InputTextMessageContent / captions.
 */

import type { Env } from "../env";
import type { SymbolDef } from "../symbols";
import { SYMBOLS } from "../symbols";
import type { LatestRow } from "../db/prices";
import type { CalcResult } from "../lib/calc";
import type { Lang } from "../db/settings";
import { escapeHtml, formatDelta, formatPrice, formatTimeTehran } from "../lib/format";
import { em } from "./emoji";

function channelUrl(env: Env): string {
  return `https://t.me/${env.CHANNEL_USERNAME}`;
}

function botAt(env: Env): string {
  return `@${escapeHtml(env.BOT_USERNAME)}`;
}

/** Format amount for calc lines (no locale commas for whole integers optional). */
function fmtAmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(12)));
}

export function richStart(env: Env, lang: Lang = "en"): string {
  if (lang === "fa") {
    return `
<h2>👋 Dollar Chande</h2>
<p>نرخ <b>بازار آزاد</b> به <b>تومان</b> · نمودار · هشدار · ماشین‌حساب</p>
<p>از دکمه‌ها برو، یا بفرست <code>USD</code> / <code>10 USDT + 5%</code></p>
<p><i>جستجو · مرور نماد · صرافی‌ها · هشدارها</i></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
  }

  return `
<h2>👋 Dollar Chande</h2>
<p>Live <b>free-market</b> rates in <b>Toman</b> · charts · alerts · calc</p>
<p>Use the buttons, or type <code>USD</code> / <code>10 USDT + 5%</code></p>
<p><i>Search · browse · exchanges · alerts</i></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richHelp(env: Env, lang: Lang = "en"): string {
  if (lang === "fa") {
    return `
<h2>ℹ️ راهنما · Dollar Chande</h2>
<p>ارز، طلا، سکه و <b>تتر چندصرافی</b> · نمودار · ماشین‌حساب · هشدار.</p>

<h3>قیمت و منو</h3>
<ul>
<li><code>/start</code> — خانه (دکمه‌ها)</li>
<li><code>USD</code> / <code>$USDT</code> — کارت + نمودار ۲۴س</li>
<li><code>USD 7d</code> یا <code>/7d USD</code> — نمودار ۷روزه</li>
<li><code>/symbols</code> — مرور دسته‌ای · <code>/symbols all</code> لیست متنی</li>
<li><code>USD USDT EUR</code> — چند نماد یک‌جا</li>
<li><code>/compare USD USDT</code> — اختلاف</li>
<li><code>/exchanges</code> — خرید/فروش تتر در صرافی‌ها</li>
<li><code>/history USD</code> · <code>/ohlc USD</code></li>
</ul>

<h3>ماشین‌حساب</h3>
<ul>
<li><code>10.5 USDT + 10%</code></li>
<li><code>(10 USDT + 5 EUR) * 1.1</code></li>
<li><code>50000000 in USDT</code> — تومان → دارایی</li>
<li><code>/fee 2</code> — کارمزد پیش‌فرض</li>
</ul>

<h3>هشدار قیمت</h3>
<p><b>یک‌بار</b> (پیش‌فرض) — یک اعلان، بعد حذف می‌شود.</p>
<p><b>تکراری</b> (<code>every</code>) — دوباره فقط بعد از برگشت قیمت از آستانه.</p>
<ul>
<li><code>/alert USD above 180000</code> — یک‌بار، وقتی ≥ آستانه</li>
<li><code>/alert USD below 170000</code> — یک‌بار، وقتی ≤ آستانه</li>
<li><code>/alert USD above 180000 every</code> — تکراری (بدون اسپم)</li>
<li><code>/alert USDT move 2</code> — یک‌بار، حرکت ≥٪۲</li>
<li><code>/alert USDT move 2 every</code> — هر بار حرکت ≥٪۲ از آخرین اعلان</li>
<li><code>/alerts</code> — لیست · <code>/unalert 3</code> — حذف</li>
</ul>
<p><i>حداکثر ۱۰ هشدار · کلیدواژه‌های تکراری: every / repeat / multi</i></p>

<h3>تنظیمات</h3>
<ul>
<li><code>/lang fa</code> · <code>/lang en</code></li>
<li><code>/settings</code> — زبان و کارمزد</li>
</ul>

<h3>بیشتر</h3>
<ul>
<li>اینلاین: <code>${botAt(env)} USD</code></li>
<li>مهمان: <code>${botAt(env)} 10 USDT + 5 EUR</code></li>
<li>منوی / پایین چت را هم ببین</li>
</ul>

<p>⏱ به‌روزرسانی ~۵ دقیقه · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
  }

  return `
<h2>ℹ️ Help · Dollar Chande</h2>
<p>Free-market FX, gold, coins &amp; multi-exchange <b>USDT</b> · charts · calc · alerts.</p>

<h3>Prices &amp; menu</h3>
<ul>
<li><code>/start</code> — home (buttons)</li>
<li><code>USD</code> / <code>$USDT</code> — card + 24h chart</li>
<li><code>USD 7d</code> or <code>/7d USD</code> — 7-day chart</li>
<li><code>/symbols</code> — browse by category · <code>/symbols all</code> text list</li>
<li><code>USD USDT EUR</code> — multi snapshot</li>
<li><code>/compare USD USDT</code> — spread</li>
<li><code>/exchanges</code> — USDT buy/sell by exchange</li>
<li><code>/history USD</code> · <code>/ohlc USD</code></li>
</ul>

<h3>Calculator</h3>
<ul>
<li><code>10.5 USDT + 10%</code></li>
<li><code>(10 USDT + 5 EUR) * 1.1</code></li>
<li><code>50000000 in USDT</code> — Toman → asset</li>
<li><code>/fee 2</code> — default fee for calc</li>
</ul>

<h3>Price alerts</h3>
<p><b>once</b> (default) — notify once, then the alert is removed.</p>
<p><b>every</b> — can fire again only after the price clears the threshold (no spam while it stays past the line).</p>
<ul>
<li><code>/alert USD above 180000</code> — once, when ≥ threshold</li>
<li><code>/alert USD below 170000</code> — once, when ≤ threshold</li>
<li><code>/alert USD above 180000 every</code> — repeat after clear</li>
<li><code>/alert USDT move 2</code> — once, on ≥2% move</li>
<li><code>/alert USDT move 2 every</code> — each new ≥2% leg from last fire</li>
<li><code>/alerts</code> — list · <code>/unalert 3</code> — delete</li>
</ul>
<p><i>Max 10 alerts · repeat keywords: every / repeat / multi</i></p>

<h3>Settings</h3>
<ul>
<li><code>/lang en</code> · <code>/lang fa</code></li>
<li><code>/settings</code> — language &amp; fee</li>
</ul>

<h3>Also</h3>
<ul>
<li>Inline: <code>${botAt(env)} USD</code></li>
<li>Guest: <code>${botAt(env)} 10 USDT + 5 EUR</code></li>
<li>Open the <b>/</b> menu for commands</li>
</ul>

<p>⏱ ~5 min refresh · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richSymbols(lang: Lang = "en"): string {
  const order: Array<"fx" | "crypto" | "gold" | "coin"> = ["fx", "crypto", "gold", "coin"];
  const labelsEn: Record<string, string> = {
    fx: "💱 Currencies",
    crypto: "💰 Crypto",
    gold: "🥇 Gold",
    coin: "🪙 Coins",
  };
  const labelsFa: Record<string, string> = {
    fx: "💱 ارزها",
    crypto: "💰 کریپتو",
    gold: "🥇 طلا",
    coin: "🪙 سکه",
  };
  const labels = lang === "fa" ? labelsFa : labelsEn;

  const parts: string[] = [
    lang === "fa" ? `<h2>📋 لیست نمادها</h2>` : `<h2>📋 Symbol list</h2>`,
    lang === "fa"
      ? `<p><i>کد را بفرست تا قیمت + نمودار ۲۴س بیاد.</i></p>`
      : `<p><i>Send a code for price + 24h chart.</i></p>`,
  ];

  for (const kind of order) {
    const group = SYMBOLS.filter((s) => s.kind === kind);
    if (!group.length) continue;
    parts.push(`<h3>${labels[kind]}</h3>`);
    parts.push("<ul>");
    for (const s of group) {
      parts.push(
        `<li>${s.emoji} <code>${s.id}</code> — ${escapeHtml(s.name)}</li>`,
      );
    }
    parts.push("</ul>");
  }

  parts.push(
    lang === "fa"
      ? `<p>پیشنهاد: اول <code>USD</code> یا <code>USDT</code> را امتحان کن.</p>`
      : `<p>Tip: try <code>USD</code> or <code>USDT</code> first.</p>`,
  );
  return parts.join("\n");
}

export function richUnknown(token: string, lang: Lang = "en"): string {
  if (lang === "fa") {
    return `
<h3>❓ نماد ناشناخته</h3>
<p><code>${escapeHtml(token)}</code></p>
<ul>
<li>امتحان کن: <code>USD</code>، <code>$USDT</code> یا <code>/EUR</code></li>
<li>یا حساب کن: <code>10 USDT + 5 EUR</code></li>
<li>لیست کامل: <code>/symbols</code> · راهنما: <code>/help</code></li>
</ul>
`.trim();
  }
  return `
<h3>❓ Unknown symbol</h3>
<p><code>${escapeHtml(token)}</code></p>
<ul>
<li>Try <code>USD</code>, <code>$USDT</code>, or <code>/EUR</code></li>
<li>Or calculate: <code>10 USDT + 5 EUR</code></li>
<li>Full list: <code>/symbols</code> · help: <code>/help</code></li>
</ul>
`.trim();
}

export function richSettings(
  env: Env,
  lang: Lang,
  feePct: number,
): string {
  if (lang === "fa") {
    return `
<h2>${em("sparkle")} تنظیمات</h2>
<p>زبان: <b>fa</b> → <code>/lang en</code></p>
<p>کارمزد پیش‌فرض: <b>${feePct}%</b> → <code>/fee 2</code></p>
<p>هشدار: <code>/alert USD above 180000</code> · <code>every</code> = تکراری</p>
<p>لیست: <code>/alerts</code> · حذف: <code>/unalert ID</code></p>
<p>تتر صرافی‌ها: <code>/exchanges</code></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
  }
  return `
<h2>${em("sparkle")} Settings</h2>
<p>Language: <b>${lang}</b> → <code>/lang fa</code> · <code>/lang en</code></p>
<p>Default fee: <b>${feePct}%</b> → <code>/fee 2</code></p>
<p>Alerts: <code>/alert USD above 180000</code> · add <code>every</code> to repeat</p>
<p>List: <code>/alerts</code> · remove: <code>/unalert ID</code></p>
<p>USDT exchanges: <code>/exchanges</code></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richCalcError(env: Env, error: string): string {
  return `
<p>${em("sparkle")} <b>Couldn’t parse</b></p>
<p><i>${escapeHtml(error)}</i></p>
<p>e.g. <code>10 USDT + 5 EUR</code></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

function termLine(t: CalcResult["terms"][number]): string {
  if (t.kind === "percent") {
    const sign = t.sign < 0 ? "−" : "+";
    return `<p>${sign}${fmtAmt(t.percent)}% → <b>${t.sign < 0 ? "−" : ""}${formatPrice(Math.abs(t.subtotal))}</b> <i>of ${formatPrice(t.base)}</i></p>`;
  }
  if (t.kind === "fee") {
    return `<p>fee ${fmtAmt(t.percent)}% → <b>${formatPrice(t.subtotal)}</b></p>`;
  }
  const sign = t.sign < 0 ? "−" : "";
  return `<p>${sign}${fmtAmt(t.amount)} $${t.symbol.id} → <b>${formatPrice(Math.abs(t.subtotal))}</b> <i>(${formatPrice(t.unitPrice)})</i></p>`;
}

function cashExpression(result: CalcResult): string {
  if (result.invertAmount != null && result.invertSymbol) {
    return `${formatPrice(result.total)} IRT → $${result.invertSymbol}`;
  }
  return result.terms
    .map((t, i) => {
      let body: string;
      if (t.kind === "percent") body = `${fmtAmt(t.percent)}%`;
      else if (t.kind === "fee") body = `fee ${fmtAmt(t.percent)}%`;
      else body = `${fmtAmt(t.amount)} $${t.symbol.id}`;
      if (i === 0) return t.kind === "asset" && t.sign < 0 ? `−${body}` : body;
      if (t.kind === "asset") return `${t.sign < 0 ? "−" : "+"} ${body}`;
      if (t.kind === "percent") return `${t.sign < 0 ? "−" : "+"} ${body}`;
      return `+ ${body}`;
    })
    .join(" ");
}

/** Minimal calc / invert card */
export function richCalc(env: Env, result: CalcResult, nowSec = Math.floor(Date.now() / 1000)): string {
  const channel = `@${escapeHtml(env.CHANNEL_USERNAME)}`;
  const expr = cashExpression(result);
  const whenFallback = formatTimeTehran(nowSec);
  const time = `<tg-time unix="${nowSec}" format="r">${escapeHtml(whenFallback)}</tg-time>`;

  // Invert: X IRT → N USDT
  if (result.invertAmount != null && result.invertSymbol) {
    return `
<h2>${expr}</h2>
<p>${em("price")} <b>${result.invertAmount.toFixed(4)}</b> $${result.invertSymbol}</p>
<p><i>@ ${formatPrice(result.terms[0] && result.terms[0].kind === "asset" ? result.terms[0].unitPrice : 0)} IRT each</i></p>
<p>${em("clock")} ${time} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
  }

  if (result.terms.length === 1 && result.terms[0]!.kind === "asset") {
    const t = result.terms[0]!;
    return `
<h2>${expr}</h2>
<p>${em("price")} <b>${formatPrice(result.total)}</b> ${escapeHtml(result.unit)}</p>
<p><i>@ ${formatPrice(t.unitPrice)} each</i></p>
<p>${em("clock")} ${time} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
  }

  return `
<h2>${expr}</h2>
${result.terms.map(termLine).join("\n")}
<p>${em("price")} <b>${formatPrice(result.total)}</b> ${escapeHtml(result.unit)}</p>
<p>${em("clock")} ${time} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
}

export function richExchanges(
  env: Env,
  rows: Array<{ name: string; buy: number | null; sell: number | null; mid: number | null; updated_at: number }>,
): string {
  const sorted = [...rows].sort((a, b) => (a.mid ?? 1e18) - (b.mid ?? 1e18));
  const lines = sorted
    .map((r) => {
      const buy = r.buy != null ? formatPrice(r.buy) : "—";
      const sell = r.sell != null ? formatPrice(r.sell) : "—";
      const mid = r.mid != null ? formatPrice(r.mid) : "—";
      return `<p><b>${escapeHtml(r.name)}</b> · mid <b>${mid}</b>\n${em("buy")} ${buy} · ${em("sell")} ${sell}</p>`;
    })
    .join("\n");
  const newest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
  const when = newest ? formatTimeTehran(newest) : "—";
  const mids = sorted.map((r) => r.mid).filter((x): x is number => x != null);
  const lo = mids.length ? Math.min(...mids) : null;
  const hi = mids.length ? Math.max(...mids) : null;
  const spread =
    lo != null && hi != null
      ? `<p>⬆ max <b>${formatPrice(hi)}</b> · ⬇ min <b>${formatPrice(lo)}</b> · Δ <b>${formatPrice(hi - lo)}</b></p>`
      : "";
  return `
<h2>${em("price")} USDT exchanges</h2>
<p><i>${rows.length} venues · Buy = you pay · Sell = you receive (Toman)</i></p>
${spread}
${lines || "<p>No exchange data yet — wait for next scrape.</p>"}
<p>${em("clock")} <tg-time unix="${newest || Math.floor(Date.now() / 1000)}" format="r">${escapeHtml(when)}</tg-time> · ${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richCompare(
  env: Env,
  a: { id: string; name: string; emoji: string; price: number },
  b: { id: string; name: string; emoji: string; price: number },
): string {
  const ratio = b.price > 0 ? a.price / b.price : 0;
  const spread = a.price - b.price;
  const spreadPct = b.price > 0 ? (spread / b.price) * 100 : 0;
  const sign = spread >= 0 ? "+" : "";
  return `
<h2>${a.emoji} $${a.id} vs ${b.emoji} $${b.id}</h2>
<p>${a.emoji} <b>${formatPrice(a.price)}</b> IRT</p>
<p>${b.emoji} <b>${formatPrice(b.price)}</b> IRT</p>
<p>Spread <b>${sign}${formatPrice(spread)}</b> (${sign}${spreadPct.toFixed(2)}%)</p>
<p>1 $${a.id} ≈ <b>${ratio.toFixed(4)}</b> $${b.id}</p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richMulti(
  env: Env,
  rows: Array<{ id: string; emoji: string; price: number }>,
): string {
  const body = rows
    .map((r) => `<p>${r.emoji} $${r.id} · <b>${formatPrice(r.price)}</b></p>`)
    .join("\n");
  return `
<h2>${em("sparkle")} Snapshot</h2>
${body}
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richHistory(
  env: Env,
  id: string,
  emoji: string,
  days: Array<{ day: string; open: number; high: number; low: number; close: number }>,
): string {
  const lines = days
    .slice(-7)
    .map(
      (d) =>
        `<p><code>${escapeHtml(d.day)}</code> O ${formatPrice(d.open)} · H ${formatPrice(d.high)} · L ${formatPrice(d.low)} · C <b>${formatPrice(d.close)}</b></p>`,
    )
    .join("\n");
  return `
<h2>${emoji} $${id} history</h2>
${lines || "<p>No OHLC yet.</p>"}
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

export function richOhlc(
  env: Env,
  id: string,
  emoji: string,
  d: { day: string; open: number; high: number; low: number; close: number } | null,
): string {
  if (!d) {
    return `<h2>${emoji} $${id}</h2><p>No OHLC bar yet.</p>`;
  }
  return `
<h2>${emoji} $${id} · ${escapeHtml(d.day)}</h2>
<p>Open <b>${formatPrice(d.open)}</b></p>
<p>${em("high")} High <b>${formatPrice(d.high)}</b></p>
<p>${em("low")} Low <b>${formatPrice(d.low)}</b></p>
<p>Close <b>${formatPrice(d.close)}</b></p>
<p>${em("channel")} <a href="${channelUrl(env)}">@${escapeHtml(env.CHANNEL_USERNAME)}</a></p>
`.trim();
}

/** Right-align numbers in a monospaced price block (tabs/spaces). */
function priceLine(label: string, n: number, labelW = 9, numW = 14): string {
  const num = formatPrice(n);
  return `${label.padEnd(labelW)}${num.padStart(numW)}`;
}

/**
 * Free-market card (no tables):
 *
 *   💲 US Dollar
 *   $USD · free market
 *   [chart]
 *   📊 24h pulse
 *
 *   💵 178,850 IRT
 *   📈 Tick  +120 (+0.07%)
 *   📉 24h   −1,200 (−0.67%)
 *
 *   🟢 Buy        178,800
 *   🔴 Sell       178,900
 *   🔺 Day high   179,200
 *   🔻 Day low    178,400
 *
 *   🕒 Mon 13 Jul, 05:30 · $USD · 📢 @Channel
 */
export function richSymbolPrice(
  env: Env,
  def: SymbolDef,
  row: LatestRow | null,
  chartUrl?: string,
  dayRange?: { high: number; low: number } | null,
  price24hAgo?: number | null,
): string {
  const unit = "IRT";
  // Bare $USD → native cashtag (entity detection on)
  const cash = `$${def.id}`;
  const channel = `@${escapeHtml(env.CHANNEL_USERNAME)}`;

  if (!row) {
    return `
<h2>${def.emoji} ${escapeHtml(def.name)}</h2>
<p>${cash} · ${em("sparkle")} free market</p>
<p>No data yet — wait for the next scrape.</p>
`.trim();
  }

  // Fallback text inside tg-time MUST look like a real datetime so clients
  // that don't render the entity still show something useful.
  const whenAbs = formatTimeTehran(row.updated_at);
  const high = dayRange?.high ?? row.price;
  const low = dayRange?.low ?? row.price;
  const buy = row.buy ?? row.price;
  const sell = row.sell ?? row.price;

  const icons = { up: em("up"), down: em("down"), flat: em("flat") };
  const tickCh = formatDelta(row.price, row.prev_price, icons);
  const dayCh = formatDelta(row.price, price24hAgo, icons);

  const chartBlock = chartUrl
    ? `<img src="${escapeHtml(chartUrl)}" alt="${escapeHtml(def.id)} 24h"/>
<p>${em("chart")} <i>24h pulse</i></p>`
    : "";

  // Tab-aligned book (plain text in <pre> so columns stay fixed-width)
  const book = [
    priceLine("Buy", buy, 10, 12),
    priceLine("Sell", sell, 10, 12),
    priceLine("Day high", high, 10, 12),
    priceLine("Day low", low, 10, 12),
  ].join("\n");

  // Client renders these as live local datetime (format regex: r | w?[dD]?[tT]?)
  // Fallback text = absolute Tehran string so older clients still read something.
  const timeLive = `<tg-time unix="${row.updated_at}" format="wDt">${escapeHtml(whenAbs)}</tg-time>`;
  const timeRel = `<tg-time unix="${row.updated_at}" format="r">${escapeHtml(whenAbs)}</tg-time>`;

  return `
<h2>${def.emoji} ${escapeHtml(def.name)}</h2>
<p>${cash} · ${em("sparkle")} free market</p>
${chartBlock}
<p>${em("price")} <b>${formatPrice(row.price)}</b> ${unit}</p>
<p>${em("sparkle")} <b>Tick</b> · ${tickCh}</p>
<p>${em("chart")} <b>24h</b> · ${dayCh}</p>
<p>${em("buy")} <b>Buy</b> · ${em("sell")} <b>Sell</b></p>
<pre>${book}</pre>
<p>${em("clock")} ${timeLive} · ${timeRel}</p>
<p>${cash} · ${em("channel")} <a href="${channelUrl(env)}">${channel}</a></p>
`.trim();
}


