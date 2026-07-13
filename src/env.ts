export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JOBS: Queue<JobMessage>;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL_ID: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  CHANNEL_USERNAME: string;
  BOT_USERNAME: string;
  PRICE_UNIT: string;
  /** Public origin for embeddable chart PNGs in rich messages */
  PUBLIC_BASE_URL?: string;
}

export type JobType =
  | "scrape_and_cast"
  | "cast_15m"
  | "cast_6h"
  | "cast_daily";

export interface JobMessage {
  type: JobType;
  /** unix ms when enqueued */
  at: number;
  force?: boolean;
}
