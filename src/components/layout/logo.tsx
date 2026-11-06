import { cn } from "@/lib/utils";

/**
 * The Retake mark (DESIGN.md › Logo): a tile with our signature chamfer and a
 * solid R whose leg runs parallel to the cut, so corner and letter read as one
 * gesture. 32-unit grid; the R sits 6 units in from every side.
 */
export const LOGO_TILE = "M3 3H22L29 10V29H3Z";
export const LOGO_R = "M9 9H17A4 4 0 0 1 17 17L23 23H18L13 18V23H9ZM13 12H17A1 1 0 0 1 17 14H13Z";

/** The mark alone. Tile in `currentColor`, R in `letter` (defaults to the page ground). */
export function LogoMark({ className, letter = "var(--color-surface-0)" }: { className?: string; letter?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-[22px] shrink-0", className)} aria-hidden="true">
      <path d={LOGO_TILE} fill="currentColor" />
      <path d={LOGO_R} fill={letter} fillRule="evenodd" />
    </svg>
  );
}

/** Wordmark lockup: the red mark (dark R) beside the name, everywhere. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)}>
      <LogoMark className="text-primary" letter="var(--color-on-accent)" />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">retake</span>
    </span>
  );
}
