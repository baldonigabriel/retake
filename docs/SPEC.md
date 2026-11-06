# Retake — especificação do MVP

## 1. Fonte de dados

API não oficial do HenrikDev (`https://api.henrikdev.xyz`), com chave **Basic** (30 req/min). Ela não tem endosso da Riot, então o código de acesso fica isolado em `src/lib/henrik/` para facilitar uma troca de fonte no futuro.

Endpoints usados no MVP (conferidos em docs.henrikdev.xyz em 2026-11-05, API v4.10):

| Uso | Endpoint |
|---|---|
| Validar Riot ID e obter puuid | `GET /valorant/v2/account/{name}/{tag}` |
| Histórico de partidas por puuid | `GET /valorant/v4/by-puuid/matches/{region}/{platform}/{puuid}?size=N` (máximo 10 por página; aceita `start` e `mode`) |
| Partida completa por id | `GET /valorant/v4/match/{region}/{match_id}` |
| Histórico de rank/RR | `GET /valorant/v2/by-puuid/mmr-history/{region}/{platform}/{puuid}` (últimas ~20 partidas competitivas; não existe versão v4) |
| Histórico de rank/RR armazenado | `GET /valorant/v2/by-puuid/stored-mmr-history/{region}/{platform}/{puuid}?size=N` (registros do próprio HenrikDev, vai mais longe; usado no backfill) |

Para o Brasil: `region = br`, `platform = pc`.

Observações confirmadas com respostas reais:

- O histórico v4 já devolve cada partida completa (metadados, times, os 10 jogadores, rounds e kills), com o mesmo conteúdo da rota de partida por id. O sync grava direto a partir do histórico e só usa a rota por id quando precisar de uma partida fora dele.
- O campo `region` da conta e da partida é o shard da Riot (`na` para contas do Brasil), não a afinidade usada nas URLs. Por isso `riot_accounts.region` guarda a afinidade (`br`) e não o valor que a API devolve.
- A conta v2 devolve o id do card (`card`), não a URL. A URL vem dos assets da comunidade: `https://media.valorant-api.com/playercards/{card}/smallart.png`.
- O modo vem em `metadata.queue.id` (`competitive`, `unrated`, `swiftplay`, `deathmatch`...). É esse valor que os filtros usam.

RR por partida (conferido em docs.henrikdev.xyz em 2026-11-06): cada item dos dois históricos de rank traz `match_id`, `tier`, `rr` (RR depois da partida) e `last_change` (RR ganho ou perdido nela), além de `refunded_rr` e `was_derank_protected`. A rota de partida v4 não traz RR, só o `tier` de cada jogador. Por isso o RR de uma partida vem de `mmr_snapshots`, ligado por (`puuid`, `match_id`): o sync busca o histórico ao entrar competitiva nova e, por até 6 horas, enquanto uma competitiva recente ainda não tiver RR; `pnpm rr:backfill` liga as partidas antigas (histórico armazenado primeiro, depois o ao vivo, só para contas com partida sem RR). Partida sem RR na API aparece com "—", nunca com valor estimado.

Custo de rate limit: cada chamada conta 1, mais 1 para cada busca que o servidor do HenrikDev precisar fazer na Riot (partidas já em cache no servidor deles não custam extra). Por isso, consultar o histórico com `size` pequeno e só buscar o que for novo.

Headers de rate limit em toda resposta: `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` (segundos até a janela reiniciar), além de `RateLimit` e `RateLimit-Policy` no formato do IETF. Em `429`, esperar `Retry-After` (ou `X-RateLimit-Reset`) antes de tentar de novo.

## 2. Modelo de dados

As tabelas de usuário e sessão são criadas pelo Better Auth.

**riot_accounts** — `id`, `user_id` (único, FK), `puuid` (único), `game_name`, `tag_line`, `region`, `platform`, `card_url`, `last_synced_at`, `last_match_at`, `sync_status` (`ok` | `error` | `pending`), `sync_error`

**matches** — `id` (match_id da Riot), `map_id`, `map_name`, `mode`, `queue_id`, `season_id`, `started_at`, `game_length_ms`, `rounds_played`, `red_score`, `blue_score`, `winning_team` (nulo em empate), `created_at`

