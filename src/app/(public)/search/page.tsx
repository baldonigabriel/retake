import { Hourglass, SearchX, UserSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TierIcon } from "@/components/history/history-row";
import { ProfileSearchForm } from "@/components/profile/profile-search-form";
import { EmptyState } from "@/components/ui/states";
import { searchPublicProfiles, type SearchResult } from "@/lib/profile/queries";
import { parseSearchQuery, SEARCH_MIN_CHARS } from "@/lib/profile/search";
import { takeSearchQuota } from "@/lib/profile/search-limit";
import { tierLabel } from "@/lib/ranks";

export const metadata: Metadata = {
  title: "Buscar perfis",
  description: "Encontre perfis públicos do Retake pelo Riot ID.",
  robots: { index: false, follow: false },
};

/**
 * Search among public profiles only (SPEC §6.4). A private profile, a player
 * who isn't a user and a name that doesn't exist all get the same "no public
 * profile" answer. Nothing here says whether someone is in a group.
 */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const query = parseSearchQuery((await searchParams).q);
  const text = query.kind === "empty" ? "" : query.text;

  return (
    <div className="content-enter mx-auto flex w-full max-w-2xl flex-col gap-6 py-8 sm:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-fg">Buscar perfis</h1>
        <p className="text-fg-secondary">Veja como joga quem deixou o perfil público no Retake.</p>
      </div>
      <ProfileSearchForm defaultValue={text} autoFocus={query.kind === "empty"} />
      <Results query={query} />
    </div>
  );
}

async function Results({ query }: { query: ReturnType<typeof parseSearchQuery> }) {
  if (query.kind === "empty") return null;
  if (query.kind === "too_short") {
    return (
      <Panel>
        <EmptyState
          icon={UserSearch}
          title={`Digite pelo menos ${SEARCH_MIN_CHARS} letras do nome`}
          description="A busca procura pelo nome do Riot ID, com ou sem a #TAG."
        />
      </Panel>
    );
  }
  if (!(await takeSearchQuota())) {
    return (
      <Panel>
        <EmptyState
          icon={Hourglass}
          title="Muitas buscas seguidas"
          description="Espere um minuto e tente de novo."
        />
      </Panel>
    );
  }

  const results = await searchPublicProfiles(query);
  if (results.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={SearchX}
          title="Nenhum perfil público com esse nome"
          description="Confira a grafia. Só aparece quem usa o Retake e escolheu deixar o perfil público."
        />
      </Panel>
    );
  }

  return (
    <section aria-labelledby="results-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="results-title" className="text-body-sm font-semibold text-fg">
          Perfis públicos
        </h2>
        <span className="num text-label font-normal text-fg-muted">
          {results.length} {results.length === 1 ? "resultado" : "resultados"}
        </span>
      </header>
      <ul className="divide-y divide-line">
        {results.map((r) => (
          <li key={r.path}>
            <ResultRow result={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultRow({ result }: { result: SearchResult }) {
  return (
    <Link
      href={result.path}
      className="hover-layer press relative flex min-h-16 items-center gap-3 px-4 py-3 [--press-scale:0.99] focus-visible:outline-offset-[-2px]"
    >
      <span className="size-10 shrink-0 overflow-hidden rounded-control bg-surface-3">
        {result.cardUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- community player card asset
          <img src={result.cardUrl} alt="" width={40} height={40} className="size-full object-cover" />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1">
        <span className="truncate font-medium text-fg">{result.gameName}</span>
        <span className="font-mono text-label text-fg-muted">#{result.tagLine}</span>
      </span>
      {result.tier !== null ? (
        <span className="flex shrink-0 items-center gap-2 text-label font-normal text-fg-secondary">
          <TierIcon tier={result.tier} size={20} />
          <span className="hidden sm:inline">{tierLabel(result.tier)}</span>
        </span>
      ) : null}
    </Link>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-card bg-surface-1 shadow-hairline">{children}</section>;
}
