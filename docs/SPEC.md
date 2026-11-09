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
- A partida v4 traz `rounds[]` (vencedor, motivo e, por jogador, `damage_events`, economia com a arma comprada e o valor do equipamento) e `kills[]` (round, `time_in_round_in_ms`, quem matou, quem morreu, assistências e arma). Até a Fase 8 o sync ignora esses campos; a Fase 9 passa a gravá-los (§7). Confira os nomes exatos numa resposta real antes de escrever o schema Zod.
- O modo vem em `metadata.queue.id` (`competitive`, `unrated`, `swiftplay`, `deathmatch`...). É esse valor que os filtros usam.

RR por partida (conferido em docs.henrikdev.xyz em 2026-11-06): cada item dos dois históricos de rank traz `match_id`, `tier`, `rr` (RR depois da partida) e `last_change` (RR ganho ou perdido nela), além de `refunded_rr` e `was_derank_protected`. A rota de partida v4 não traz RR, só o `tier` de cada jogador. Por isso o RR de uma partida vem de `mmr_snapshots`, ligado por (`puuid`, `match_id`): o sync busca o histórico ao entrar competitiva nova e, por até 6 horas, enquanto uma competitiva recente ainda não tiver RR; `pnpm rr:backfill` liga as partidas antigas (histórico armazenado primeiro, depois o ao vivo, só para contas com partida sem RR). Partida sem RR na API aparece com "—", nunca com valor estimado.

Custo de rate limit: cada chamada conta 1, mais 1 para cada busca que o servidor do HenrikDev precisar fazer na Riot (partidas já em cache no servidor deles não custam extra). Por isso, consultar o histórico com `size` pequeno e só buscar o que for novo.

Headers de rate limit em toda resposta: `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` (segundos até a janela reiniciar), além de `RateLimit` e `RateLimit-Policy` no formato do IETF. Em `429`, esperar `Retry-After` (ou `X-RateLimit-Reset`) antes de tentar de novo.

## 2. Modelo de dados

As tabelas de usuário, sessão e contas de login são criadas pelo Better Auth. `accounts` tem uma linha por provedor (`discord`, `google`) ligada ao mesmo `user_id`.

**riot_accounts** — `id`, `user_id` (único, FK), `puuid` (único), `game_name`, `tag_line`, `region`, `platform`, `card_url`, `last_synced_at`, `last_match_at`, `sync_status` (`ok` | `error` | `pending`), `sync_error`

**matches** — `id` (match_id da Riot), `map_id`, `map_name`, `mode`, `queue_id`, `season_id`, `started_at`, `game_length_ms`, `rounds_played`, `red_score`, `blue_score`, `winning_team` (nulo em empate), `created_at`

**match_players** — PK (`match_id`, `puuid`), `game_name`, `tag_line`, `team`, `agent_id`, `agent_name`, `tier` (rank na partida), `kills`, `deaths`, `assists`, `score`, `damage_dealt`, `damage_received`, `headshots`, `bodyshots`, `legshots`, `won`

**mmr_snapshots** — `id`, `puuid`, `tier`, `tier_name`, `rr`, `rr_change`, `elo`, `match_id` (nullable), `recorded_at`

**groups** — `id`, `name`, `slug`, `owner_id`, `invite_code`, `discord_webhook_url` (criptografado em repouso), `created_at`

**group_members** — PK (`group_id`, `user_id`), `role` (`owner` | `member`), `joined_at`

**goals** (Fase 5) — `id`, `user_id` (FK), `metric` (`hs` | `acs` | `kd` | `adr` | `winrate` | `matches`), `target`, `created_at`, `updated_at`; único por (`user_id`, `metric`). Só o alvo é guardado; o progresso é calculado.

**user_preferences** — PK `user_id` (FK users, cascade), `break_reminder` (padrão `true`), `updated_at`. Sem linha = padrões; a linha nasce quando o usuário muda um ajuste.

