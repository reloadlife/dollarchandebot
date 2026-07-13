export type AlertDirection = "above" | "below" | "move_pct";

export interface AlertRow {
  id: number;
  chat_id: string;
  symbol: string;
  direction: AlertDirection;
  threshold: number;
  created_at: number;
  last_fired_at: number | null;
  last_price: number | null;
}

export async function addAlert(
  db: D1Database,
  chatId: string,
  symbol: string,
  direction: AlertDirection,
  threshold: number,
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const r = await db
    .prepare(
      `INSERT INTO alerts (chat_id, symbol, direction, threshold, created_at, last_fired_at, last_price)
       VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
    )
    .bind(chatId, symbol, direction, threshold, now)
    .run();
  return Number(r.meta.last_row_id ?? 0);
}

export async function listAlerts(db: D1Database, chatId: string): Promise<AlertRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, chat_id, symbol, direction, threshold, created_at, last_fired_at, last_price
       FROM alerts WHERE chat_id = ? ORDER BY id DESC LIMIT 20`,
    )
    .bind(chatId)
    .all<AlertRow>();
  return results ?? [];
}

export async function deleteAlert(db: D1Database, chatId: string, id: number): Promise<boolean> {
  const r = await db
    .prepare(`DELETE FROM alerts WHERE id = ? AND chat_id = ?`)
    .bind(id, chatId)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

export async function countAlerts(db: D1Database, chatId: string): Promise<number> {
  const r = await db
    .prepare(`SELECT COUNT(*) AS c FROM alerts WHERE chat_id = ?`)
    .bind(chatId)
    .first<{ c: number }>();
  return r?.c ?? 0;
}

/** Alerts that should fire for current prices. Cooldown 30m. */
export async function checkAlerts(
  db: D1Database,
  prices: Map<string, number>,
  now = Math.floor(Date.now() / 1000),
): Promise<Array<AlertRow & { price: number }>> {
  const { results } = await db
    .prepare(
      `SELECT id, chat_id, symbol, direction, threshold, created_at, last_fired_at, last_price FROM alerts`,
    )
    .all<AlertRow>();
  const fired: Array<AlertRow & { price: number }> = [];
  const cooldown = 30 * 60;

  for (const a of results ?? []) {
    const price = prices.get(a.symbol);
    if (price == null) continue;
    if (a.last_fired_at != null && now - a.last_fired_at < cooldown) continue;

    let hit = false;
    if (a.direction === "above" && price >= a.threshold) hit = true;
    if (a.direction === "below" && price <= a.threshold) hit = true;
    if (a.direction === "move_pct" && a.last_price != null && a.last_price > 0) {
      const pct = (Math.abs(price - a.last_price) / a.last_price) * 100;
      if (pct >= a.threshold) hit = true;
    }

    // seed last_price on first check for move_pct
    if (a.direction === "move_pct" && a.last_price == null) {
      await db
        .prepare(`UPDATE alerts SET last_price = ? WHERE id = ?`)
        .bind(price, a.id)
        .run();
      continue;
    }

    if (hit) {
      fired.push({ ...a, price });
      await db
        .prepare(`UPDATE alerts SET last_fired_at = ?, last_price = ? WHERE id = ?`)
        .bind(now, price, a.id)
        .run();
    } else if (a.direction === "move_pct") {
      await db.prepare(`UPDATE alerts SET last_price = ? WHERE id = ?`).bind(price, a.id).run();
    }
  }
  return fired;
}
