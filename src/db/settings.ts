export type Lang = "en" | "fa";

export interface UserSettings {
  chat_id: string;
  lang: Lang;
  fee_pct: number;
  updated_at: number;
}

const DEFAULTS: Omit<UserSettings, "chat_id" | "updated_at"> = {
  lang: "en",
  fee_pct: 0,
};

export async function getSettings(db: D1Database, chatId: string): Promise<UserSettings> {
  const row = await db
    .prepare(
      `SELECT chat_id, lang, fee_pct, updated_at FROM user_settings WHERE chat_id = ?`,
    )
    .bind(chatId)
    .first<UserSettings>();
  if (row) return row;
  return {
    chat_id: chatId,
    ...DEFAULTS,
    updated_at: 0,
  };
}

export async function setLang(db: D1Database, chatId: string, lang: Lang): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO user_settings (chat_id, lang, fee_pct, updated_at) VALUES (?, ?, 0, ?)
       ON CONFLICT(chat_id) DO UPDATE SET lang = excluded.lang, updated_at = excluded.updated_at`,
    )
    .bind(chatId, lang, now)
    .run();
}

export async function setFeePct(db: D1Database, chatId: string, feePct: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const fee = Math.max(0, Math.min(50, feePct));
  await db
    .prepare(
      `INSERT INTO user_settings (chat_id, lang, fee_pct, updated_at) VALUES (?, 'en', ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET fee_pct = excluded.fee_pct, updated_at = excluded.updated_at`,
    )
    .bind(chatId, fee, now)
    .run();
}