**match_players** — PK (`match_id`, `puuid`), `game_name`, `tag_line`, `team`, `agent_id`, `agent_name`, `tier` (rank na partida), `kills`, `deaths`, `assists`, `score`, `damage_dealt`, `damage_received`, `headshots`, `bodyshots`, `legshots`, `won`

**mmr_snapshots** — `id`, `puuid`, `tier`, `tier_name`, `rr`, `rr_change`, `elo`, `match_id` (nullable), `recorded_at`

**groups** — `id`, `name`, `slug`, `owner_id`, `invite_code`, `discord_webhook_url` (criptografado em repouso), `created_at`

**group_members** — PK (`group_id`, `user_id`), `role` (`owner` | `member`), `joined_at`

**goals** (Fase 5) — `id`, `user_id` (FK), `metric` (`hs` | `acs` | `kd` | `adr` | `winrate` | `matches`), `target`, `created_at`, `updated_at`; único por (`user_id`, `metric`). Só o alvo é guardado; o progresso é calculado.

**weekly_summaries** (Fase 5) — PK (`group_id`, `week_start`), `status`, `provider` (`gemini` | `groq` | `rules`), `model`, `text`, `stats` (números agregados), `attempts`, `message_id`, `last_error`, `created_at`, `updated_at`, `sent_at`.

Índices: `match_players(puuid, match_id)`, `matches(started_at)`, `mmr_snapshots(puuid, recorded_at)`.

Guardar o JSON bruto da partida é opcional e fica desligado por padrão (ocupa muito espaço no plano gratuito do banco).

## 3. Fluxo de sincronização

1. Um agendador externo (cron-job.org ou GitHub Actions) chama `POST /api/cron/sync` a cada 10–15 minutos com `Authorization: Bearer CRON_SECRET`.
2. A rota pega as N contas com `last_synced_at` mais antigo (N pequeno, para caber no tempo máximo da função).
3. Para cada conta, consulta o histórico por puuid com `size` pequeno (5).
4. Descarta os `match_id` que já existem no banco. Para os novos, grava a partida e os 10 jogadores numa transação.
5. Se entrou partida competitiva nova (ou há competitiva das últimas 6 horas ainda sem RR), atualiza o histórico de rank (`mmr_snapshots`, um por partida, ligado pelo `match_id`).
6. Para cada grupo com webhook em que algum membro estava na partida nova, envia **um** card por partida (listando todos os membros do grupo que jogaram), nunca um card por membro.
7. Atualiza `last_synced_at`. Em caso de erro, grava `sync_status = error` e segue para a próxima conta.

Botão "Sincronizar agora" no dashboard, com cooldown de 2 minutos por conta.

Ao vincular uma conta, importar as partidas que a API retornar no histórico recente e mostrar o progresso na tela.

## 4. Telas do MVP

**Landing (`/`)** — o que é, uma prévia do dashboard com dados de exemplo e o botão "Entrar com Discord".

**Onboarding (`/onboarding`)** — campo `Nome#TAG`, validação em tempo real, prévia do card do jogador antes de confirmar, importação com progresso visível.

**Dashboard (`/me`)** — pergunta principal: "estou melhorando?"
- Cabeçalho com rank atual, RR e mini-gráfico da evolução.
- KPIs (ACS, K/D, HS%, ADR, win rate), cada um comparando as últimas 20 partidas com a média geral.
- Gráfico de tendência com seletor de métrica.
- Desempenho por agente (tabela) e por mapa (grade).
- Partidas recentes.
- Filtro de modo (padrão: competitivo) e de período.

- Seção "Agentes" (tabela ordenada por partidas: horas jogadas, V–D, win rate, K/D, ADR, ACS, HS%, DDΔ e melhor mapa; filtro de temporada; o melhor valor de cada coluna sublinhado e mais forte, não só por cor; em 390px vira cards com o resto expansível).
- "Últimas partidas": resumo das últimas 20 (V–D, win rate, K/D, ADR e os 3 agentes mais jogados), partidas agrupadas por dia com o saldo do dia (V/D e RR) e, em cada linha, agente, mapa, modo, rank na partida, RR ganho ou perdido, placar, posição no time por ACS, K/D/A, HS%, DDΔ e ACS. Filtros por agente e mapa e "carregar mais".

