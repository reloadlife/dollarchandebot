"use client";

import { ChartContainer, type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAxisPrice } from "@/lib/candles";
import { faNumber } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";

const UP = "#3dceb6";
const DOWN = "#fb7185";

const chartConfig = {
  wick: {
    label: "کندل",
    colors: {
      light: [UP, DOWN],
      dark: [UP, DOWN],
    },
  },
} satisfies ChartConfig;

export type CandlePoint = {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CandleRow = CandlePoint & { i: number; wick: [number, number] };

function domainOf(points: CandlePoint[]): [number, number] {
  const lo = Math.min(...points.map((point) => point.low));
  const hi = Math.max(...points.map((point) => point.high));
  if (hi === lo) {
    const bump = Math.max(Math.abs(hi) * 0.002, 1);
    return [lo - bump, hi + bump];
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

function CandleShape(props: BarShapeProps) {
  const { x, y, width, height, payload, background } = props;
  const bar = payload as CandlePoint | undefined;
  if (!bar || x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const { open, close, high, low } = bar;
  const up = close >= open;
  const color = up ? UP : DOWN;
  const bandX = background?.x ?? x;
  const bandW = background?.width ?? width;
  const cx = bandX + bandW / 2;
  const bodyW = Math.max(3, Math.min(14, bandW * 0.62));
  const span = high - low;
  const flat = span === 0 || height < 1;
  const yOf = (price: number) => (flat ? y : y + ((high - price) / span) * height);
  const bodyTop = Math.min(yOf(open), yOf(close));
  const bodyH = flat ? 1.5 : Math.max(Math.abs(yOf(close) - yOf(open)), 1.5);
  const wickTop = flat ? y : y;
  const wickBot = flat ? y : y + height;
  const hitH = Math.max(height, 14);
  const hitY = y - (hitH - Math.max(height, 0)) / 2;
  return (
    <g>
      <rect x={bandX} y={hitY} width={bandW} height={hitH} fill="transparent" />
      <line x1={cx} x2={cx} y1={wickTop} y2={wickBot} stroke={color} strokeWidth={1.5} />
      <rect x={cx - bodyW / 2} y={flat ? y - 0.75 : bodyTop} width={bodyW} height={bodyH} fill={color} />
    </g>
  );
}

function CandleTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CandlePoint }>;
}) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  const up = bar.close >= bar.open;
  const rows = [
    ["باز", bar.open],
    ["بالا", bar.high],
    ["پایین", bar.low],
    ["بسته", bar.close],
  ] as const;
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl" dir="rtl">
      <div className="font-medium" dir="ltr">
        {bar.t}
      </div>
      {rows.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{name}</span>
          <span dir="ltr" className={name === "بسته" ? (up ? "font-medium text-success" : "font-medium text-destructive") : "font-medium tabular-nums"}>
            {faNumber(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PriceChart({ points, label }: { points: CandlePoint[] | null; label: string }) {
  if (points == null) return <Skeleton className="mt-4 aspect-video w-full" />;
  if (points.length === 0) {
    return (
      <p className="mt-4 flex min-h-40 items-center justify-center rounded-[16px] border border-border bg-[#0e1726] px-4 text-center text-sm text-[#d5deea]">
        برای این بازه نموداری نیست.
      </p>
    );
  }

  const rows: CandleRow[] = points.map((point, index) => ({
    ...point,
    i: index,
    wick: [point.low, point.high],
  }));
  const [lo, hi] = domainOf(points);

  return (
    <div
      className="candle-well mt-4 overflow-hidden rounded-[16px] border border-border bg-[#0e1726] px-2 py-3"
      dir="ltr"
      role="img"
      aria-label={label}
    >
      <style>{`.candle-well .recharts-cartesian-axis-tick text { fill: #d5deea !important; }`}</style>
      <ChartContainer config={chartConfig} className="h-64 w-full bg-transparent sm:h-72">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(213,222,234,0.16)" />
          <XAxis
            dataKey="i"
            tickLine={false}
            axisLine={false}
            minTickGap={points.length > 12 ? 72 : 28}
            tickFormatter={(index: number) => rows[index]?.t ?? ""}
          />
          <YAxis
            domain={[lo, hi]}
            allowDataOverflow
            width={72}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value: number) => formatAxisPrice(Number(value), hi - lo)}
          />
          <Tooltip cursor={false} content={(props) => <CandleTip active={props.active} payload={props.payload} />} />
          <Bar dataKey="wick" shape={CandleShape} isAnimationActive={false} maxBarSize={18} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
