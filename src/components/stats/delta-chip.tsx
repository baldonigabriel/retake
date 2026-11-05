import { formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Variation chip: ▲ +2,1 vs. sua média. Colour is always paired with an arrow.
 * `lowerIsBetter` flips the colour for metrics where going down is good.
 */
export function DeltaChip({
  value,
  digits = 1,
  suffix,
  lowerIsBetter = false,
  className,
}: {
  value: number;
  digits?: number;
  suffix?: string;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const rounded = Number(value.toFixed(digits));
  const direction = rounded === 0 ? "flat" : rounded > 0 ? "up" : "down";
  const good = direction === "flat" ? null : (direction === "up") !== lowerIsBetter;

  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 text-label",
        good === null && "text-fg-muted",
        good === true && "text-win",
        good === false && "text-loss",
        className,
      )}
    >
      <span aria-hidden="true" className="text-[9px] leading-none">
        {direction === "up" ? "▲" : direction === "down" ? "▼" : "■"}
      </span>
      <span className="sr-only">
        {direction === "up" ? "subiu" : direction === "down" ? "caiu" : "estável"}
      </span>
      {formatSigned(value, digits)}
      {suffix ? <span className="text-fg-muted">{suffix}</span> : null}
    </span>
  );
}
