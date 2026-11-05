import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getLinkedAccount, requireUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Vincular Riot ID",
  description: "Vincule seu Riot ID para importar suas partidas.",
};

/** Each import page may wait on the HenrikDev rate limit. */
export const maxDuration = 60;

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  // `?next=` lets an invite link survive onboarding; only same-site paths.
  const next = safeNextPath((await searchParams).next);
  const user = await requireUser(next === "/me" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`);
  if (await getLinkedAccount(user.id)) redirect(next);

  return (
    <OnboardingShell>
      <OnboardingFlow next={next} />
    </OnboardingShell>
  );
}