**Agente (`/me/agents/[agent]`)** — pergunta principal: "como eu jogo com esse agente?" KPIs com a variação em relação à média com todos os agentes, evolução partida a partida, desempenho por mapa (com o melhor mapa) e as partidas com ele. Filtros de modo e temporada.

**Partida (`/match/[id]`)** — pergunta principal: "como foi essa partida?" Resultado, mapa, placar, data e duração; placar completo dos dois times com a linha do usuário destacada, o rank de cada jogador naquela partida e o RR ganho ou perdido só para quem usa o Retake; badges de "jogou com" para membros dos seus grupos.

**Grupos (`/groups`, `/groups/[slug]`)** — pergunta principal: "quem mandou bem essa semana?" Ranking semanal com seletor de métrica, destaque de MVP da semana, partidas que membros jogaram juntos, convite por link e configuração do webhook do Discord (só o dono).

**Perfil de membro (`/groups/[slug]/members/[userId]`)** — as seções "Agentes" e "Últimas partidas" de um membro, visíveis só para quem está no mesmo grupo (quem não está recebe o mesmo 404 de um grupo inexistente). As partidas abrem o placar só quando quem está vendo também jogou.

**Configurações (`/settings`)** — conta Riot vinculada, status do último sync e opção de desvincular (apagando os dados do usuário).

## 5. Fases

Cada fase termina com lint, typecheck e testes passando, verificação visual pelo Playwright MCP nas telas tocadas e um `/audit` do Impeccable.

**Fase 0 — Fundação.** Projeto Next.js com TypeScript, Tailwind, shadcn/ui, Drizzle, ESLint, Vitest e Playwright. Tokens do DESIGN.md aplicados (cores, tipografia, espaçamento, raio, sombras e o mapeamento para as variáveis do shadcn) e uma página de amostra com os componentes base: botões, input, card de KPI, linha de partida, chips de resultado, tabela e gráfico.
*Pronto quando:* `pnpm dev` sobe e a página de amostra segue o DESIGN.md em 1440px e 390px.

**Fase 1 — Dados.** Cliente HenrikDev com Zod e rate limiter, schema do banco com migrations, lógica de sync em `src/lib/sync/`, funções de métricas em `src/lib/stats/` com testes e o script `pnpm sync:once`.
*Pronto quando:* `pnpm sync:once "Nome#TAG"` grava as partidas no banco, rodar de novo não duplica nada e os testes de métricas passam.

**Fase 2 — Produto pessoal.** Login com Discord, onboarding, dashboard, página da partida e a rota `/api/cron/sync`.
*Pronto quando:* um usuário novo entra, vincula a conta, vê o dashboard preenchido e uma partida nova aparece sozinha após o próximo sync.

**Fase 3 — Grupos.** Criar grupo, convidar por link, ranking semanal, MVP da semana e partidas juntos.
*Pronto quando:* dois usuários no mesmo grupo veem o ranking correto e a partida que jogaram juntos aparece marcada.

**Fase 4 — Discord e lançamento.** Webhook com card da partida, landing finalizada, deploy na Vercel e agendador externo configurado.
*Pronto quando:* jogar uma partida resulta, em até ~15 minutos, num card no servidor do grupo.

**Fase 5 — Pós-MVP.** Insights automáticos, comparação 1x1, metas pessoais e resumo semanal com IA.

## 6. Ideias futuras (fora do escopo atual)

- **Multikills** (2K, 3K, 4K, ás por partida e por agente): exigem ler os eventos de kill de cada round, que o sync hoje não guarda.
- **Nota própria de desempenho** (no estilo do TRS do Tracker.gg): uma pontuação única por partida combinando várias métricas. Só faz sentido com uma fórmula aberta, documentada aqui e testada, para não virar caixa-preta.
- KAST e métricas por round, já listadas como fora do MVP.
