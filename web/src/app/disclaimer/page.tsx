import type { Metadata } from "next";
import Link from "next/link";
import { PageWash } from "@/components/page-wash";
import { GirihBackground } from "@/components/vibefarsi/girih";
import { pageMeta } from "@/lib/seo";
import { BOT_URL } from "@/lib/rates";

export const metadata: Metadata = pageMeta({
  title: "سلب مسئولیت · دلارچنده",
  description: "دلارچنده صرافی نیست و نرخ رسمی اعلام نمی‌کند. عددها بازار آزاد به تومان‌اند و ممکن است دیر یا غلط باشند.",
  path: "/disclaimer/",
});

const points = [
  ["صرافی نیست", "دلارچنده ارز، طلا، سکه یا رمزارز نمی‌خرد، نمی‌فروشد و نگه نمی‌دارد. حواله هم انجام نمی‌دهد. نمایش یک عدد، پیشنهاد معامله نیست."],
  ["نرخ رسمی نیست", "این عدد نرخ بانک مرکزی، نرخ نیما، نرخ صرافی ملی یا نرخ مرجع نیست. بازار آزاد به تومان است."],
  ["توصیه نیست", "این صفحه و این عدد توصیه خرید، فروش، سرمایه‌گذاری یا مالیات نیست. تصمیم و ریسک با کسی است که از عدد استفاده می‌کند."],
  ["ممکن است غلط باشد", "نرخ ممکن است دیر برسد، برای یک نماد خالی باشد، یا با تابلویی که جلویت است فرق داشته باشد. تعهد دقت یا تازگی نداریم."],
  ["منبع", "هر نرخ یک فیلد source دارد. مقدارش bonbast یا tetherland است، یعنی تابلویی که عدد از آن خوانده شده. آن سایت‌ها دلارچنده را اداره نمی‌کنند و این صفحه مجوز یا نمایندگی آن‌ها نیست. نام و علامت‌شان مال خودشان است."],
  ["قیمت فروشگاه", "قیمتی که روی قفسه، فاکتور یا برگه می‌گذاری مال فروشگاه است. افزونه فقط پایه را در نرخ و ضریب ضرب می‌کند."],
  ["هشدار", "پیام تلگرام وقتی می‌آید که قیمت رسیده باشد و شرط برقرار شود. تضمین نمی‌کنیم هر حرکت را ببینی. هشدار سیگنال معامله نیست."],
] as const;

export default function DisclaimerPage() {
  return (
    <main>
      <section className="totem-scene relative overflow-hidden">
        <PageWash />
        <GirihBackground className="opacity-30" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-12 lg:py-16">
          <p className="text-sm font-medium text-foreground/70">سلب مسئولیت</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.35]">عدد است، نه معامله.</h1>
          <p className="mt-4 max-w-[46ch] leading-8 text-foreground/75">
            این صفحه نظر یک وکیل نیست. شرح همان کاری است که سرویس می‌کند و همان کاری که نمی‌کند.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <ul className="grid gap-3">
          {points.map(([title, body]) => (
            <li key={title} className="rounded-[16px] border border-border bg-card px-5 py-5">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 leading-8 text-foreground/75">{body}</p>
            </li>
          ))}
        </ul>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">اگر باید قطع شود</h2>
          <p className="mt-3 leading-8 text-foreground/75">
            اگر صاحب یک تابلو، یا هر کس دیگری، خواست بازنشر یک نرخ قطع شود یا خطایی را اصلاح کند، در ربات بنویسد. تا وقتی سرویس روشن است، شرط‌های استفاده هم برقرارند.
          </p>
          <p className="mt-4 text-sm">
            <a href={BOT_URL} className="font-semibold text-brand">
              نوشتن به ربات
            </a>
          </p>
          <p className="mt-4 text-sm">
            <Link href="/terms/" className="font-semibold text-brand">
              شرایط استفاده
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
