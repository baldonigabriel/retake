"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * List whose items enter with a 40ms stagger on the FIRST load only
 * (DESIGN.md › Movimento). Items rendered after that (filter change,
 * refresh after a sync) appear without motion. Each child `li` reads its
 * index from `--i`.
 */
export function StaggerList({ children, className, ...props }: React.ComponentProps<"ul">) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 900);
    return () => clearTimeout(timer);
  }, []);
  return (
    <ul data-entering={entering || undefined} className={cn("stagger-list", className)} {...props}>
      {children}
    </ul>
  );
}