**profile_settings** (Fase 8, §6) — PK `user_id` (FK users, cascade), `is_public` (padrão `false`), `show_rank`, `show_overview`, `show_agents`, `show_maps`, `show_matches`, `show_weapons` (booleanos, padrão `true`, só valem com `is_public`), `decided_at` (quando o usuário escolheu; nulo = ainda não perguntado), `updated_at`. Sem linha = privado e ainda não perguntado.

**Rounds (Fase 9, §7).**

- **match_rounds** — PK (`match_id`, `round`), `winning_team`, `result` (motivo: eliminação, spike, desarme, tempo), `attacking_team` (lado de ataque daquele round, derivado da metade e da prorrogação).
- **match_round_players** — PK (`match_id`, `round`, `puuid`), `team`, `weapon_id`, `weapon_name` (arma comprada no round, pode ser nula), `armor`, `loadout_value`, `spent`, `damage`, `headshots`, `bodyshots`, `legshots`, `kills`, `assists`, `survived`.
- **match_kills** — PK (`match_id`, `round`, `seq`), `time_in_round_ms`, `killer_puuid` (nulo em morte sem autor, ex.: queda), `victim_puuid`, `assistants` (array de puuid), `weapon_id`, `weapon_name`, `weapon_type`.
- **matches** ganha `rounds_synced_at`: nulo nas partidas gravadas antes da Fase 9, preenchido quando os rounds foram gravados. Tudo cascata a partir de `matches`.

**weekly_summaries** (Fase 5) — PK (`group_id`, `week_start`), `status`, `provider` (`gemini` | `groq` | `rules`), `model`, `text`, `stats` (números agregados), `attempts`, `message_id`, `last_error`, `created_at`, `updated_at`, `sent_at`.

**Bagre (Fase 6, §5).** As tabelas são genéricas ("premiações" do grupo) para receber novas categorias e clipes sem migração de dados; hoje só existe a categoria `bagre`.

- **groups** ganha `bagre_enabled` (padrão `true`) e `bagre_cadence` (`weekly` | `daily`, padrão `weekly`).
- **award_rounds** — um período de votação: `id`, `group_id` (FK), `category` (`bagre`), `cadence` (a do grupo quando o período abriu), `starts_at`, `ends_at` (intervalo meio-aberto), `status` (`open` | `closed`), `outcome` (`winner` | `tie` | `no_votes` | `empty` | `disabled`, nulo enquanto aberto), `winner_user_id`, `winner_nomination_id`, `tally` (contagem congelada no encerramento: indicação, indicado, votos e partidas no período), `votes_cast`, `badge_until`, `closed_at`, `announce_status` (`queued` | `sending` | `sent` | `failed`, nulo quando não há o que postar), `announce_attempts`, `message_id`, `last_error`, `created_at`, `sent_at`. Único por (`group_id`, `category`, `starts_at`).
- **award_nominations** — `id`, `round_id` (FK), `nominee_id` (FK users), `nominator_id` (FK users, nulo se a conta for apagada), `match_id` (FK matches), `comment` (1–140 caracteres), `created_at`. Único por (`round_id`, `nominee_id`); `nominee_id <> nominator_id` garantido por CHECK.
- **award_votes** — PK (`round_id`, `voter_id`), `nomination_id`, `nominee_id`, `created_at`, `updated_at`. FK composta (`nomination_id`, `round_id`, `nominee_id`) → `award_nominations`, para o voto nunca apontar para outro período nem mentir sobre o indicado; `voter_id <> nominee_id` garantido por CHECK.

Índices: `match_players(puuid, match_id)`, `matches(started_at)`, `mmr_snapshots(puuid, recorded_at)`, `match_round_players(puuid, match_id)`, `match_kills(killer_puuid)`, `match_kills(victim_puuid)`, e na Fase 8 um índice para buscar `riot_accounts` por nome sem diferenciar maiúsculas.

Guardar o JSON bruto da partida é opcional e fica desligado por padrão (ocupa muito espaço no plano gratuito do banco).

## 3. Fluxo de sincronização

