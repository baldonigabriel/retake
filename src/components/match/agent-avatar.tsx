import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Agent icon in a circle. Real icons will come from media.valorant-api.com URLs
 * returned by the API (Phase 1); until then, initials on surface-3.
 */
export function AgentAvatar({
  agent,
  src,
  size = 36,
  className,
}: {
  agent: string;
  src?: string;
  size?: 24 | 28 | 36 | 48;
  className?: string;
}) {
  const sizeClass = size === 48 ? "size-12 text-body-sm" : size === 36 ? "size-9 text-label" : size === 28 ? "size-7 text-eyebrow" : "size-6 text-[10px]";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 font-medium text-fg-secondary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        sizeClass,
        className,
      )}
      title={agent}
    >
      {src ? (
        // Resized by next/image: the source PNG is 1024px.
        <Image src={src} alt={agent} width={size} height={size} sizes={`${size}px`} className="size-full object-cover" />
      ) : (
        <>
          <span aria-hidden="true">{agent.slice(0, 2)}</span>
          <span className="sr-only">{agent}</span>
        </>
      )}
    </span>
  );
}
