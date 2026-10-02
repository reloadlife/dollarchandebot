import { Skeleton } from "@/components/ui/skeleton";
import { formatAxisPrice, type Candle } from "@/lib/candles";
import { faNumber } from "@/lib/utils";

const UP = "#3dceb6";
const DOWN = "#e07a6a";

function extent(candles: Candle[]): { lo: number; hi: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const candle of candles) {
    lo = Math.min(lo, candle.low);
    hi = Math.max(hi, candle.high);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
  if (hi === lo) {
    const bump = Math.max(Math.abs(hi) * 0.002, 1);
    return { lo: lo - bump, hi: hi + bump };
  }
  const pad = (hi - lo) * 0.08;
  return { lo: lo - pad, hi: hi + pad };
}

export function CandleChart({
  candles,
  label,
  startLabel,
  endLabel,
}: {
  candles: Candle[] | null;
  label: string;
  startLabel: string;
  endLabel: string;
}) {
  if (candles == null) return <Skeleton className="mt-4 h-44 w-full" />;
  if (candles.length === 0) {
    return (
      <p className="mt-4 flex min-h-40 items-center justify-center rounded-[16px] border border-border bg-[#0e1726] px-4 text-center text-sm text-[#d5deea]">
        برای این بازه نموداری نیست.
      </p>
    );
  }

  const { lo, hi } = extent(candles);
  const span = hi - lo || 1;
  const width = 520;
  const height = 220;
  const padT = 8;
  const padB = 8;
  const plotH = height - padT - padB;
  const yOf = (price: number) => padT + plotH * (1 - (price - lo) / span);
  const slot = width / candles.length;
  const bodyW = Math.min(18, Math.max(3, slot * 0.64));
  const levels = [hi, lo + span / 2, lo];

  return (
    <div className="mt-4 w-full min-w-0 overflow-hidden rounded-[16px] border border-border bg-[#0e1726] px-2 py-2" dir="ltr">
      <div className="flex min-w-0 items-stretch gap-1.5">
        <div className="flex w-16 shrink-0 flex-col justify-between py-1 text-end text-[11px] leading-none text-[#c5deea]">
          {levels.map((price) => (
            <span key={price} title={faNumber(price)}>
              {formatAxisPrice(price, span)}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={label}
          className="block h-36 w-0 min-w-0 flex-1"
        >
          {levels.map((price) => (
            <line
              key={price}
              x1={0}
              x2={width}
              y1={yOf(price)}
              y2={yOf(price)}
              stroke="rgba(255,255,255,0.12)"
            />
          ))}
          {candles.map((candle, index) => {
            const up = candle.close >= candle.open;
            const color = up ? UP : DOWN;
            const x = slot * index + slot / 2;
            const top = Math.min(yOf(candle.open), yOf(candle.close));
            const bodyH = Math.max(Math.abs(yOf(candle.close) - yOf(candle.open)), 1.5);
            return (
              <g key={index}>
                <line x1={x} x2={x} y1={yOf(candle.high)} y2={yOf(candle.low)} stroke={color} strokeWidth="1.5" />
                <rect x={x - bodyW / 2} y={top} width={bodyW} height={bodyH} fill={color} rx="1" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex justify-between ps-16 text-[11px] leading-none text-[#9aabbd]">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}
