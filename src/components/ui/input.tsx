import * as React from "react"

import { cn } from "@/lib/utils"

/** DESIGN.md › Input: surface-2, hairline border, red border + 3px ring on focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-11 w-full min-w-0 rounded-control border border-line bg-surface-2 px-3 py-2.5 text-base text-fg transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-fg-muted hover:border-line-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-loss aria-invalid:ring-3 aria-invalid:ring-loss/20 sm:min-h-10 sm:text-body-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
