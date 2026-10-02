import type { Metadata } from "next";
import { Board } from "@/components/board";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "تابلو · دلارچنده",
  description: "تابلوی زنده نرخ بازار آزاد، ارز، طلا و سکه به تومان.",
  path: "/board/",
});

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
