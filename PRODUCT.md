# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: the rates API stays on the existing Cloudflare Worker. The public site is a static Next.js export on Cloudflare Pages. Shop integrations are ordinary PHP plugins.

## Users

Iranian shop owners who price goods against the free-market dollar. They run WordPress, WooCommerce, or WHMCS and need shelf prices to follow the rate without typing it in by hand. A second audience is developers who read the public API.

## Product Purpose

DollarChande publishes free-market toman rates for FX, gold, coins, and tether. Success is a shop whose prices move when the dollar moves, using the same number the Telegram channel already shows.

## Positioning

One public rate, no key, reused by the channel, the bot, the website, and installable shop plugins. A neighboring price site that only shows a number cannot update a WooCommerce catalog or a WHMCS currency.

## Operating Context

Rates are scraped about every five minutes into D1 and served at `/api/v1`. The unit is toman. Shops that store rial multiply by ten. The Telegram channel is @AlanDollarChande and the bot is @DollarChandeBot.

## Capabilities and Constraints

Confirmed: public read API, static marketing site, WordPress shortcode, WooCommerce catalog update, WHMCS currency-rate update. All three plugins are free. Undecided: paid API keys, accounts, and usage quotas.

## Brand Commitments

Name: دلارچنده / DollarChande. Voice: plain Persian, prices in toman, no hype. The user asked for a stunning landing page and named vibefarsi as the component source. The previous graphite page was rejected as pale.

## Evidence on Hand

Live quotes from `GET /api/v1/latest`. Chart PNGs at `/chart/{ID}.png`. No customer logos, testimonials, or download counts. Do not invent them.

## Product Principles

- The number on the site is the number in the shop.
- Free means no account and no key for reading rates.
- Plugins do one job: fetch the rate and write the price.
- Persian first. Latin only for code, symbols, and endpoints.
