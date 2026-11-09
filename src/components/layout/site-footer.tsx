import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

/**
 * Footer with the non-affiliation notice required by Riot's fan content policy
 * ("Legal Jibber Jabber" from developer.riotgames.com, kept verbatim).
 */
/** `bottomNav`: leave room for the mobile bottom bar (signed-in area). */
export function SiteFooter({ bottomNav = true }: { bottomNav?: boolean }) {
  return (
    <footer className={cn("border-t border-line", bottomNav && "pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0")}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <Logo className="text-fg-secondary" />
          <Link
            href="/privacidade"
            className="-my-3 inline-flex min-h-11 w-fit items-center text-label font-normal text-fg-muted underline decoration-line-strong underline-offset-4 hover:text-fg-secondary md:min-h-0 md:my-0"
          >
            Política de Privacidade
          </Link>
        </div>
        <p lang="en" className="max-w-[60ch] text-label leading-relaxed text-fg-muted">
          Retake isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of
          Riot Games or anyone officially involved in producing or managing Riot Games properties.
          Riot Games, and all associated properties are trademarks or registered trademarks of Riot
          Games, Inc.
        </p>
      </div>
    </footer>
  );
}