1. Um agendador externo (cron-job.org ou GitHub Actions) chama `POST /api/cron/sync` a cada 10–15 minutos com `Authorization: Bearer CRON_SECRET`.
2. A rota pega as N contas com `last_synced_at` mais antigo (N pequeno, para caber no tempo máximo da função).
3. Para cada conta, consulta o histórico por puuid com `size` pequeno (5).
4. Descarta os `match_id` que já existem no banco. Para os novos, grava a partida e os 10 jogadores numa transação (a partir da Fase 9, junto com rounds e abates, na mesma transação).
5. Se entrou partida competitiva nova (ou há competitiva das últimas 6 horas ainda sem RR), atualiza o histórico de rank (`mmr_snapshots`, um por partida, ligado pelo `match_id`).
6. Para cada grupo com webhook em que algum membro estava na partida nova, envia **um** card por partida (listando todos os membros do grupo que jogaram), nunca um card por membro.
7. Atualiza `last_synced_at`. Em caso de erro, grava `sync_status = error` e segue para a próxima conta.

Antes das contas, a mesma rota encerra os períodos do Bagre vencidos e posta o resultado (§5.6).

Botão "Sincronizar agora" no dashboard, com cooldown de 2 minutos por conta.

Ao vincular uma conta, importar as partidas que a API retornar no histórico recente e mostrar o progresso na tela.

## 4. Telas do MVP

**Landing (`/`)** — o que é, uma prévia do dashboard com dados de exemplo, o botão "Entrar" (ação principal) e a busca de perfis públicos (§6).

**Entrar (`/login`)** — "Entrar com Google" e "Entrar com Discord", com o mesmo peso visual; volta para a página pedida depois do login. Uma linha explica que dá para vincular a outra conta depois em Configurações.

**Onboarding (`/onboarding`)** — campo `Nome#TAG`, validação em tempo real, prévia do card do jogador antes de confirmar, importação com progresso visível. Depois do Riot ID, o passo "Seu perfil" (§6.2) pergunta se o perfil é público e o que aparece.

**Dashboard (`/me`)** — pergunta principal: "estou melhorando?"
- No topo, card "Sessão de hoje" quando a última sessão está em andamento (última partida terminou há até 2 horas) ou terminou hoje: partidas, V–D na ordem jogada, RR conhecido (com quantas competitivas ainda estão sem RR), ACS médio (avisando se mistura modos) e o melhor jogo (maior ACS) com link. Sessão é por tempo, todos os modos.
- Aviso de pausa: com a sessão em andamento e 3 ou mais derrotas seguidas no fim dela (empate ou vitória zera), o card mostra um aviso leve sugerindo uma pausa, sem tom de bronca e sem vermelho. Fechar esconde até o fim daquela sessão (cookie com o id da primeira partida); "Aviso de pausa" em Ajustes desliga de vez (`user_preferences.break_reminder`).
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

**Com quem você joga melhor (`/me` e `/groups/[slug]`)** — pergunta: "com quem eu vou melhor?" Ranking das duplas do usuário com outros usuários do Retake de grupos em comum (no grupo, só os membros dele): win rate juntos no mesmo time versus a média do usuário no modo, partidas, V–D, K/D e ACS, e o link para o histórico filtrado (`/me?with=<userId>`, validado no servidor). Mínimo de 3 partidas juntos; abaixo de 10, aviso de amostra pequena. Texto de tendência, nunca de veredito. Jogadores de fora nunca aparecem.

**Perfil de membro (`/groups/[slug]/members/[userId]`)** — as seções "Agentes" e "Últimas partidas" de um membro, visíveis só para quem está no mesmo grupo (quem não está recebe o mesmo 404 de um grupo inexistente). As partidas abrem o placar só quando quem está vendo também jogou.

**Configurações (`/settings`)** — conta Riot vinculada, status do último sync, o liga/desliga do aviso de pausa e opção de desvincular (apagando os dados do usuário). "Contas de login": Google e Discord com o estado de cada um, botão para vincular a que falta e para desvincular (só se sobrar outra; nunca deixa o usuário sem login). "Perfil público" (Fase 8): o mesmo controle do onboarding, com link para ver o próprio perfil como um visitante vê.

**Bagre (`/groups/[slug]/bagre`)** — pergunta principal: "quem foi o Bagre?" Ver §5.

