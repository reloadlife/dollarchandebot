import type { Metadata } from "next";
import Link from "next/link";
import { PageWash } from "@/components/page-wash";
import { GirihBackground } from "@/components/vibefarsi/girih";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "حریم خصوصی · دلارچنده",
  description: "خواندن نرخ حساب نمی‌خواهد. هشدار شناسه گفتگوی تلگرام را نگه می‌دارد. کلید API فقط به‌صورت درهم ذخیره می‌شود.",
  path: "/privacy/",
});

const facts = [
  ["حسابی نیست", "خواندن نرخ در سایت و در ربات حساب، ایمیل یا رمز نمی‌خواهد. متن گفتگو را به‌صورت آرشیو نگه نمی‌داریم. پیام فقط برای جواب همان دستور خوانده می‌شود."],
  ["هشدار", "با /alert شناسه گفتگوی تلگرام، نماد، جهت، آستانه، حالت یک‌بار یا تکراری، و آخرین قیمت دیده‌شده ذخیره می‌شود. /unalert همان ردیف را پاک می‌کند."],
  ["کلید", "کلید را ربات یک بار نشان می‌دهد. در پایگاه فقط درهم SHA-256 آن، به همراه همان شناسه گفتگو، می‌ماند. خود کلید ذخیره نمی‌شود."],
  ["تنظیم و گروه", "زبان و کارمزد پیش‌فرض با شناسه گفتگو می‌ماند. اگر مدیر گروه /every بگذارد، شناسه گروه، فاصله و در صورت نیاز یک نماد ذخیره می‌شود."],
  ["فروشگاه", "کاتالوگ ووکامرس و ارزهای WHMCS روی سرور خودت می‌مانند. افزونه فقط نرخ را می‌گیرد و قیمت را همان‌جا می‌نویسد."],
  ["شمارش", "شروع ربات، ثبت هشدار، روشن شدن پیام گروه، و دانلود هر افزونه هر روز یک عدد جمع می‌شوند. شناسه گفتگو یا نشانی کسی در این شمارش نیست."],
] as const;

export default function PrivacyPage() {
  return (
    <main>
      <section className="totem-scene relative overflow-hidden">
        <PageWash />
        <GirihBackground className="opacity-30" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-12 lg:py-16">
          <p className="text-sm font-medium text-foreground/70">حریم خصوصی</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.35]">چه چیزی نگه داشته می‌شود.</h1>
          <p className="mt-4 max-w-[46ch] leading-8 text-foreground/75">
            دلارچنده نرخ بازار آزاد را منتشر می‌کند. این صفحه فقط همان چیزی است که برنامه واقعاً ذخیره می‌کند.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <ul className="grid gap-3">
          {facts.map(([title, body]) => (
            <li key={title} className="rounded-[16px] border border-border bg-card px-5 py-5">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 leading-8 text-foreground/75">{body}</p>
            </li>
          ))}
        </ul>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">ربات و گروه</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            پست گروه بی‌صدا است. کانال هر دور یک فهرست عمومی و بی‌صدا می‌فرستد. آن پست آرشیو خصوصی کسی نیست.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">درخواست از سایت</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            نمایش نرخ در dollarchande.live کلید کاربر نمی‌سازد و آن را ذخیره نمی‌کند. سقف خواندن تابلو با نشانی اتصال اعمال می‌شود و آن نشانی در جدول‌های ما نوشته نمی‌شود. برنامه‌ها، افزونه‌ها و MCP کلید می‌فرستند. استدلال ابزار MCP ذخیره نمی‌شود. سقف هر کلید حدود ۶۰ درخواست در دقیقه است و بین API و MCP مشترک است. سایت کوکی ردیابی نمی‌نویسد و ابزار تحلیل شخص ثالث نمی‌گذارد.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">میزبانی</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            سایت روی Cloudflare Pages است و API روی Cloudflare Workers. اتصال از شبکه Cloudflare می‌گذرد و گزارش میزبانی پیش آن‌هاست. ما برای این سرویس حساب کاربری نمی‌سازیم و فهرست کالاها را دریافت نمی‌کنیم.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/terms/" className="font-semibold text-brand">
              شرایط استفاده
            </Link>
            <Link href="/disclaimer/" className="ms-4 font-semibold text-brand">
              سلب مسئولیت
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
