import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getLinkedAccount, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Vincular Riot ID",
  description: "Vincule seu Riot ID para importar suas partidas.",
};

/** Each import page may wait on the HenrikDev rate limit. */
export const maxDuration = 60;

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (await getLinkedAccount(user.id)) redirect("/me");

  return (
    <OnboardingShell>
      <OnboardingFlow />
    </OnboardingShell>
  );
}
