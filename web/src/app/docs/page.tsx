import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "@/components/copy-block";
import { Rise } from "@/components/rise";
import { GirihBackground } from "@/components/vibefarsi/girih";
import { ShineButton } from "@/components/vibefarsi/shine-button";
import { BOT_URL } from "@/lib/rates";
import { fa } from "@/lib/utils";

export const metadata: Metadata = {
  title: "راهنما · دلارچنده",
  description: "نصب افزونه وردپرس، ووکامرس و WHMCS، و هشدار تلگرام. هر سه افزونه کلید ربات می‌خواهند.",
};

const toc = [
  ["#key", "کلید"],
  ["#wordpress", "وردپرس"],
  ["#woocommerce", "ووکامرس"],
  ["#whmcs", "WHMCS"],
  ["#telegram", "هشدار"],
] as const;

const wpSteps = [
  "فایل فشرده را از پیشخوان بارگذاری کن، یا پوشه dollarchande را در wp-content/plugins بگذار.",
  "افزونه را فعال کن.",
  "از تنظیمات، دلارچنده، کلید را بگذار. کلید را با /key از ربات بگیر.",
  "شورت‌کد را در برگه یا نوشته بگذار.",
] as const;

const wooSteps = [
  "ووکامرس باید نصب باشد. فایل فشرده را بارگذاری کن و افزونه را فعال کن.",
  "از ووکامرس، دلارچنده، کلید ربات و نماد را ذخیره کن.",
  "اگر قیمت فروشگاه تومان است ضریب را ۱ بگذار. اگر ریال است ضریب را ۱۰ بگذار.",
  "در ویرایش کالا «به‌روزرسانی با دلارچنده» را روشن کن و قیمت پایه را بنویس.",
] as const;

const whmcsSteps = [
  "پوشه dollarchande را در modules/addons بگذار.",
  "از Configuration، Addon Modules، دلارچنده را فعال کن.",
  "کلید ربات، نماد، شناسه ارز و ضریب را بنویس. شناسه، tblcurrencies.id ارز تومان یا ریال است.",
  "ارز پیش‌فرض را انتخاب نکن. نرخ آن باید ۱ بماند. کران WHMCS باید روشن باشد.",
] as const;

const alertRows = [
  ["/alert USD above 180000", "یک‌بار. وقتی قیمت به آستانه برسد پیام می‌آید و هشدار حذف می‌شود."],
  ["/alert USD below 170000", "یک‌بار، وقتی قیمت به آستانه یا پایین‌تر برسد."],
  ["/alert USD above 180000 every", "تکراری. بعد از اعلان خاموش می‌ماند تا قیمت از آستانه برگردد، بعد دوباره مسلح می‌شود."],
  ["/alert USD below 170000 every", "همان تکرار، برای پایین‌تر از آستانه."],
  ["/alert USD move 2", "یک‌بار، حرکت دو درصد. نمونه اول فقط مبنا می‌شود و اعلان نمی‌دهد."],
  ["/alert USD move 2 every", "هر بار که قیمت از آخرین اعلان دو درصد جابه‌جا شود."],
  ["/alerts", "فهرست هشدارهای همین گفتگو."],
  ["/unalert 3", "حذف هشدار شماره ۳. شماره را از /alerts بردار."],
] as const;

