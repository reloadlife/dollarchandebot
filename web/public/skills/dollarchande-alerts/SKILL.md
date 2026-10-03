---
name: dollarchande-alerts
description: Create, list, and delete DollarChande Telegram price alerts with the /alert command. Use when the user wants a message if the dollar, gold, tether, or another DollarChande symbol crosses a line or moves by a percent.
---

# DollarChande alerts

Alerts live in the bot https://t.me/DollarChandeBot. At most ten per chat. They fire only when a price exists and the condition holds. A missed move is possible. The numbers below are syntax, not live prices.

`/alert` stores the Telegram chat id, the symbol, the direction, the threshold, and whether it is once or repeating. `/unalert` deletes that row.

## Commands

- `/alert USD above 180000` — once, then deleted after the message
- `/alert USD below 170000` — once, at or below the line
- `/alert USD above 180000 every` — repeats. After it fires it stays quiet until the price crosses back, then arms again
- `/alert USD below 170000 every` — the same, for below
- `/alert USD move 2` — once, on a 2 percent move. The first sample only sets a baseline and does not notify
- `/alert USD move 2 every` — every 2 percent move from the last alert
- `/alerts` — this chat's alerts
- `/unalert 3` — delete alert 3. The number comes from `/alerts`

Replace USD with a real symbol id: USD, EUR, USDT, GOLD18, EMAMI, AZADI, HALF, and the others in https://dollarchande.live/llms-full.txt. `nim` means HALF.

The channel https://t.me/AlanDollarChande posts a silent price list on each update. Its دلار button opens the bot on that price. The next buttons are «وقتی از این قیمت گذشت خبر بده» (one unit above the printed price, then once or every) and «بفرست به گروه» (inline). «هر ساعت در گروه» adds the bot to a group and starts a silent hourly post for that symbol, the same as `/every 1h USD`. The channel itself does not notify, and it is not the alert.

A page such as https://dollarchande.live/usd/ shows the same price and the chart image.
