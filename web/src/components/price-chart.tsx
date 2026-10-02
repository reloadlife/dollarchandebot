"use client";

import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAxisPrice } from "@/lib/candles";
import { faNumber } from "@/lib/utils";

const chartConfig = {
  price: {
    label: "تومان",
    colors: {
      light: ["#0f766e", "#3dceb6"],
      dark: ["#3dceb6", "#f3d27a"],
    },
  },
} satisfies ChartConfig;

export type PricePoint = { t: string; price: number } & Record<string, string | number>;

function domainOf(prices: number[]): [number, number] {
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  if (hi === lo) {
    const bump = Math.max(Math.abs(hi) * 0.002, 1);
    return [lo - bump, hi + bump];
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

export function PriceChart({ points, label }: { points: PricePoint[] | null; label: string }) {
  if (points == null) return <Skeleton className="mt-4 aspect-video w-full" />;
  if (points.length === 0) {
    return (
      <p className="mt-4 flex min-h-40 items-center justify-center rounded-[16px] border border-border bg-[#0e1726] px-4 text-center text-sm text-[#d5deea]">
        برای این بازه نموداری نیست.
      </p>
    );
  }

  const prices = points.map((point) => point.price);
  const [lo, hi] = domainOf(prices);

  return (
    <div
      className="mt-4 overflow-hidden rounded-[16px] border border-border bg-[#0e1726] px-2 py-3"
      dir="ltr"
      role="img"
      aria-label={label}
    >
      <EvilAreaChart
        data={points}
        config={chartConfig}
        className="h-64 w-full bg-transparent sm:h-72"
        curveType="monotone"
        animationType="left-to-right"
        xDataKey="t"
      >
        <EvilAreaChart.Grid />
        <EvilAreaChart.XAxis dataKey="t" minTickGap={72} />
        <EvilAreaChart.YAxis
          domain={[lo, hi]}
          width={72}
          tickFormatter={(value: number) => formatAxisPrice(Number(value), hi - lo)}
        />
        <EvilAreaChart.Tooltip
          formatter={(value) => (
            <span className="font-medium text-foreground tabular-nums">{faNumber(Number(value))} تومان</span>
          )}
        />
        <EvilAreaChart.Area dataKey="price" variant="gradient" strokeVariant="solid" strokeWidth={2}>
          <EvilAreaChart.ActiveDot variant="colored-border" />
        </EvilAreaChart.Area>
      </EvilAreaChart>
    </div>
  );
}