## 5. Bagre do grupo

Votação bem-humorada da pior atuação do período, só entre membros do grupo. O tom é de zoeira entre amigos, nunca de humilhação: textos leves, nada de ranking de "piores", e nenhuma informação além do que o grupo já vê (a linha do próprio membro na partida: agente, mapa, placar, K/D/A e ACS).

### 5.1 Período

- **Semanal** (padrão): segunda 00:00 a domingo 23:59:59 no fuso `America/Sao_Paulo`. **Diário**: 00:00 a 23:59:59 no mesmo fuso. Intervalos meio-abertos `[início, fim)`.
- O período é criado quando alguém do grupo abre a tela do Bagre (ou age nela) e ainda não existe um que cubra o momento atual. Dois pedidos ao mesmo tempo não criam dois: o único por (`group_id`, `category`, `starts_at`) resolve.
- Trocar a frequência vale **a partir do próximo período**; o atual termina na data em que terminaria. Um período nunca começa antes do fim do anterior (de diário para semanal numa quinta, o semanal vai de quinta a domingo), então nenhum dia pertence a dois períodos.
- O dono do grupo liga e desliga o Bagre e escolhe a frequência em Ajustes do grupo. Desligado, a tela mostra que está desligado, nada pode ser indicado nem votado, e o período aberto encerra sem resultado (`disabled`). Religar antes do fim retoma o período com as indicações e votos que já tinha.

### 5.2 Candidatos sugeridos

Calculados na hora a partir das partidas **competitivas** do período (o texto diz isso), só dos membros com Riot ID. Até 3 sugestões, **uma por pessoa**, nesta ordem de critério (função pura `suggestCandidates` em `src/lib/stats/bagre.ts`):

1. **Menor ACS médio** — entre quem jogou o mínimo de partidas (3 no semanal, 2 no diário) e com pelo menos 2 pessoas nessa condição. Liga à partida de menor ACS da pessoa. Ex.: "ACS médio 142 em 4 competitivas; a pior foi 98 na Lotus".
2. **Partida pra esquecer** — menor K/D numa partida (até 0,75). Desempate: mais mortes, menor ACS, mais recente. Ex.: "K/D 0,31 (4/13/2) de Jett na Lotus".
3. **Derrota pesada** — maior diferença de rounds numa derrota (pelo menos 6). Desempate: menor ACS, mais recente. Ex.: "Perdeu de 3 a 13 na Lotus, com ACS 98".

Quem já foi escolhido por um critério não aparece de novo; o critério seguinte pega a próxima pessoa que o atende. Sugestão é só atalho: ela vira indicação apenas quando alguém indica.

### 5.3 Indicações

- Qualquer membro indica **outro** membro (nunca a si mesmo), ligando a indicação a uma partida **do período** em que o indicado jogou (qualquer modo; o modo aparece junto) e com um comentário de 1 a 140 caracteres (uma linha).
- **Uma indicação por indicado por período**: se alguém já indicou a pessoa, a tela mostra a indicação existente para votar nela.
- Quem indicou pode retirar a indicação enquanto o período está aberto; os votos nela são apagados e quem votou pode votar de novo.

### 5.4 Votação

- Um voto por membro por período, em qualquer indicação que não seja a própria. Dá para trocar o voto até o fim do período.
- A contagem só aparece para quem já votou, ou para todos depois do encerramento. Antes disso, o servidor não envia os números (nem a ordem por votos) para o navegador; a tela mostra só quantos membros já votaram.
- O voto é secreto: ninguém vê em quem cada um votou.

### 5.5 Regras de acesso

Toda leitura e escrita parte da sessão e confere no banco, nunca no que o navegador manda:

