import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/** DESIGN.md › Badge e chip: surface-3, 12px secondary text, 4px radius, 2px 6px padding. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-chip px-1.5 py-0.5 text-label whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-surface-3 text-fg-secondary",
        outline: "text-fg-secondary shadow-hairline",
        accent: "bg-accent-tint text-fg shadow-[inset_0_0_0_1px_var(--color-accent-line)]",
        win: "bg-win-tint text-win",
        loss: "bg-loss-tint text-loss",
        draw: "bg-surface-3 text-draw",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
