import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Assinatura: corte chanfrado.
 * Highlight card with the top-right corner cut 10px, bordered in accent-line.
 * clip-path also clips `border`, so the border is a 1px outer layer behind a
 * chamfered inner surface. The MVP glow uses drop-shadow on an unclipped
 * wrapper so it follows the cut shape. Max ONE chamfered element per screen.
 * `celebrate` (MVP of the week, a win): enters with fade + scale(0.98) and a
 * diagonal sheen crosses it once (DESIGN.md › Movimento › Destaques).
 */
export function ChamferCard({
  variant = "default",
  celebrate = false,
  className,
  innerClassName,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "mvp";
  celebrate?: boolean;
  innerClassName?: string;
}) {
  return (
    <div
      data-slot="chamfer-card"
      className={cn(
        variant === "mvp" && "drop-shadow-[0_0_32px_rgba(255,70,85,0.12)]",
        celebrate && "celebrate",
        className,
      )}
      {...props}
    >
      <div className="chamfer h-full rounded-card bg-accent-line p-px">
        <div
          className={cn(
            "chamfer relative h-full rounded-[11px] p-4 sm:p-5",
            celebrate && "celebrate-sheen",
            variant === "mvp" ? "on-tint bg-accent-tint shadow-key" : "bg-surface-1",
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
