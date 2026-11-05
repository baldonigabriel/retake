import { cn } from "@/lib/utils"

/**
 * DESIGN.md › Skeleton: surface-2 blocks shaped like the final content with a
 * subtle passing sheen (disabled under prefers-reduced-motion).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-chip bg-surface-2 after:absolute after:inset-0 after:animate-shimmer after:bg-linear-to-r after:from-transparent after:via-white/[0.04] after:to-transparent motion-reduce:after:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