- A tela e os dados existem só para membros do grupo; para os outros, o mesmo 404 de um grupo que não existe.
- Indicar: quem indica é membro; o indicado é membro **do mesmo grupo**, tem Riot ID e jogou a partida; a partida começou dentro do período; o período está aberto **e** o relógio ainda não passou do fim (o cron pode demorar alguns minutos para fechar); o Bagre está ligado.
- Votar: o grupo vem da indicação no banco, não do pedido; quem vota é membro, não é o indicado, e o período está aberto e dentro do prazo.
- Retirar: só quem indicou, com o período aberto.
- Configurar: só o dono.
- Quem sai do grupo deixa de contar: indicações para ele e votos dele são ignorados na tela e no encerramento.
- Server Actions com entrada validada por Zod; IDs malformados recebem a mesma resposta de "não encontrado".

### 5.6 Encerramento

Pela rota `/api/cron/sync`, antes do sync das contas, para cada período aberto com `ends_at` vencido:

1. Conta os votos válidos (membros atuais, indicados ainda membros).
2. Decide o resultado (função pura `decideBagre`):
   - sem indicações → `empty`; com indicações e nenhum voto → `no_votes` (ninguém leva o selo);
   - mais votado → `winner`;
   - empate nos votos → fica quem jogou **menos partidas no período** (todos os modos); persistindo, **empate declarado** (`tie`), sem selo.
3. Fecha o período com um `UPDATE … WHERE status = 'open'`: duas rodadas ao mesmo tempo nunca fecham duas vezes. A contagem fica congelada em `tally`.
4. O Bagre ganha o selo **"Bagre da Semana"** ou **"Bagre do Dia"** até o fim do período seguinte (`badge_until`), visível na tela do Bagre, na lista de membros do grupo e no perfil do membro (para quem é do grupo).
5. Se o grupo tem webhook e houve vencedor ou empate, posta **uma** mensagem no Discord com quem foi, o comentário da indicação, a partida (mapa, placar, agente, K/D/A e ACS do indicado) com o link e quantos votos. O envio segue o padrão dos outros cards: `queued` → `sending` (por `UPDATE` atômico) → `sent`; `sending` nunca é reenviado (melhor faltar do que duplicar); falhas temporárias tentam de novo nas próximas rodadas, até 3 vezes e por até 2 dias.

Rodar o encerramento duas vezes não muda nada nem posta de novo. `pnpm bagre:once <slug>` mostra o que seria anunciado e pode mandar para um webhook de teste.

### 5.7 Telas

- **Grupo (`/groups/[slug]`)**: um card "Bagre" com o selo atual (se houver), quantos indicados e votos tem o período e o link para a tela do Bagre; o selo aparece também ao lado do nome na lista de membros.
- **Bagre (`/groups/[slug]/bagre`)**: resultado do último período (revelado com animação na primeira vez), período atual com prazo, indicados com o voto e a contagem (quando liberada), sugestões, botão de indicar e o histórico (quem foi, quando, por quê, com quantos votos; empates e períodos sem votos também aparecem).
- **Ajustes do grupo**: ligar/desligar e frequência (só o dono).
- **Perfil de membro**: o selo, quando vigente.
- Estados: carregamento com o formato da tela, vazio ("Ninguém foi indicado ainda, que tal começar?"), Bagre desligado e erro com como resolver.

## 6. Perfil público (Fase 8)

Pergunta principal de quem visita: "como essa pessoa joga?". O diferencial continua sendo o social; o perfil público é a porta de entrada para quem ainda não usa o Retake e o jeito de ver um amigo de fora dos seus grupos.

### 6.1 Quem tem perfil

- Só **usuários do Retake com Riot ID vinculado e `is_public = true`**. Jogadores que não são usuários nunca têm página, não aparecem na busca e não viram link no placar.
- O padrão é **privado**. Ficar privado vale na hora: a página passa a responder o mesmo 404 de um perfil que não existe, e a pessoa some da busca.
- **Nunca aparece** num perfil público: grupos, Bagre (indicações, votos, selo), duplas/sinergia, metas, sessão de hoje e o resumo semanal.
- Sem nada "ao vivo": nem "jogando agora", nem partida em andamento, nem consulta de partida pelo id do adversário (regra de anti-scouting do CLAUDE.md).
- Páginas de perfil e busca com `robots: noindex`: o perfil é para ser compartilhado, não indexado.

### 6.2 Escolha no cadastro

