import type { Env, JobMessage } from "./env";
import { handleJob, runScrapeAndCast } from "./jobs";
import { handleUpdate } from "./telegram/bot";
import type { TgUpdate } from "./telegram/api";
import { setWebhook } from "./telegram/api";
import { getAllLatest } from "./db/prices";
import { buildPriceListHtml } from "./cast/messages";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Telegram webhook
    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const hdr = request.headers.get("x-telegram-bot-api-secret-token");
        if (hdr !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response("unauthorized", { status: 401 });
        }
      }
      const update = (await request.json()) as TgUpdate;
      ctx.waitUntil(
        handleUpdate(env, update).catch((e) => console.error("bot error", e)),
      );
      return new Response("ok");
    }

    // Ops helpers (protect with secret header in prod if exposed)
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "dollarchande" });
    }

    if (url.pathname === "/admin/setup-webhook" && request.method === "POST") {
      const secret = request.headers.get("x-admin-secret");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      const hook = `${url.origin}/telegram/webhook`;
      await setWebhook(env, hook, env.TELEGRAM_WEBHOOK_SECRET);
      return Response.json({ ok: true, webhook: hook });
    }

    if (url.pathname === "/admin/run" && request.method === "POST") {
      const secret = request.headers.get("x-admin-secret");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      const type = url.searchParams.get("type") ?? "scrape_and_cast";
      await env.JOBS.send({ type: type as JobMessage["type"], at: Date.now(), force: true });
      return Response.json({ ok: true, enqueued: type });
    }

    if (url.pathname === "/preview/list") {
      const html = await buildPriceListHtml(env);
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/latest") {
      const rows = await getAllLatest(env.DB);
      return Response.json({ count: rows.length, rows });
    }

    return new Response(
      [
        "DollarChande Worker",
        "GET  /health",
        "GET  /api/latest",
        "GET  /preview/list",
        "POST /telegram/webhook",
        "POST /admin/setup-webhook  (x-admin-secret)",
        "POST /admin/run?type=scrape_and_cast  (x-admin-secret)",
      ].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  },

  /** Cron: every 15 minutes → enqueue scrape+cast (cheap, retries via queue). */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      env.JOBS.send({ type: "scrape_and_cast", at: Date.now() }).catch(async (e) => {
        // local dev without queue binding: run inline
        console.error("queue send failed, inline", e);
        await runScrapeAndCast(env);
      }),
    );
  },

  /** Queue consumer */
  async queue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        const result = await handleJob(env, msg.body);
        console.log("job ok", msg.body.type, result);
        msg.ack();
      } catch (e) {
        console.error("job fail", msg.body.type, e);
        msg.retry();
      }
    }
  },
};
