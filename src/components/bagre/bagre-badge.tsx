import { Fish } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BADGE_TITLE, type Cadence } from "@/lib/bagre/period";
import { cn } from "@/lib/utils";

/** "Bagre da Semana" / "Bagre do Dia": neutral chip, icon + text (never colour alone). */
export function BagreBadge({ cadence, className }: { cadence: Cadence; className?: string }) {
  return (
    <Badge className={cn("text-fg", className)}>
      <Fish aria-hidden="true" />
      {BADGE_TITLE[cadence]}
    </Badge>
  );
}
