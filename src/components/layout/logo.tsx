import { cn } from "@/lib/utils";

/** Retake wordmark: a small chamfered tile (our signature cut) + the name. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)}>
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
        <path d="M2 2h11l5 5v11H2z" fill="currentColor" />
        <path d="M6 14V6h4.2a2.4 2.4 0 0 1 0 4.8H6m4 0 3 3.2" fill="none" stroke="var(--color-surface-0)" strokeWidth="1.8" strokeLinecap="square" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-0.01em]">retake</span>
    </span>
  );
}
