import type { Env, JobMessage } from "./env";
import { handleJob, runScrapeAndCast } from "./jobs";
import { handleUpdate } from "./telegram/bot";
import type { TgUpdate } from "./telegram/api";
import { setWebhook } from "./telegram/api";
import { setupBotMenu } from "./telegram/commands";
import { getAllLatest } from "./db/prices";
import { buildPriceListHtml } from "./cast/messages";
import { handleChartRequest } from "./chart/serve";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Public chart PNGs for rich-message <img> embeds
    const chartRes = await handleChartRequest(request, env);
    if (chartRes) return chartRes;

    // Telegram webhook
    // Note: do NOT hard-fail on secret mismatch — a bad setWebhook without secret_token
    // previously 401'd every update and killed the bot. Log only; admin routes stay protected.
    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const hdr = request.headers.get("x-telegram-bot-api-secret-token");
        if (hdr && hdr !== env.TELEGRAM_WEBHOOK_SECRET) {
          console.error("webhook secret mismatch (still processing)", {
            hasHdr: Boolean(hdr),
            hdrLen: hdr?.length ?? 0,
          });
        }
      }
      let update: TgUpdate;
      try {
        update = (await request.json()) as TgUpdate;
      } catch (e) {
        console.error("webhook bad json", e);
        return new Response("bad json", { status: 400 });
      }
      // Await handling so Telegram retries on failure (waitUntil alone can hide errors).
      try {
        await handleUpdate(env, update);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("bot error", msg, e);
        return new Response(`handler error: ${msg}`, { status: 500 });
      }
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
      const menu = await setupBotMenu(env);
      return Response.json({ ok: true, webhook: hook, menu });
    }

    // Register / menu commands + bot description for all locales
    if (url.pathname === "/admin/setup-menu" && request.method === "POST") {
      const secret = request.headers.get("x-admin-secret");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      const menu = await setupBotMenu(env);
      return Response.json(menu);
    }

    // Debug calculator: GET /admin/calc?q=10.5+USDT+%2B+10%
    if (url.pathname === "/admin/calc" && request.method === "GET") {
      const secret = request.headers.get("x-admin-secret");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      const q = url.searchParams.get("q") ?? "";
      const { parseCalc, evaluateCalc, looksLikeCalc } = await import("./lib/calc");
      const { getLatest } = await import("./db/prices");
      const looks = looksLikeCalc(q);
      const parsed = parseCalc(q);
      if (!parsed.ok) {
        return Response.json({ looks, parsed });
      }
      const evaluated = await evaluateCalc(parsed, async (id) => {
        const row = await getLatest(env.DB, id);
        return row?.price ?? null;
      }, "IRT");
      return Response.json({ looks, parsed, evaluated });
    }

    // Force a /start-style reply to a chat (debug)
    if (url.pathname === "/admin/test-bot" && request.method === "POST") {
      const secret = request.headers.get("x-admin-secret");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      const chatId = url.searchParams.get("chat_id") ?? env.TELEGRAM_CHANNEL_ID;
      try {
        await handleUpdate(env, {
          update_id: 0,
          message: {
            message_id: 0,
            date: Math.floor(Date.now() / 1000),
            chat: { id: Number(chatId) || (chatId as unknown as number), type: "private" },
            text: "/start",
            from: { id: 0 },
          },
        });
        return Response.json({ ok: true, chatId, sent: "/start" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json({ ok: false, error: msg }, { status: 500 });
      }
    }

    if (url.pathname === "/admin/run" && request.method === "POST") {
      const secret = request.headers.get("x-admin-secret");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      const type = (url.searchParams.get("type") ?? "scrape_and_cast") as JobMessage["type"];
      const sync = url.searchParams.get("sync") === "1";
      const force = url.searchParams.get("force") === "1";
      if (sync) {
        try {
          const result = await handleJob(env, { type, at: Date.now(), force });
          return Response.json({ ok: true, sync: true, result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("admin sync run failed", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      }
      try {
        await env.JOBS.send({ type, at: Date.now(), force });
        return Response.json({ ok: true, enqueued: type });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json({ ok: false, error: msg }, { status: 500 });
      }
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

  /**
   * Cron: every 5 minutes → enqueue scrape.
   * List cast is due every ~10m (see jobs.ts last-cast KV), not wall-clock % 15
   * (Cloudflare cron often fires 1–3m late, which skipped every list post).
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const at = typeof event.scheduledTime === "number" ? event.scheduledTime : Date.now();
    ctx.waitUntil(
      env.JOBS.send({ type: "scrape_and_cast", at }).catch(async (e) => {
        // local dev without queue binding: run inline
        console.error("queue send failed, inline", e);
        await runScrapeAndCast(env, false, at);
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