- Passo "Seu perfil" no onboarding, depois do Riot ID. Duas opções com o mesmo peso, **sem nenhuma pré-selecionada**: "Público" e "Privado", cada uma com uma frase do que significa.
- Em "Público", a lista do que aparece, todas ligadas por padrão e com uma prévia ao lado: rank e RR, visão geral (KPIs e tendência), agentes, mapas, últimas partidas e armas (quando a Fase 9 existir). Desmarcar tudo é o mesmo que privado e a tela diz isso.
- Grava `decided_at`. Usuários antigos (sem `decided_at`) veem a mesma pergunta uma vez, num card no topo do `/me`, que dá para adiar; enquanto não escolhem, continuam privados.
- Tudo muda depois em Configurações.

### 6.3 Página `/u/[riotId]`

- Endereço `Nome-TAG` (o último hífen separa a tag; nome com espaço ou acento vai codificado). Resolve pelo Riot ID atual em `riot_accounts` de **usuários**; quem trocou de nome muda de endereço, e o endereço antigo dá 404. Internamente tudo continua por `puuid`/`user_id`.
- Funciona **sem login**. Mostra só os campos escolhidos, com o filtro de modo (padrão competitivo) como no `/me`.
- As últimas partidas mostram só a linha do próprio jogador (agente, mapa, placar, K/D/A, ACS, resultado). Elas só viram link para o placar completo quando quem está vendo também jogou aquela partida, como no perfil de membro.
- Visitante sem login vê um convite discreto para entrar; usuário logado vê o próprio cabeçalho do app.
- Estados: carregamento, perfil sem partidas no modo, 404 (perfil privado ou inexistente, mesma mensagem) e erro.

### 6.4 Busca

- Campo na landing, no cabeçalho do app e em `/search?q=`. Busca pelo nome do Riot ID (com ou sem `#TAG`), sem diferenciar maiúsculas e acentos, a partir de 3 caracteres, até 10 resultados (card do jogador, Riot ID e rank se `show_rank`).
- Só entre perfis públicos. "Nenhum perfil público com esse nome" é a resposta tanto para quem não existe quanto para quem é privado ou não é usuário.
- Limite simples por IP na rota de busca para não virar raspagem.

### 6.5 Links a partir do app

- No placar (`/match/[id]`), o nome vira link para `/u/...` só se o jogador for usuário com perfil público. Para membros dos seus grupos, o link continua indo para o perfil de membro (que mostra mais).
- Na busca e no perfil, nada indica se a pessoa está em algum grupo.

## 7. Rounds, armas e economia (Fase 9)

Os dados já vêm na resposta da partida v4 (§1); o que muda é gravar e calcular. Métricas são calculadas das tabelas de rounds (§2), nunca guardadas prontas. Fórmulas no CLAUDE.md.

### 7.1 Sync e backfill

- O sync grava `match_rounds`, `match_round_players` e `match_kills` na mesma transação da partida e preenche `rounds_synced_at`.
- `pnpm rounds:backfill` busca de novo, pela rota de partida por id, as partidas com `rounds_synced_at` nulo, passando pela fila de rate limit (é a única parte que gasta requisições extras, uma vez por partida antiga). O padrão é só partidas com usuário do Retake; `--all` inclui as outras.
- Campos que faltarem num round (ex.: arma nula, economia ausente em modos sem compra) ficam nulos e a métrica que depende deles ignora o round, avisando a amostra na UI.
- Contrato v4 conferido no OpenAPI da HenrikDev em 2026-11-09: a economia por round traz `loadout_value`, `remaining`, arma e armadura, mas não traz `spent`; por isso `spent` fica nulo, sem estimativa.
- Modos sem economia (deathmatch, team deathmatch) não entram nas métricas de economia nem de clutch.

### 7.2 Métricas

