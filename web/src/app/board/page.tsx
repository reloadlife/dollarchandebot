import type { Metadata } from "next";
import { Board } from "@/components/board";

export const metadata: Metadata = {
  alternates: { canonical: "/board/" },
  openGraph: { title: "تابلو · دلارچنده", url: "/board/", images: ["/social-card.png"], locale: "fa_IR", type: "website" },
  title: "تابلو · دلارچنده",
  description: "تابلوی زنده نرخ بازار آزاد، ارز، طلا و سکه به تومان.",
};

export default function BoardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold">نرخ بازار آزاد</h1>
      <p className="mt-2 max-w-[42ch] text-muted-foreground">همان عدد کانال، به تومان. نماد را انتخاب کن تا نمودار را ببینی.</p>
      <div className="mt-6">
        <Board />
      </div>
    </main>
  );
}
