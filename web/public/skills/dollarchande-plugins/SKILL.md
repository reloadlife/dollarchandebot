---
name: dollarchande-plugins
description: Install the free DollarChande WordPress, WooCommerce, or WHMCS plugin so a shop price follows the Iranian free-market toman rate. Use when the user wants the dollar rate written into a product price, a shortcode, or a WHMCS currency.
---

# DollarChande plugins

Three free plugins. Each one needs a key from https://t.me/DollarChandeBot command `/key`. Without the key the API returns 401 and the plugin does nothing. The shop catalog stays on the merchant's server.

Prices are free-market toman, not a buy or sell recommendation. The price on the shelf belongs to the shop. The plugin multiplies base × rate × factor.

## WordPress

Zip: https://api.dollarchande.live/dl/wordpress

1. Upload the zip, or place the `dollarchande` folder in `wp-content/plugins`. Activate it.
2. Settings → دلارچنده: paste the key.
3. Shortcode `[dollarchande symbol="USD"]`.
4. Themes may call `dollarchande_rate('USD')`. It returns null when the rate did not arrive.
5. A missing or out-of-range rate shows «نرخ الان نرسید.» and does not replace the previous number.

## WooCommerce

Zip: https://api.dollarchande.live/dl/woocommerce

WooCommerce must already be installed. Shelf price = base × rate × factor, rounded to the step. Factor is 1 for toman and 10 for rial. A step of 1000 rounds to the nearest thousand.

1. Upload, activate, then WooCommerce → دلارچنده: save the key and the symbol.
2. On the product, turn on «به‌روزرسانی با دلارچنده» and enter the base in dollars.
3. Sale prices are not touched. Enable each variation on its own.
4. The cron runs about once an hour. «همگام‌سازی الان» runs it now.
5. An unsound rate leaves the stored price unchanged.

## WHMCS

Zip: https://api.dollarchande.live/dl/whmcs

1. Place the folder at `modules/addons/dollarchande`.
2. Configuration → Addon Modules: activate دلارچنده.
3. Set the key, symbol, currency id (`tblcurrencies.id` of the toman or rial row), and factor.
4. Do not select the default currency. Its rate must stay 1. The system cron must be enabled.
5. Activation widens `rate` to DECIMAL(18,8). Deactivation does not drop the table or the rates.
6. The cron writes about hourly. «Update now» writes immediately.
7. An out-of-range rate does not change the `rate` column.

Install guide: https://dollarchande.live/docs/
