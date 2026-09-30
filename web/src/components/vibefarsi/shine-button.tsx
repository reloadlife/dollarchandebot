import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const glint = (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-black/25 to-transparent"
    style={{ animation: "shine 2.2s ease-in-out infinite" }}
  />
);

type ShineButtonProps = ButtonProps & { href?: string };

/** دکمه‌ی درخشان. A periodic glint for the one primary action on a page. */
export function ShineButton({ className, children, href, ...props }: ShineButtonProps) {
  if (href) {
    return (
      <a
        href={href}
        className={cn(
          "relative inline-flex h-11 items-center justify-center overflow-hidden whitespace-nowrap rounded-[16px] bg-brand px-4 text-sm font-semibold text-brand-foreground transition-transform duration-150 ease-out hover:brightness-110 active:scale-[0.98]",
          className,
        )}
      >
        {glint}
        {children}
      </a>
    );
  }

  return (
    <Button className={cn("relative overflow-hidden", className)} {...props}>
      {glint}
      {children}
    </Button>
  );
}