export type AlertDirection = "above" | "below" | "move_pct";
/** once = fire then delete; repeat = re-arm only after condition clears */
export type AlertMode = "once" | "repeat";

export interface AlertRow {
  id: number;
  chat_id: string;
  symbol: string;
  direction: AlertDirection;
  threshold: number;
  created_at: number;
  last_fired_at: number | null;
  last_price: number | null;
  mode: AlertMode;
  armed: number; // 1 = ready, 0 = waiting for re-arm
}

export async function addAlert(
  db: D1Database,
  chatId: string,
  symbol: string,
  direction: AlertDirection,
  threshold: number,
  mode: AlertMode = "once",
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const r = await db
    .prepare(
      `INSERT INTO alerts (chat_id, symbol, direction, threshold, created_at, last_fired_at, last_price, mode, armed)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 1)`,
    )
    .bind(chatId, symbol, direction, threshold, now, mode)
    .run();
  return Number(r.meta.last_row_id ?? 0);
}

export async function listAlerts(db: D1Database, chatId: string): Promise<AlertRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, chat_id, symbol, direction, threshold, created_at, last_fired_at, last_price,
              COALESCE(mode, 'once') AS mode, COALESCE(armed, 1) AS armed
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

function conditionMet(a: AlertRow, price: number): boolean {
  if (a.direction === "above") return price >= a.threshold;
  if (a.direction === "below") return price <= a.threshold;
  if (a.direction === "move_pct" && a.last_price != null && a.last_price > 0) {
    const pct = (Math.abs(price - a.last_price) / a.last_price) * 100;
    return pct >= a.threshold;
  }
  return false;
}

/**
 * Evaluate alerts against current prices.
 * - once: fire once, then delete
 * - repeat: fire when armed + condition; disarm; re-arm only when condition clears
 * move_pct seeds last_price on first sight without firing.
 */
export async function checkAlerts(
  db: D1Database,
  prices: Map<string, number>,
  now = Math.floor(Date.now() / 1000),
): Promise<Array<AlertRow & { price: number }>> {
  const { results } = await db
    .prepare(
      `SELECT id, chat_id, symbol, direction, threshold, created_at, last_fired_at, last_price,
              COALESCE(mode, 'once') AS mode, COALESCE(armed, 1) AS armed
       FROM alerts`,
    )
    .all<AlertRow>();
  const fired: Array<AlertRow & { price: number }> = [];

  for (const raw of results ?? []) {
    const a: AlertRow = {
      ...raw,
      mode: raw.mode === "repeat" ? "repeat" : "once",
      armed: raw.armed ? 1 : 0,
    };
    const price = prices.get(a.symbol);
    if (price == null) continue;

    // Seed baseline for move_pct — never fire on first sample
    if (a.direction === "move_pct" && a.last_price == null) {
      await db
        .prepare(`UPDATE alerts SET last_price = ? WHERE id = ?`)
        .bind(price, a.id)
        .run();
      continue;
    }

    const hit = conditionMet(a, price);

    if (hit && a.armed) {
      fired.push({ ...a, price });
      if (a.mode === "once") {
        await db.prepare(`DELETE FROM alerts WHERE id = ?`).bind(a.id).run();
      } else if (a.direction === "move_pct") {
        // New baseline; stay armed so the next ≥threshold leg can fire
        await db
          .prepare(
            `UPDATE alerts SET last_fired_at = ?, last_price = ?, armed = 1 WHERE id = ?`,
          )
          .bind(now, price, a.id)
          .run();
      } else {
        // above/below: disarm until price clears the threshold (no spam)
        await db
          .prepare(
            `UPDATE alerts SET last_fired_at = ?, last_price = ?, armed = 0 WHERE id = ?`,
          )
          .bind(now, price, a.id)
          .run();
      }
      continue;
    }

    // Re-arm repeat above/below only after condition clears
    if (!hit && a.mode === "repeat" && !a.armed && a.direction !== "move_pct") {
      await db
        .prepare(`UPDATE alerts SET armed = 1 WHERE id = ?`)
        .bind(a.id)
        .run();
    }
  }
  return fired;
}
