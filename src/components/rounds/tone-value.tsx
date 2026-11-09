import type { Tone } from "@/lib/rounds";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<Tone, string> = { good: "text-win", bad: "text-loss", neutral: "text-fg" };
const TONE_TEXT: Record<Tone, string> = { good: "acima da referência", bad: "abaixo da referência", neutral: "" };

/**
 * A value coloured by how it reads (win/loss tokens). Colour never carries the
 * meaning alone: ▲/▼ sits next to it and screen readers get the words.
 */
export function ToneValue({
  tone,
  children,
  className,
  srText,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
  /** Overrides the default "acima/abaixo da referência" for screen readers. */
  srText?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", TONE_CLASS[tone], className)}>
      {tone !== "neutral" ? (
        <span aria-hidden="true" className="text-[0.6em] leading-none">
          {tone === "good" ? "▲" : "▼"}
        </span>
      ) : null}
      {children}
      {tone !== "neutral" ? <span className="sr-only"> ({srText ?? TONE_TEXT[tone]})</span> : null}
    </span>
  );
}

/** Thin horizontal bar for a rate (0–1), coloured by tone. Decorative: the number is always beside it. */
export function RateBar({ value, tone, className }: { value: number | null; tone: Tone; className?: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <span aria-hidden="true" className={cn("block h-1 overflow-hidden rounded-full bg-surface-3", className)}>
      <span
        className={cn("block h-full rounded-full", tone === "good" ? "bg-win" : tone === "bad" ? "bg-loss" : "bg-fg-muted")}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
