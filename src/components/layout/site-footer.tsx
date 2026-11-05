import { Logo } from "@/components/layout/logo";

/**
 * Footer with the non-affiliation notice required by Riot's fan content policy
 * ("Legal Jibber Jabber" from developer.riotgames.com, kept verbatim).
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <Logo className="text-fg-secondary" />
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
