/** Page frame shared by /onboarding and its loading skeleton. */
export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 py-10 sm:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-fg">Vincule seu Riot ID</h1>
        <p className="text-fg-secondary">
          Usamos o Riot ID só para buscar suas partidas. Seu painel mostra ACS, K/D, HS%, ADR e rank partida a partida.
        </p>
      </div>
      <section aria-label="Vincular conta" className="rounded-card-lg bg-surface-1 p-5 shadow-key sm:p-6">
        {children}
      </section>
    </div>
  );
}
