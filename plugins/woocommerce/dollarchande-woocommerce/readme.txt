=== دلارچنده برای ووکامرس ===
Contributors: dollarchande
Tags: woocommerce, currency
Requires at least: 6.0
Tested up to: 6.8
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

قیمت دلار ووکامرس را با نرخ بازار آزاد تازه می‌کند.

== Description ==

روی هر کالا قیمت پایه را به دلار (یا نماد دیگر) می‌نویسید. افزونه قیمت تومان را این‌طور می‌سازد:

قیمت = گردشده (پایه × نرخ × ضریب)

ضریب ۱ برای فروشگاهی است که تومان ذخیره می‌کند. ضریب ۱۰ برای ریال است. قیمت حراج دست نمی‌خورد. کالای متغیر را روی هر متغیر جدا تنظیم کنید.

نرخ از https://api.dollarchande.live خوانده می‌شود. کلید را ربات تلگرام با دستور /key می‌دهد.

== Installation ==

1. ووکامرس باید نصب باشد.
2. فایل فشرده را از پیشخوان بارگذاری کنید و افزونه را فعال کنید.
3. از ووکامرس، دلارچنده، کلید ربات، نماد و ضریب را ذخیره کنید. کلید را با /key بگیرید.
4. در ویرایش کالا، «به‌روزرسانی با دلارچنده» را روشن کنید و قیمت پایه را بنویسید.

هر ساعت یک دور اجرا می‌شود. دکمه «همگام‌سازی الان» همان کار را همان لحظه می‌کند.

== External services ==

This plugin calls https://api.dollarchande.live to read one free-market rate.
Each request sends the API key saved in the plugin settings and the symbol name.
It does not send orders, customers, or the product catalog.
The service is run by DollarChande.
Terms: https://dollarchande.live/terms/
Privacy: https://dollarchande.live/privacy/

افزونه برای خواندن یک نرخ به api.dollarchande.live وصل می‌شود. کلید ذخیره‌شده و نام نماد را می‌فرستد. سفارش، مشتری، یا فهرست کالا را نمی‌فرستد.

== Changelog ==

= 1.0.0 =
نسخه اول. تنظیمات می‌گوید نرخ از کجا خوانده می‌شود.
