"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

import { useMediaQuery } from "@/hooks/use-media-query"

/**
 * DESIGN.md › Toast: surface-3, border-strong, bottom-right on desktop
 * (top on mobile), 4s duration. Single dark theme.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const isDesktop = useMediaQuery("(min-width: 640px)")

  return (
    <Sonner
      theme="dark"
      position={isDesktop ? "bottom-right" : "top-center"}
      duration={4000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-win" />,
        info: <InfoIcon className="size-4 text-fg-secondary" />,
        warning: <TriangleAlertIcon className="size-4 text-fg-secondary" />,
        error: <OctagonXIcon className="size-4 text-loss" />,
        loading: <Loader2Icon className="size-4 animate-spin text-fg-secondary" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-surface-3)",
          "--normal-text": "var(--color-fg)",
          "--normal-border": "var(--color-line-strong)",
          "--border-radius": "var(--radius-card)",
          "--width": "360px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !shadow-pop !text-body-sm !font-sans",
          description: "!text-fg-secondary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
