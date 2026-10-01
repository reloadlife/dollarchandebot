DollarChande for WHMCS
=======================

Puts the free-market rate into one currency. The Telegram bot issues the API key (/key).

Install
-------

1. Copy `modules/addons/dollarchande` into the WHMCS `modules/addons` directory.
2. Configuration, Addon Modules. Activate DollarChande.
3. Set API base, the bot API key, symbol, currency id, and multiplier.
4. Open the addon and press Update now.

The currency id is `tblcurrencies.id` for the client currency (toman or rial).
Leave the default currency alone. Its rate stays 1.

Multiplier is 1 when that currency is toman, and 10 when it is rial.
If products are priced in USD and clients pay in toman, point this addon at the toman currency.

WHMCS stores rates in a small decimal column. Activation widens `tblcurrencies.rate` to DECIMAL(18,8) so a toman-per-dollar rate fits. Deactivation does not shrink it and does not drop `mod_dollarchande`.

The WHMCS system cron must be running. The addon writes about once an hour from AfterCronJob.
