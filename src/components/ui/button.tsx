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
 * Motion (DESIGN.md › Movimento › Interação): hover is a fading layer
 * (`hover-layer`, opacity only, fine pointers), keyboard focus shows the same
 * layer plus the ring, and press scales to 0.97 (`press`).
 */
const buttonVariantsBase = cva(
  "group/button hover-layer press relative inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent font-medium whitespace-nowrap select-none [--hover-inset:-1px] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // White at 12% over the red ≈ accent-hover; the press colour replaces it.
        default:
          "bg-primary font-semibold text-on-accent [--hover-bg:rgb(255_255_255/0.12)] active:bg-accent-pressed active:before:opacity-0!",
        secondary:
          "bg-paper text-surface-3 [--hover-bg:#fff] active:bg-paper/85 active:before:opacity-0!",
        ghost:
          "border-line bg-transparent text-fg-secondary [--hover-bg:transparent] [--hover-ring:inset_0_0_0_1px_var(--color-line-strong)] hover:text-fg focus-visible:text-fg active:bg-surface-2 aria-expanded:text-fg",
        destructive:
          "border-loss bg-transparent text-loss [--hover-bg:var(--color-loss-tint)] active:bg-loss-tint",
        quiet:
          "bg-transparent text-fg-secondary hover:text-fg focus-visible:text-fg active:bg-surface-2",
        link: "h-auto! px-0! text-fg underline decoration-line-strong underline-offset-4 [--press-scale:1] before:hidden hover:decoration-fg",
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

/**
 * Merged with tailwind-merge so a variant's border/background beats the base
 * classes even when used on a <Link> (outside <Button>, which merges too).
 */
const buttonVariants = (...args: Parameters<typeof buttonVariantsBase>) => cn(buttonVariantsBase(...args))

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
