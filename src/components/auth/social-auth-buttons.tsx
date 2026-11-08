"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export type SocialProvider = "google" | "discord";

const PROVIDERS: Record<SocialProvider, { label: string; mark: React.ComponentType }> = {
  google: { label: "Google", mark: GoogleMark },
  discord: { label: "Discord", mark: DiscordMark },
};

/** Equal-weight provider choices for sign-in and account linking. */
export function SocialAuthButtons({
  next,
  mode = "sign-in",
  providers = ["google", "discord"],
}: {
  next: string;
  mode?: "sign-in" | "link";
  providers?: readonly SocialProvider[];
}) {
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: SocialProvider) {
    setPending(provider);
    setError(null);
    const errorCallbackURL =
      mode === "link" ? `/settings?linkError=${provider}` : `/login?next=${encodeURIComponent(next)}`;
    const result =
      mode === "link"
        ? await authClient.linkSocial({ provider, callbackURL: next, errorCallbackURL })
        : await authClient.signIn.social({
            provider,
            callbackURL: next,
            newUserCallbackURL: `/onboarding?next=${encodeURIComponent(next)}`,
            errorCallbackURL,
          });

    // On success the browser is already navigating to the provider.
    if (result.error) {
      setPending(null);
      setError(`Não foi possível abrir o ${PROVIDERS[provider].label}. Verifique sua conexão e tente de novo.`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => {
        const item = PROVIDERS[provider];
        const Mark = item.mark;
        const busy = pending === provider;
        return (
          <Button
            key={provider}
            type="button"
            variant="secondary"
            onClick={() => void start(provider)}
            disabled={pending !== null}
            aria-busy={busy}
            className="w-full"
          >
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Mark />}
            {busy ? `Abrindo o ${item.label}…` : `${mode === "link" ? "Vincular" : "Entrar com"} ${item.label}`}
          </Button>
        );
      })}
      <p role="alert" aria-live="polite" className="min-h-5 text-label font-normal text-loss empty:hidden">
        {error}
      </p>
    </div>
  );
}

/** Google G mark (Simple Icons, CC0), kept monochrome inside the Retake palette. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="currentColor">
      <path d="M12.48 10.92v3.28h4.62c-.2 1.06-.8 1.96-1.7 2.57v2.14h2.76c1.62-1.49 2.55-3.69 2.55-6.29 0-.61-.05-1.2-.16-1.7h-8.07Zm0 9.57c2.31 0 4.25-.77 5.67-2.08l-2.76-2.14c-.77.51-1.75.82-2.91.82-2.23 0-4.12-1.51-4.8-3.54H4.83v2.21a8.56 8.56 0 0 0 7.65 4.73Zm-4.8-6.94a5.14 5.14 0 0 1 0-3.1V8.24H4.83a8.58 8.58 0 0 0 0 7.52l2.85-2.21Zm4.8-6.64c1.26 0 2.38.43 3.27 1.28l2.46-2.45a8.25 8.25 0 0 0-13.38 2.5l2.85 2.21c.68-2.03 2.57-3.54 4.8-3.54Z" />
    </svg>
  );
}

/** Discord mark (Simple Icons, CC0). */
function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