- **First blood / first death** por partida e no total (contagem e % dos rounds).
- **Multi-kills**: 3K, 4K e ás por partida e no total.
- **Clutch 1vX**: situações e vitórias por X (1v1 a 1v5).
- **KAST** por partida e na média (janela de troca: 5 s).
- **Economia do round**, pela média do `loadout_value` do time no início do round: eco abaixo de 2.000, compra parcial/force de 2.000 a 3.899, compra completa a partir de 3.900. Confirme as faixas com dados reais antes de fechar e registre aqui se mudarem. Win rate e ACS por faixa; pistol (primeiro round de cada metade) aparece separado.
- **Ataque/defesa**: win rate dos rounds de cada lado, por mapa.
- **Armas**: abates por arma (exato) e HS% por arma (aproximado, pelos tiros dos rounds em que aquela arma foi comprada; a UI diz "aproximado: pela arma comprada no round"). Mostra só armas com pelo menos 10 abates ou 100 tiros no período; abaixo disso, em segundo plano com aviso de amostra.

### 7.3 Telas

- **`/me`**: seção "Armas" (tabela: arma, abates, HS% aproximado, partidas; em 390px vira lista) e seção "Rounds" (FB/FD, KAST, multi-kills, clutches, ataque × defesa, economia). Mesmos filtros de modo e período.
- **Agente e perfil de membro**: as mesmas métricas filtradas, onde couberem sem poluir.
- **Partida**: colunas FB, FD, KAST e multi-kill no placar; uma faixa com os rounds (vitória/derrota com ícone e texto, lado, tipo de compra) e, ao abrir um round, os abates em ordem.
- **Grupo**: o ranking semanal ganha as métricas first bloods, clutches e ases.
- **Perfil público**: a seção "Armas" quando `show_weapons`.
- Cards do Discord ficam para depois (fase própria).

## 8. Fases

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

**Fase 6 — Social.** Bagre do grupo (§5).
*Pronto quando:* membros indicam, votam e trocam o voto; o cron encerra o período uma única vez, dá o selo e posta o resultado no Discord.

**Fase 7 — Contas de login.** Login com Google além do Discord, tela `/login`, vinculação e desvinculação das duas contas em Configurações (§4). O nome mostrado no app passa a ser o do Riot ID quando existir, e o do provedor só como reserva (hoje o código chama isso de `discordName`).
*Pronto quando:* um usuário novo entra pelo Google, vincula o Discord (e vice-versa), entra pelos dois e cai no mesmo usuário, e não consegue desvincular o único login que resta.

**Fase 8 — Perfil público.** Escolha no onboarding e em Configurações, página `/u/[riotId]`, busca e links no placar (§6).
*Pronto quando:* um visitante sem login acha um perfil público pela busca e vê só os campos escolhidos; um perfil privado e um jogador que não é usuário dão a mesma resposta de "não encontrado"; trocar para privado esconde na hora.

**Fase 9 — Rounds, armas e economia.** Gravar rounds e abates, backfill e as métricas e telas do §7.
*Pronto quando:* uma partida nova chega com rounds, o backfill completa as antigas sem estourar o rate limit, e as métricas batem com uma partida conferida à mão nos testes.

## 9. Ideias futuras (fora do escopo atual)

- **Clipes nas indicações**: uma indicação poderá ganhar um clipe. O modelo já comporta: uma tabela `award_clips` (`id`, `nomination_id` FK → `award_nominations` com cascade, `provider`, `url` validada por lista de hosts, `added_by`, `created_at`) liga 0 ou mais clipes a uma indicação sem mexer nas tabelas atuais. Upload próprio fica fora; só links de serviços conhecidos, mostrados com o mesmo controle de acesso da indicação.
- **Jogada da semana** e outras categorias: novo valor no enum `award_category` (ex.: `play_of_week`) e uma linha em `award_rounds` por categoria e período. Indicações, votos, encerramento e histórico já são por `round_id`; o que muda por categoria é o texto, as sugestões e se há selo.

- **Nota própria de desempenho** (no estilo do TRS do Tracker.gg): uma pontuação única por partida combinando várias métricas. Só faz sentido com uma fórmula aberta, documentada aqui e testada, para não virar caixa-preta.
- **Cards do Discord repensados**: formato, frequência (ex.: um card por sessão em vez de um por partida) e preferências por membro. A definir.
