import { expect, test } from "bun:test";
import { checkAlerts, type AlertRow } from "./alerts";

type Stored = AlertRow;

function memoryDb(seed: Stored[]) {
  const rows = seed.map((row) => ({ ...row }));
  const apply = (sql: string, args: unknown[]) => {
    const compact = sql.replace(/\s+/g, " ").trim();
    if (compact.startsWith("SELECT")) {
      return { results: rows.map((row) => ({ ...row })) };
    }
    const id = args[args.length - 1] as number;
    const row = rows.find((item) => item.id === id);
    if (compact.startsWith("DELETE")) {
      const index = rows.findIndex((item) => item.id === id);
      if (index >= 0) rows.splice(index, 1);
      return { results: [] };
    }
    if (!row) return { results: [] };
    if (compact.includes("last_fired_at = ?") && compact.includes("armed = 0")) {
      row.last_fired_at = args[0] as number;
      row.last_price = args[1] as number;
      row.armed = 0;
    } else if (compact.includes("last_fired_at = ?") && compact.includes("armed = 1")) {
      row.last_fired_at = args[0] as number;
      row.last_price = args[1] as number;
      row.armed = 1;
    } else if (compact.includes("SET last_price = ?")) {
      row.last_price = args[0] as number;
    } else if (compact.includes("SET armed = 1")) {
      row.armed = 1;
    }
    return { results: [] };
  };
  const statement = (sql: string) => {
    const bound = (args: unknown[]) => ({
      all: async () => apply(sql, args),
      run: async () => {
        apply(sql, args);
        return { success: true, meta: {} };
      },
    });
    return {
      bind: (...args: unknown[]) => bound(args),
      all: async () => apply(sql, []),
    };
  };
  return {
    rows,
    db: { prepare: statement } as unknown as D1Database,
  };
}

function alert(partial: Partial<Stored> & Pick<Stored, "id" | "direction" | "threshold">): Stored {
  return {
    chat_id: "1",
    symbol: "USD",
    created_at: 1,
    last_fired_at: null,
    last_price: null,
    mode: "once",
    armed: 1,
    ...partial,
  };
}

test("once alert fires and is deleted", async () => {
  const { db, rows } = memoryDb([alert({ id: 7, direction: "above", threshold: 180000 })]);
  const hit = await checkAlerts(db, new Map([["USD", 180000]]), 50);
  expect(hit.map((row) => row.id)).toEqual([7]);
  expect(rows).toHaveLength(0);
  const again = await checkAlerts(db, new Map([["USD", 190000]]), 60);
  expect(again).toHaveLength(0);
});

test("repeat above disarms until the price clears, then re-arms", async () => {
  const { db, rows } = memoryDb([
    alert({ id: 3, direction: "above", threshold: 180000, mode: "repeat" }),
  ]);
  const first = await checkAlerts(db, new Map([["USD", 181000]]), 10);
  expect(first).toHaveLength(1);
  expect(rows[0]?.armed).toBe(0);
  const stillHigh = await checkAlerts(db, new Map([["USD", 190000]]), 20);
  expect(stillHigh).toHaveLength(0);
  expect(rows[0]?.armed).toBe(0);
  const cleared = await checkAlerts(db, new Map([["USD", 179000]]), 30);
  expect(cleared).toHaveLength(0);
  expect(rows[0]?.armed).toBe(1);
  const second = await checkAlerts(db, new Map([["USD", 180000]]), 40);
  expect(second.map((row) => row.id)).toEqual([3]);
  expect(rows[0]?.armed).toBe(0);
});

test("repeat below disarms until the price rises, then re-arms", async () => {
  const { db, rows } = memoryDb([
    alert({ id: 4, direction: "below", threshold: 170000, mode: "repeat" }),
  ]);
  expect(await checkAlerts(db, new Map([["USD", 169000]]), 10)).toHaveLength(1);
  expect(rows[0]?.armed).toBe(0);
  expect(await checkAlerts(db, new Map([["USD", 160000]]), 20)).toHaveLength(0);
  expect(await checkAlerts(db, new Map([["USD", 171000]]), 30)).toHaveLength(0);
  expect(rows[0]?.armed).toBe(1);
  expect(await checkAlerts(db, new Map([["USD", 170000]]), 40)).toHaveLength(1);
  expect(rows[0]?.armed).toBe(0);
});

test("percent move does not fire on the first sample", async () => {
  const once = memoryDb([alert({ id: 8, direction: "move_pct", threshold: 2 })]);
  expect(await checkAlerts(once.db, new Map([["USD", 100000]]), 10)).toHaveLength(0);
  expect(once.rows[0]?.last_price).toBe(100000);
  expect(await checkAlerts(once.db, new Map([["USD", 101000]]), 20)).toHaveLength(0);
  const hit = await checkAlerts(once.db, new Map([["USD", 103000]]), 30);
  expect(hit.map((row) => row.id)).toEqual([8]);
  expect(once.rows).toHaveLength(0);

  const repeat = memoryDb([
    alert({ id: 9, direction: "move_pct", threshold: 2, mode: "repeat" }),
  ]);
  expect(await checkAlerts(repeat.db, new Map([["USD", 100000]]), 10)).toHaveLength(0);
  expect(await checkAlerts(repeat.db, new Map([["USD", 103000]]), 20)).toHaveLength(1);
  expect(repeat.rows[0]?.armed).toBe(1);
  expect(repeat.rows[0]?.last_price).toBe(103000);
  expect(await checkAlerts(repeat.db, new Map([["USD", 104000]]), 30)).toHaveLength(0);
  expect(await checkAlerts(repeat.db, new Map([["USD", 106000]]), 40)).toHaveLength(1);
});
