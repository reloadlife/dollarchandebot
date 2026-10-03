---
name: dollarchande-rates
description: Read Iranian free-market FX, gold, coin, and USDT prices in toman from the DollarChande API. Use when the user asks for the dollar, euro, tether, gold, or coin rate in Iran, or when a shop price needs the DollarChande rate.
---

# DollarChande rates

Prices are the Iranian free market in toman. They are not the central-bank rate and not financial advice. Do not invent a number if the request fails.

## Call

Base: `https://api.dollarchande.live`

The user gets a key once by sending `/key` in a private chat with https://t.me/DollarChandeBot. Send it on every request:

```
curl -H "Authorization: Bearer KEY" \
  https://api.dollarchande.live/api/v1/symbols/USD
```

`X-Api-Key: KEY` is the same thing. A missing key is 401 `missing_api_key`. An unknown key is 401 `invalid_api_key`. About 60 requests per minute; then 429 `rate_limited` and `retry-after: 60`. Only GET. Responses cache for about 60 seconds.

`GET /chart/USD.png` needs no key. Add `?r=7d` for seven days.

## MCP

POST `https://api.dollarchande.live/mcp` with the same key and `Accept: application/json`. Protocol `2025-03-26`. Stateless. Tools: `list_symbols`, `get_quote`, `get_latest`, `get_ticks`, `get_ohlc`, `get_exchanges`. The minute ceiling is shared with the REST API. Do not invent a price when the call fails. Disclaimer: https://dollarchande.live/disclaimer/

## Routes

- `GET /api/v1/latest` — `{ unit, count, quotes }`
- `GET /api/v1/symbols` — ids and names, no prices
- `GET /api/v1/symbols/{ID}` — one quote
- `GET /api/v1/symbols/{ID}/ticks` — 24h `{ ts, price }`
- `GET /api/v1/symbols/{ID}/ohlc?days=30` — daily candles, `days` clamped to 1..90
- `GET /api/v1/exchanges` — USDT venues. `buy` is toman to buy 1 USDT. `sell` is toman received for 1 USDT.

Quote fields: `price`, `prev_price`, `buy`, `sell`, `unit`, `updated_at` (unix), plus `id`, `name`, `label_fa`, `kind`, `source`. `unit` is always the string `toman`. `price` may be null.

## Ids

FX: USD EUR GBP CHF CAD AUD TRY AED CNY JPY SEK NOK DKK RUB THB SGD HKD AZN AMD SAR INR MYR AFN KWD IQD BHD OMR QAR.

JPY means 10 yen. AMD means 10 dram. IQD means 100 dinar.

Gold: MITHQAL, GOLD18 (18k gram), GOLD24 (24k gram), OUNCE. OUNCE is named "Gold Ounce (USD)". Do not read it as an 18k toman gram. `unit` is still the string `toman`.

Silver: SILVER (999 gram, toman), XAG (ounce, USD). Platinum: XPT (ounce, USD). XAG and XPT are dollars, same as OUNCE, while `unit` stays `toman`. SILVER is on the channel board and the bot home. XAG and XPT are not.

Coins: EMAMI, AZADI, HALF (alias nim), QUARTER (alias rob), GERAMI.

Crypto: USDT. Aliases such as `tether`, `gold`, and `nim` resolve. The canonical id in the JSON is `HALF`, not `NIM`.

Full reference: https://dollarchande.live/llms-full.txt