function Steps({ items }: { items: readonly string[] }) {
  return (
    <ol className="mt-5 space-y-3 text-sm leading-7">
      {items.map((step, index) => (
        <li key={step} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
            {fa(index + 1)}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default function DocsPage() {
  return (
    <main>
      <section className="totem-scene relative overflow-hidden">
        <GirihBackground className="opacity-30" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 lg:py-16">
          <p className="text-sm font-medium text-foreground/70">راهنما · نصب</p>
          <h1 className="mt-3 max-w-[16ch] text-balance text-4xl font-semibold leading-[1.35]">
            افزونه را بگذار. نرخ را خودش بنویسد.
          </h1>
          <p className="mt-4 max-w-[46ch] leading-8 text-foreground/75">
            هر سه افزونه رایگان‌اند و یک کار می‌کنند. بدون کلید ربات، API به آن‌ها ۴۰۱ می‌دهد. خواندن تابلو در سایت حساب نمی‌خواهد.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {toc.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="inline-flex h-11 items-center rounded-[16px] border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="mt-6">
            <ShineButton href={BOT_URL}>گرفتن کلید از ربات</ShineButton>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12 lg:py-16">
        <Rise>
          <section id="key" className="scroll-mt-20">
            <p className="text-sm font-semibold text-brand">کلید</p>
            <h2 className="mt-2 text-2xl font-semibold">ربات کلید را یک بار نشان می‌دهد.</h2>
            <p className="mt-3 leading-8 text-foreground/75">
              در گفتگوی خصوصی /key را بفرست. همان رشته را در تنظیمات افزونه بگذار. سایت خودش، وقتی از dollarchande.live باز شود، برای خواندن تابلو کلید نمی‌فرستد. افزونه، و هر برنامه دیگری، باید بفرستد.
            </p>
          </section>
        </Rise>

        <Rise>
          <section id="wordpress" className="scroll-mt-20 mt-14 border-t border-border pt-14">
            <p className="text-sm font-semibold text-brand">وردپرس</p>
            <h2 className="mt-2 text-2xl font-semibold">یک نماد، داخل برگه.</h2>
            <p className="mt-3 leading-8 text-foreground/75">
              شورت‌کد نرخ تومان را نشان می‌دهد. اگر نرخ نرسد یا خارج از بازه منطقی باشد، همان جمله «نرخ الان نرسید.» می‌آید و عدد قبلی را عوض نمی‌کند.
            </p>
            <Steps items={wpSteps} />
            <div className="mt-5">
              <CopyBlock text='[dollarchande symbol="USD"]' label="کپی شورت‌کد" caption="شورت‌کد" />
            </div>
            <p className="mt-4 text-sm leading-7 text-foreground/75">
              در قالب می‌توانی <span className="font-mono" dir="ltr">dollarchande_rate('USD')</span> را صدا بزنی. اگر نرخ نرسد، null برمی‌گردد.
            </p>
            <a href="/downloads/dollarchande-wordpress.zip" className="mt-4 inline-flex text-sm font-semibold text-brand">
              دریافت وردپرس
            </a>
          </section>
        </Rise>

        <Rise>
          <section id="woocommerce" className="scroll-mt-20 mt-14 border-t border-border pt-14">
            <p className="text-sm font-semibold text-brand">ووکامرس</p>
            <h2 className="mt-2 text-2xl font-semibold">قیمت قفسه از پایه و نرخ.</h2>
            <p className="mt-3 leading-8 text-foreground/75">
              قیمت فروشگاه برابر است با پایه ضربدر نرخ ضربدر ضریب، گردشده به گام. قیمت حراج دست نمی‌خورد. کالای متغیر را روی هر متغیر جدا روشن کن. اگر نرخ منطقی نباشد، قیمت ذخیره‌شده همان می‌ماند.
            </p>
            <div className="totem-well mt-5 rounded-[16px] px-4 py-5">
              <p className="text-xs text-[oklch(0.84_0.05_85)]">حساب قیمت</p>
              <p className="mt-2 text-lg font-medium text-[oklch(0.92_0.16_88)]">پایه × نرخ × ضریب</p>
              <p className="mt-2 text-sm text-[oklch(0.84_0.05_85)]">برای ریال، ضریب ۱۰ است. برای تومان، ضریب ۱ است.</p>
            </div>
            <Steps items={wooSteps} />
            <p className="mt-4 text-sm leading-7 text-foreground/75">
              هر ساعت یک دور اجرا می‌شود. دکمه «همگام‌سازی الان» همان کار را همان لحظه می‌کند. گام ۱۰۰۰ یعنی قیمت به هزار گرد می‌شود.
            </p>
            <a href="/downloads/dollarchande-woocommerce.zip" className="mt-4 inline-flex text-sm font-semibold text-brand">
              دریافت ووکامرس
            </a>
          </section>
        </Rise>

        <Rise>
          <section id="whmcs" className="scroll-mt-20 mt-14 border-t border-border pt-14">
            <p className="text-sm font-semibold text-brand">WHMCS</p>
            <h2 className="mt-2 text-2xl font-semibold">نرخ یک ارز، از همین تومان.</h2>
            <p className="mt-3 leading-8 text-foreground/75">
              افزونه زیر <span className="font-mono" dir="ltr">modules/addons/dollarchande</span> می‌نشیند. نرخ همان ارز را از قیمت تومان و ضریب می‌نویسد. اگر نرخ خارج از بازه باشد، ستون rate عوض نمی‌شود.
            </p>
            <Steps items={whmcsSteps} />
            <p className="mt-4 text-sm leading-7 text-foreground/75">
              فعال‌سازی ستون rate را به DECIMAL(18,8) پهن می‌کند تا نرخ تومان جا شود. خاموش کردن جدول و نرخ را پاک نمی‌کند. کران سیستم حدود هر ساعت یک بار می‌نویسد. از خود افزونه هم می‌توانی «Update now» را بزنی.
            </p>
            <a href="/downloads/dollarchande-whmcs.zip" className="mt-4 inline-flex text-sm font-semibold text-brand">
              دریافت WHMCS
            </a>
          </section>
        </Rise>

        <Rise>
          <section id="telegram" className="scroll-mt-20 mt-14 border-t border-border pt-14">
            <p className="text-sm font-semibold text-brand">تلگرام</p>
            <h2 className="mt-2 text-2xl font-semibold">هشدار را خودت می‌گذاری.</h2>
            <p className="mt-3 leading-8 text-foreground/75">
              در ربات /alert هشدار می‌سازد و /unalert حذف می‌کند. حداکثر ده هشدار برای هر گفتگو. وقتی شرط برقرار شود، همان گفتگو یک پیام می‌خواند. یک‌بار، بعد از اعلان پاک می‌شود. تکراریِ بالا یا پایین، تا برگشت قیمت دوباره اعلان نمی‌دهد. حرکت درصدی روی اولین نمونه اعلان نمی‌دهد.
            </p>
            <ul className="mt-5 overflow-hidden rounded-[16px] border border-border bg-card">
              {alertRows.map(([command, note], index) => (
                <li key={command} className={index === 0 ? "px-4 py-4" : "border-t border-border px-4 py-4"}>
                  <p className="font-mono text-sm" dir="ltr">
                    {command}
                  </p>
                  <p className="mt-1 text-sm leading-7 text-foreground/75">{note}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-7 text-foreground/75">
              کانال یک فهرست قیمت سنجاق‌شده و بی‌صدا دارد. هر دور، همان پست ویرایش می‌شود. پیام تازه‌ای برای هر به‌روزرسانی نمی‌آید.
            </p>
            <p className="mt-4 text-sm leading-7 text-foreground/75">
              این نرخ‌ها بازار آزاد به تومان‌اند و توصیه خرید یا فروش نیستند.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ShineButton href={BOT_URL}>باز کردن ربات</ShineButton>
              <Link
                href="/developers/"
                className="inline-flex h-11 items-center rounded-[16px] border border-border bg-card px-4 text-sm font-semibold"
              >
                راهنمای API
              </Link>
            </div>
          </section>
        </Rise>
      </div>
    </main>
  );
}
