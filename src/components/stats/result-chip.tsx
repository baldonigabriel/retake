import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MatchResult } from "@/lib/stats/metrics";

export const RESULT_LETTER: Record<MatchResult, string> = { win: "V", loss: "D", draw: "E" };
export const RESULT_LABEL: Record<MatchResult, string> = {
  win: "Vitória",
  loss: "Derrota",
  draw: "Empate",
};

/**
 * Result never relies on colour alone: the chip always carries a letter (V/D/E)
 * or the full word, and screen readers get the full word.
 */
export function ResultChip({
  result,
  long = false,
  className,
}: {
  result: MatchResult;
  long?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={result} className={cn("font-semibold", className)}>
      {long ? (
        RESULT_LABEL[result]
      ) : (
        <>
          <span aria-hidden="true">{RESULT_LETTER[result]}</span>
          <span className="sr-only">{RESULT_LABEL[result]}</span>
        </>
      )}
    </Badge>
  );
}
