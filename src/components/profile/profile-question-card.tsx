import { cookies } from "next/headers";

import { ProfileQuestionBody } from "@/components/profile/profile-question-body";
import { PROFILE_LATER_COOKIE } from "@/lib/profile/later";
import { getProfileSettings } from "@/lib/profile/queries";

/**
 * SPEC §6.2: users who never answered the public/private question (older
 * accounts, or who left onboarding before that step) see it once at the top
 * of /me. "Agora não" hides it for a week on this browser; meanwhile the
 * profile stays private.
 */
export async function ProfileQuestionCard({
  userId,
  riotId,
}: {
  userId: string;
  riotId: { gameName: string; tagLine: string };
}) {
  const [settings, jar] = await Promise.all([getProfileSettings(userId), cookies()]);
  if (settings.decidedAt || jar.get(PROFILE_LATER_COOKIE)?.value === userId) return null;

  return (
    <section aria-labelledby="profile-question-title" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 id="profile-question-title" className="text-body-sm font-semibold text-fg">
          Seu perfil pode ser público?
        </h2>
        <p className="max-w-[70ch] text-fg-secondary">
          Agora dá para ter uma página com seus números para mandar a quem não está nos seus grupos. Enquanto você não
          escolhe, seu perfil fica privado.
        </p>
      </div>
      <ProfileQuestionBody riotId={riotId} />
    </section>
  );
}
