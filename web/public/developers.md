# API · دلارچنده

> قیمت‌ها تومان‌اند. پاسخ حدود یک دقیقه می‌ماند. هر کلید حدود ۶۰ درخواست در دقیقه دارد. Prices are toman. Not financial advice.

هر کلاینت، از جمله هر سه افزونه، کلید ربات را در `Authorization: Bearer` یا `X-Api-Key` می‌فرستد. بدون کلید پاسخ 401 است.

1. در ربات https://t.me/DollarChandeBot دستور `/key` را بفرست.
2. کلید یک بار نشان داده می‌شود. در پایگاه فقط درهم SHA-256 آن می‌ماند.
3. همان رشته را در درخواست بگذار.

آدرس: `https://api.dollarchande.live`

```
curl -H "Authorization: Bearer KEY" \
  https://api.dollarchande.live/api/v1/symbols/USD
```

## Routes

- `GET /api/v1/latest` — آخرین قیمت همه نمادها
- `GET /api/v1/symbols` — فهرست نمادها
- `GET /api/v1/symbols/{ID}` — یک نماد، مثل USD
- `GET /api/v1/symbols/{ID}/ticks` — تیک‌های ۲۴ ساعت
- `GET /api/v1/symbols/{ID}/ohlc?days=30` — کندل روزانه. days بین ۱ و ۹۰ می‌ماند
- `GET /api/v1/exchanges` — خرید و فروش تتر در صرافی‌ها، به تومان
- `GET /chart/{ID}.png` — نمودار ۲۴ ساعت. برای ۷ روز `?r=7d`. این مسیر کلید نمی‌خواهد

## Response

- `price` — آخرین قیمت، تومان
- `prev_price` — قیمت قبلی
- `buy` — سوی خرید، تومان
- `sell` — سوی فروش، تومان
- `unit` — همیشه `toman`
- `updated_at` — زمان یونیکس

JPY ده ین است، AMD ده درام، IQD صد دینار. شناسه نیم‌سکه HALF است و `nim` هم به آن می‌رسد. OUNCE اونس طلاست و گرم ۱۸ عیار نیست.

## MCP

POST https://api.dollarchande.live/mcp

کلید همان کلید ربات است. پروتکل Streamable HTTP، نسخه 2025-03-26، بدون نشست. ابزارها: list_symbols، get_quote، get_latest، get_ticks، get_ohlc، get_exchanges. سقف با API مشترک است.

سلب مسئولیت: https://dollarchande.live/disclaimer/

مرجع کامل: https://dollarchande.live/llms-full.txt
صفحه: https://dollarchande.live/developers/
