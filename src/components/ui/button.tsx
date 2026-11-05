import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * DESIGN.md › Componentes › Botões.
 * - default: primary (brand red, dark text). Only ONE per screen.
 * - secondary: light grey surface.
 * - ghost: transparent with hairline border ("fantasma").
 * - destructive: transparent, loss border and text. Always confirm the action.
 * - quiet: borderless icon/text button for toolbars.
 * Press feedback: scale(0.97). Hover only on fine pointers (see globals.css).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent font-medium whitespace-nowrap select-none transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-semibold text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
        secondary:
          "bg-paper text-surface-3 hover:bg-white active:bg-paper/85",
        ghost:
          "border-line bg-transparent text-fg-secondary hover:border-line-strong hover:text-fg active:bg-surface-2 aria-expanded:border-line-strong aria-expanded:text-fg",
        destructive:
          "border-loss bg-transparent text-loss hover:bg-loss-tint active:bg-loss-tint",
        quiet:
          "bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg active:bg-surface-2",
        link: "h-auto! px-0! text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg active:scale-100",
      },
      size: {
        default: "min-h-11 px-4 py-2.5 text-body-sm sm:min-h-10",
        sm: "min-h-11 px-3 py-1.5 text-label sm:min-h-8",
        icon: "size-11 sm:size-10",
        "icon-sm": "size-11 sm:size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
