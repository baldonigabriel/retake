import { cn } from "@/lib/utils";

/**
 * Riot ID field: name + tag, the tag shown in Geist Mono and muted (#BR1).
 * Styled as one input (DESIGN.md › Input) with a shared focus ring.
 */
export function RiotIdInput({
  id,
  nameDefault,
  tagDefault,
  invalid,
  describedBy,
  className,
}: {
  id: string;
  nameDefault?: string;
  tagDefault?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 w-full items-center rounded-control border border-line bg-surface-2 transition-[border-color,box-shadow] duration-150 ease-out hover:border-line-strong focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/25 sm:min-h-10",
        invalid && "border-loss ring-3 ring-loss/20",
        className,
      )}
    >
      <input
        id={id}
        name="gameName"
        defaultValue={nameDefault}
        placeholder="Nome"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="min-w-0 flex-1 bg-transparent py-2.5 pl-3 text-base text-fg outline-none placeholder:text-fg-muted focus-visible:outline-none sm:text-body-sm"
      />
      <span aria-hidden="true" className="font-mono text-body-sm text-fg-muted">
        #
      </span>
      <input
        name="tagLine"
        aria-label="Tag"
        defaultValue={tagDefault}
        placeholder="BR1"
        maxLength={5}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        className="w-16 bg-transparent py-2.5 pr-3 pl-0.5 font-mono text-base text-fg-muted uppercase outline-none placeholder:text-fg-muted/60 focus-visible:text-fg focus-visible:outline-none sm:text-body-sm"
      />
    </div>
  );
}
