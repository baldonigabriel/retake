import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Estado vazio: 32px line icon in muted, one sentence explaining
 * what's missing and the next action as a primary button (passed as `action`).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}>
      <Icon aria-hidden="true" className="size-8 text-fg-muted" strokeWidth={1.5} />
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-medium text-fg">{title}</p>
        {description ? <p className="text-fg-secondary">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** Error state: what went wrong and how to fix it, with a recovery action. */
export function ErrorState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}>
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-loss-tint">
        <Icon aria-hidden="true" className="size-5 text-loss" strokeWidth={1.75} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-medium text-fg">{title}</p>
        <p className="text-fg-secondary">{description}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
