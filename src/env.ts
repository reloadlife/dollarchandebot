export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JOBS: Queue<JobMessage>;
  /** Per API key, enforced at the Cloudflare edge. */
  API_RATE_LIMIT: RateLimiter;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL_ID: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  CHANNEL_USERNAME: string;
  BOT_USERNAME: string;
  PRICE_UNIT: string;
  /** Public origin for embeddable chart PNGs in rich messages */
  PUBLIC_BASE_URL?: string;
  /** Optional egress proxy for venues that refuse Cloudflare IPs (see proxy/) */
  PROXY_URL?: string;
  PROXY_SECRET?: string;
}

export type JobType =
  | "scrape_and_cast"
  | "cast_15m"
  | "cast_6h"
  | "cast_daily"
  | "probe";

export interface JobMessage {
  type: JobType;
  /** unix ms when enqueued */
  at: number;
  force?: boolean;
}
