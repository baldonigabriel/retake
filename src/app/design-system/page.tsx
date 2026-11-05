import type { Metadata } from "next";
import { CloudOff, Plus, RefreshCw, Swords, Trophy } from "lucide-react";

import { RankingList } from "@/components/groups/ranking-list";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { MatchRow, MatchRowSkeleton } from "@/components/match/match-row";
import { ScoreboardTable } from "@/components/match/scoreboard-table";
import { DeltaChip } from "@/components/stats/delta-chip";
import { KpiCard, KpiCardSkeleton } from "@/components/stats/kpi-card";
import { ResultChip } from "@/components/stats/result-chip";
import { TrendChart } from "@/components/stats/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChamferCard } from "@/components/ui/chamfer-card";
import { Input } from "@/components/ui/input";
import { RiotIdInput } from "@/components/ui/riot-id-input";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ToastDemo } from "@/components/ui/toast-demo";
import {
  SAMPLE_NOW,
  sampleKpis,
  sampleMatches,
  sampleRanking,
  sampleScoreboard,
  sampleTrend,
} from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Design system",
  description: "Tokens e componentes base do Retake.",
};

const SECTIONS = [
  { id: "cores", label: "Cores" },
  { id: "tipografia", label: "Tipografia" },
  { id: "forma", label: "Forma e elevação" },
  { id: "acoes", label: "Ações e campos" },
  { id: "desempenho", label: "Desempenho" },
  { id: "partidas", label: "Partidas" },
  { id: "grupo", label: "Grupo" },
  { id: "estados", label: "Estados" },
] as const;

const COLOR_GROUPS: { title: string; colors: { token: string; hex: string; className: string }[] }[] = [
  {
    title: "Superfícies",
    colors: [
      { token: "surface-0", hex: "#050607", className: "bg-surface-0" },
      { token: "surface-1", hex: "#0B0C0E", className: "bg-surface-1" },
      { token: "surface-2", hex: "#121316", className: "bg-surface-2" },
      { token: "surface-3", hex: "#1B1C1F", className: "bg-surface-3" },
      { token: "line", hex: "#2A2B2E", className: "bg-line" },
      { token: "line-strong", hex: "#3A3B3E", className: "bg-line-strong" },
    ],
  },
  {
    title: "Texto",
    colors: [
      { token: "fg", hex: "#F5F5F4", className: "bg-fg" },
      { token: "fg-secondary", hex: "#A1A1A3", className: "bg-fg-secondary" },
      { token: "fg-muted", hex: "#7C7D80", className: "bg-fg-muted" },
    ],
  },
  {
    title: "Acento",
    colors: [
      { token: "primary", hex: "#FF4655", className: "bg-primary" },
      { token: "accent-hover", hex: "#FF5E6B", className: "bg-accent-hover" },
      { token: "accent-pressed", hex: "#E03A48", className: "bg-accent-pressed" },
      { token: "accent-tint", hex: "#2A0F12", className: "bg-accent-tint" },
      { token: "accent-line", hex: "#5A1A20", className: "bg-accent-line" },
      { token: "on-accent", hex: "#0B0C0E", className: "bg-on-accent" },
    ],
  },
  {
    title: "Resultado",
    colors: [
      { token: "win", hex: "#34D3A6", className: "bg-win" },
      { token: "win-tint", hex: "#0D2A22", className: "bg-win-tint" },
      { token: "loss", hex: "#D9575F", className: "bg-loss" },
      { token: "loss-tint", hex: "#2A1214", className: "bg-loss-tint" },
      { token: "draw", hex: "#A1A1A3", className: "bg-draw" },
    ],
  },
];

const TYPE_SCALE = [
  { role: "hero", spec: "Inter 56 / 600 · só na landing", className: "text-hero", sample: "Sua evolução, junto" },
  { role: "heading", spec: "Inter 28 / 600", className: "text-heading", sample: "Painel" },
  { role: "subheading", spec: "Inter 20 / 500", className: "text-subheading", sample: "Partidas recentes" },
  { role: "body", spec: "Inter 16 / 400", className: "text-body", sample: "Texto padrão da landing." },
  { role: "body-sm", spec: "Inter 14 / 400", className: "text-body-sm", sample: "Texto padrão das telas de dados." },
  { role: "table", spec: "Inter 13 / 400", className: "text-table num", sample: "24 / 14 / 5 · 1,71 K/D" },
  { role: "label", spec: "Inter 12 / 500", className: "text-label", sample: "Cabeçalho de tabela" },
  { role: "eyebrow", spec: "Inter 11 / 500 · caixa alta", className: "text-eyebrow uppercase text-fg-muted", sample: "Últimas 20 partidas" },
  { role: "stat-lg", spec: "Barlow Condensed 48 / 700", className: "stat text-stat-lg", sample: "247" },
  { role: "stat-md", spec: "Barlow Condensed 32 / 600", className: "stat text-stat-md", sample: "13–9" },
  { role: "mono", spec: "Geist Mono 13 / 400", className: "font-mono text-table text-fg-muted", sample: "#BR1 · 35:54 · a1f3c9" },
];

const SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 120];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-5 border-t border-line pt-10">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-subheading text-fg">
          {title}
        </h2>
        <p className="max-w-2xl text-fg-secondary">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-card bg-surface-1 shadow-hairline", className)}>{children}</div>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-eyebrow text-fg-muted uppercase">{children}</h3>;
}

export default function DesignSystemPage() {
  const [teamA, teamB] = sampleScoreboard.teams;
  const mvp = sampleRanking[0]!;

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-14 pb-24 sm:px-6 md:pb-16">
        <header className="flex flex-col gap-2 py-10 sm:py-12">
          <p className="text-eyebrow text-fg-muted uppercase">Retake · Fase 0</p>
          <h1 className="text-heading text-fg">Design system</h1>
          <p className="max-w-2xl text-fg-secondary">
            Tokens e componentes base, com dados de exemplo. Tudo aqui segue o DESIGN.md: fundo
            único quase preto, bordas finas e o vermelho reservado para a ação principal.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-12">
          <nav aria-label="Seções do design system" className="hidden lg:block">
            <ul className="sticky top-24 flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-control px-2 py-1.5 text-body-sm text-fg-secondary transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-fg"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-14">
            {/* Cores */}
            <Section
              id="cores"
              title="Cores"
              description="A interface é 95% acromática. O vermelho é sinal; as cores de resultado aparecem só em chips, barras e variações, sempre com texto ou ícone."
            >
              <div className="grid gap-6">
                {COLOR_GROUPS.map((group) => (
                  <div key={group.title} className="flex flex-col gap-3">
                    <SubTitle>{group.title}</SubTitle>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                      {group.colors.map((c) => (
                        <li key={c.token} className="flex flex-col gap-2">
                          <span
                            aria-hidden="true"
                            className={cn("h-12 rounded-control shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]", c.className)}
                          />
                          <span className="flex flex-col">
                            <span className="font-mono text-label text-fg">{c.token}</span>
                            <span className="font-mono text-label text-fg-muted">{c.hex}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            {/* Tipografia */}
            <Section
              id="tipografia"
              title="Tipografia"
              description="Inter na interface, Barlow Condensed só para números e rótulos curtos, Geist Mono para metadados técnicos. Todo número usa algarismos tabulares."
            >
              <Panel className="divide-y divide-line">
                {TYPE_SCALE.map((t) => (
                  <div key={t.role} className="grid gap-1 px-4 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-baseline sm:gap-6 sm:px-5">
                    <div className="flex flex-col">
                      <span className="font-mono text-label text-fg">{t.role}</span>
                      <span className="text-label font-normal text-fg-muted">{t.spec}</span>
                    </div>
                    <p className={cn("min-w-0 text-fg [overflow-wrap:anywhere]", t.className)}>{t.sample}</p>
                  </div>
                ))}
              </Panel>
            </Section>

            {/* Forma e elevação */}
            <Section
              id="forma"
              title="Forma e elevação"
              description="Grid de 4px. A profundidade vem de degraus de superfície e bordas finas; sombra projetada só em popovers e menus."
            >
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <SubTitle>Espaçamento</SubTitle>
                  <Panel className="flex flex-col gap-2 p-4 sm:p-5">
                    {SPACING.map((s) => (
                      <div key={s} className="flex items-center gap-3">
                        <span className="num w-8 text-right font-mono text-label text-fg-muted">{s}</span>
                        <span aria-hidden="true" className="h-2 rounded-[2px] bg-line-strong" style={{ width: s }} />
                      </div>
                    ))}
                  </Panel>
                </div>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <SubTitle>Raio</SubTitle>
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { label: "chip", value: "4", className: "rounded-chip" },
                        { label: "controle", value: "6", className: "rounded-control" },
                        { label: "card", value: "12", className: "rounded-card" },
                        { label: "modal", value: "16", className: "rounded-card-lg" },
                        { label: "pill", value: "∞", className: "rounded-full" },
                      ].map((r) => (
                        <div key={r.label} className="flex flex-col items-center gap-2">
                          <span aria-hidden="true" className={cn("aspect-square w-full max-w-16 border border-line-strong bg-surface-2", r.className)} />
                          <span className="text-center text-label font-normal text-fg-muted">
                            {r.label} <span className="num font-mono">{r.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <SubTitle>Elevação</SubTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex h-20 items-end rounded-card bg-surface-1 p-3 text-label text-fg-secondary shadow-hairline">Card padrão</div>
                      <div className="flex h-20 items-end rounded-card bg-surface-1 p-3 text-label text-fg-secondary shadow-key">Card “tecla”</div>
                      <div className="flex h-20 items-end rounded-card border border-line-strong bg-surface-3 p-3 text-label text-fg-secondary shadow-pop">Popover</div>
                      <div className="flex h-20 items-end rounded-card bg-accent-tint p-3 text-label text-fg-secondary shadow-[var(--shadow-key),var(--shadow-mvp)]">Brilho de MVP</div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Ações e campos */}
            <Section
              id="acoes"
              title="Ações e campos"
              description="Um único botão vermelho por tela. Botões respondem ao clique com um leve afundar; o hover só existe com mouse."
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <Panel className="flex flex-col gap-5 p-4 sm:p-5">
                  <SubTitle>Botões</SubTitle>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button>
                      <RefreshCw aria-hidden="true" />
                      Sincronizar agora
                    </Button>
                    <Button variant="secondary">Convidar amigos</Button>
                    <Button variant="ghost">Ver partida</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="destructive">Desvincular conta</Button>
                    <Button variant="ghost" disabled>
                      Indisponível
                    </Button>
                    <Button variant="quiet" size="icon" aria-label="Criar grupo">
                      <Plus aria-hidden="true" />
                    </Button>
                    <Button variant="link">Ver todas</Button>
                  </div>
                  <p className="text-label font-normal text-fg-muted">
                    Primário · secundário · fantasma · destrutivo (sempre com confirmação) ·
                    desabilitado · ícone · link
                  </p>
                </Panel>

                <Panel className="flex flex-col gap-5 p-4 sm:p-5">
                  <SubTitle>Campos</SubTitle>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="riot-id" className="text-label text-fg-secondary">
                      Riot ID
                    </label>
                    <RiotIdInput id="riot-id" nameDefault="nyx" tagDefault="BR1" describedBy="riot-id-hint" />
                    <p id="riot-id-hint" className="text-label font-normal text-fg-muted">
                      Do jeito que aparece no jogo, com a tag depois do #.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="group-name" className="text-label text-fg-secondary">
                      Nome do grupo
                    </label>
                    <Input id="group-name" placeholder="Ex.: Os Cria" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="riot-id-invalid" className="text-label text-fg-secondary">
                      Riot ID com erro
                    </label>
                    <RiotIdInput id="riot-id-invalid" nameDefault="ninguem" tagDefault="000" invalid describedBy="riot-id-error" />
                    <p id="riot-id-error" className="text-label font-normal text-loss">
                      Não achamos essa conta. Confira o nome e a tag no jogo.
                    </p>
                  </div>
                </Panel>
              </div>
            </Section>

            {/* Desempenho */}
            <Section
              id="desempenho"
              title="Desempenho"
              description="Responde “estou melhorando?”: cada KPI compara as últimas 20 partidas com a sua média geral. Modo: competitivo."
            >
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {sampleKpis.map((k, i) => (
                  <li key={k.label} className={cn(i === sampleKpis.length - 1 && "col-span-2 md:col-span-1")}>
                    <KpiCard
                      label={k.label}
                      value={k.value}
                      delta={k.delta}
                      deltaDigits={k.deltaDigits}
                      trend={k.trend}
                      hint={k.formula}
                      className="h-full"
                    />
                  </li>
                ))}
              </ul>
              <Panel className="p-4 sm:p-5">
                <TrendChart data={sampleTrend} />
              </Panel>
              <div className="flex flex-col gap-3">
                <SubTitle>Chips e badges</SubTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <ResultChip result="win" />
                  <ResultChip result="loss" />
                  <ResultChip result="draw" />
                  <ResultChip result="win" long />
                  <ResultChip result="loss" long />
                  <ResultChip result="draw" long />
                  <Badge>Competitivo</Badge>
                  <Badge variant="outline">grupo</Badge>
                  <Badge variant="accent">Você</Badge>
                  <DeltaChip value={2.1} suffix="vs. sua média" />
                  <DeltaChip value={-0.4} suffix="vs. sua média" />
                </div>
              </div>
            </Section>

            {/* Partidas */}
            <Section
              id="partidas"
              title="Partidas"
              description="Linhas inteiras clicáveis com resultado em cor e letra. O placar destaca a sua linha e marca quem é do seu grupo."
            >
              <Panel className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h3 className="text-body-sm font-semibold text-fg">Partidas recentes</h3>
                  <Badge>Competitivo</Badge>
                </div>
                <ul className="divide-y divide-line">
                  {sampleMatches.map((m, i) => (
                    <li key={m.id} className="animate-enter motion-reduce:animate-none" style={{ animationDelay: `${i * 40}ms` }}>
                      <MatchRow match={m} now={SAMPLE_NOW} />
                    </li>
                  ))}
                </ul>
              </Panel>
              <div className="flex flex-col gap-3">
                <ScoreboardTable team={teamA} roundsPlayed={sampleScoreboard.rounds} />
                <ScoreboardTable team={teamB} roundsPlayed={sampleScoreboard.rounds} />
              </div>
            </Section>

            {/* Grupo */}
            <Section
              id="grupo"
              title="Grupo"
              description="Responde “quem mandou bem essa semana?”. O card chanfrado é a assinatura visual: no máximo um por tela."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <ChamferCard variant="mvp" innerClassName="flex h-full flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Trophy aria-hidden="true" className="size-4 text-primary" strokeWidth={1.75} />
                    <p className="text-eyebrow text-fg-secondary uppercase">MVP da semana</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-12 items-center justify-center rounded-full bg-surface-3 text-body font-medium text-fg uppercase shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                    >
                      {mvp.name.slice(0, 1)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-subheading text-fg">{mvp.name}</p>
                      <p className="font-mono text-label text-fg-muted">#{mvp.tag}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-eyebrow text-fg-muted uppercase">ACS médio</p>
                      <p className="stat text-stat-lg text-fg">{mvp.value}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <DeltaChip value={mvp.delta} digits={0} suffix="vs. semana passada" />
                      <p className="num text-label font-normal text-fg-muted">{mvp.matches} partidas</p>
                    </div>
                  </div>
                </ChamferCard>
                <Panel className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <h3 className="text-body-sm font-semibold text-fg">Ranking da semana</h3>
                    <Badge>ACS · competitivo</Badge>
                  </div>
                  <RankingList entries={sampleRanking} metric="ACS" />
                </Panel>
              </div>
            </Section>

            {/* Estados */}
            <Section
              id="estados"
              title="Estados"
              description="Toda tela tem carregamento com o formato do conteúdo, vazio com a próxima ação e erro dizendo como resolver."
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <SubTitle>Carregando</SubTitle>
                  <div role="status" aria-label="Carregando partidas" className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <KpiCardSkeleton />
                      <KpiCardSkeleton />
                    </div>
                    <Panel className="divide-y divide-line overflow-hidden">
                      <MatchRowSkeleton />
                      <MatchRowSkeleton />
                    </Panel>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <SubTitle>Vazio</SubTitle>
                  <Panel className="flex flex-1 items-center justify-center">
                    <EmptyState
                      icon={Swords}
                      title="Nenhuma partida competitiva ainda"
                      description="Jogue uma competitiva ou sincronize para buscar as partidas mais recentes."
                      action={
                        <Button>
                          <RefreshCw aria-hidden="true" />
                          Sincronizar agora
                        </Button>
                      }
                    />
                  </Panel>
                </div>
                <div className="flex flex-col gap-3">
                  <SubTitle>Erro</SubTitle>
                  <Panel>
                    <ErrorState
                      icon={CloudOff}
                      title="Não conseguimos buscar suas partidas"
                      description="A API de dados está fora do ar. Seus dados salvos continuam aqui; tente de novo em alguns minutos."
                      action={<Button variant="ghost">Tentar de novo</Button>}
                    />
                  </Panel>
                </div>
                <div className="flex flex-col gap-3">
                  <SubTitle>Toast</SubTitle>
                  <Panel className="flex flex-1 flex-col justify-center gap-3 p-4 sm:p-5">
                    <p className="text-fg-secondary">
                      Avisos curtos de 4 segundos: canto inferior direito no computador, topo no
                      celular.
                    </p>
                    <ToastDemo />
                  </Panel>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
