# Retake — guia do projeto

> Tracker de desempenho de Valorant para grupos de amigos.
> Escopo completo, telas, modelo de dados e fases: `docs/SPEC.md`. Leia antes de começar qualquer fase.

## O que o produto faz

O usuário entra com a conta do Google ou do Discord (e pode vincular as duas) e vincula o próprio Riot ID. Um processo de sincronização busca as partidas novas periodicamente e salva tudo no nosso banco. O app mostra a evolução pessoal (rank, ACS, K/D, HS%, ADR, win rate, desempenho por mapa e agente), a página de cada partida e grupos de amigos com ranking semanal. Depois de cada partida, um card é postado no Discord do grupo.

O diferencial em relação ao Tracker.gg é o lado social: grupos, rankings internos e "partidas que jogamos juntos". Priorize isso nas decisões de produto.

## Stack

- **Next.js** (versão estável mais recente, App Router) + **TypeScript** em modo `strict`
- **Tailwind CSS** + **shadcn/ui**; componentes do 21st.dev entram pelo CLI do shadcn ou pelo MCP do 21st
- **Recharts** via componentes de chart do shadcn
- **PostgreSQL** (Neon ou Supabase) + **Drizzle ORM** com migrations versionadas
- **Better Auth** com login via Google e Discord (as duas contas podem ser vinculadas ao mesmo usuário)
- **Zod** para validar toda resposta da API externa
- **Vitest** para testes unitários e **Playwright** para e2e e verificação visual
- **pnpm** como gerenciador de pacotes
- Deploy na **Vercel**. A sincronização roda numa rota protegida (`/api/cron/sync`) acionada por um agendador externo, porque o cron do plano Hobby da Vercel só roda uma vez por dia.

## Estrutura de pastas

```
src/
  app/
    (marketing)/page.tsx           landing
    (app)/onboarding/              vincular Riot ID
    (app)/me/                      dashboard pessoal (agentes, últimas partidas)
    (app)/me/agents/[agent]/       página de um agente
    (app)/match/[id]/              página da partida
    (app)/groups/                  lista de grupos
    (app)/groups/[slug]/           grupo: ranking, partidas juntos, config
    (app)/groups/[slug]/members/[userId]/  perfil de um membro (só para o mesmo grupo)
    (app)/groups/[slug]/bagre/     Bagre: indicações, votação, resultado e histórico
    (app)/settings/
    (public)/u/[riotId]/           perfil público opt-in (sem login; só quem ativou)
    (public)/search/               busca de perfis públicos
    api/cron/sync/route.ts         sincronização (protegida por CRON_SECRET)
    api/auth/[...all]/route.ts     Better Auth
  db/
    schema.ts                      tabelas Drizzle
    index.ts                       cliente
  lib/
    henrik/                        cliente HTTP, schemas Zod, rate limiter
    sync/                          lógica de sincronização (independente do Next)
    rounds/                        leitura dos rounds e abates da partida (first blood, clutch, multi-kill, KAST, economia, arma)
    profile/                       perfil público: preferências, campos visíveis e regras de acesso
    stats/                         funções puras de métricas (100% testadas): agentes, histórico por dia, candidatos do Bagre, sinergia de duo, sessões
    discord/                       montagem e envio de cards por webhook
    ai/                            provedores de texto (Gemini, Groq) com fallback em cadeia
    summary/                       resumo semanal: números por código, texto por IA ou regras
    goals/                         metas pessoais da semana
    bagre/                         Bagre do grupo: períodos, indicações, votos, encerramento e card
  components/
    ui/                            shadcn (não editar à mão sem necessidade)
    stats/, match/, groups/        componentes do produto
scripts/
  sync-once.ts                     sincroniza um Riot ID pelo terminal (debug)
docs/
  SPEC.md
DESIGN.md                          fonte da verdade visual
```

## Regras de dados (não negociáveis)

- Identifique jogadores sempre pelo **puuid**. Nome e tag mudam; o puuid não.
- A API do HenrikDev é chamada **somente no servidor**. A chave fica em variável de ambiente e nunca chega ao client.
- Toda resposta externa passa por um schema **Zod** antes de tocar no banco. Campos desconhecidos são ignorados, não quebram o sync.
- Cada partida é salva **uma única vez** (upsert por `match_id`), junto com os 10 jogadores.
- Métricas são **calculadas** a partir de `match_players`, nunca digitadas ou armazenadas prontas no MVP.
- Toda estatística é filtrável por modo; o padrão é **competitivo**. Nunca misture modos numa média sem deixar isso explícito na UI.
- **Rate limit:** o cliente HenrikDev passa por uma fila com teto de ~20 req/min (o limite da chave Basic é 30, deixamos folga). Leia os headers de rate limit, e em caso de 429 espere o `Retry-After` antes de tentar de novo. Nunca faça laços de retry sem espera.
- **Privacidade:** cada usuário vincula só a própria conta e grupos são por convite. Jogadores que não são usuários aparecem apenas no placar de uma partida; não crie perfis, buscas ou páginas para eles.
- **Perfil público é opt-in** (SPEC §6): só usuários do Retake que escolheram ser públicos têm página em `/u/...` e aparecem na busca, e só com os campos que escolheram mostrar. O padrão é privado. Grupos, Bagre e duplas nunca aparecem num perfil público. A busca nunca encontra quem não é usuário nem quem é privado: o resultado é o mesmo de um nome que não existe.
- **Proibido:** qualquer feature de scouting (estatísticas de adversários antes ou durante uma partida).

### Fórmulas

- ACS = `score / rounds_played`
- K/D = `kills / max(deaths, 1)`
- KDA = `(kills + assists) / max(deaths, 1)`
- HS% = `headshots / (headshots + bodyshots + legshots)`
- ADR = `damage_dealt / rounds_played`
- Win rate = vitórias / partidas (empates contam como não-vitória e aparecem separados)
- DDΔ (saldo de dano por round) = `(damage_dealt − damage_received) / rounds_played`. Positivo quando você causa mais dano do que recebe; somado no volume (total causado − total recebido) / total de rounds, como as outras médias
- Horas jogadas = soma de `game_length_ms` das partidas com duração conhecida
- Melhor mapa (de um agente) = maior win rate entre os mapas com pelo menos 3 partidas; empate vai para o mapa com mais partidas. Sem mapa com 3 partidas, mostra "—"
- Sessão = partidas seguidas com até 2 horas entre o fim de uma (`started_at + game_length_ms`) e o início da próxima. É por tempo, não por modo; médias de uma sessão com mais de um modo dizem isso na UI. RR da sessão = soma do RR conhecido das competitivas, com aviso das que ainda não têm RR
- Sinergia de duo = win rate, K/D e ACS **do usuário** nas partidas em que outro usuário do Retake de um grupo em comum estava no mesmo time, comparados com a média do usuário no mesmo modo. Aparece a partir de 3 partidas juntos; abaixo de 10, com aviso de amostra pequena e depois das duplas com amostra maior

Métricas por round (Fase 9, SPEC §7), calculadas a partir de `match_rounds`, `match_round_players` e `match_kills`:

- First blood / first death = primeiro abate do round (pelo `time_in_round`) e quem morreu nele. FB% = rounds com first blood / rounds jogados
- Multi-kill = 3, 4 ou 5 abates do mesmo jogador num round (3K, 4K, ás)
- Clutch 1vX = o jogador fica como último vivo do time com X adversários vivos e o time ganha o round. Taxa = clutches ganhos / situações de clutch
- KAST = % de rounds em que o jogador teve abate, assistência, sobreviveu ou foi trocado (o assassino morreu para um aliado em até 5 s)
- Economia do round = pelo valor médio do equipamento do time no início do round (faixas no SPEC §7); win rate por faixa
- Ataque/defesa = win rate dos rounds de cada lado, por mapa
- Abates por arma = contagem exata pelos abates. **HS% por arma é aproximado**: tiros do round atribuídos à arma comprada naquele round (a API não diz a arma de cada tiro); a UI diz isso

## UI/UX

**`DESIGN.md` é a fonte da verdade visual.** Ele parte do estilo Raycast do Refero Styles, com a densidade do Linear nas telas de dados e a paleta preto e vermelho inspirada no Valorant. Leia antes de criar ou alterar qualquer tela. Se uma skill sugerir algo diferente do DESIGN.md, o DESIGN.md vence.

Skills instaladas e quando usar:
- **design-taste-frontend (Taste):** para gerar telas e componentes novos.
- **impeccable:** para revisar e refinar o que já existe (`/audit`, `/polish` e afins). Rode uma auditoria ao fim de cada fase.
- **emil-design-eng:** para tudo que envolve movimento e resposta a interação (transições, hover, press, popovers, toasts, entrada de listas). Em questões de animação, ela tem prioridade sobre as outras skills, sempre dentro dos limites da seção "Movimento" do DESIGN.md.

Princípios do produto:
- Tema escuro único no MVP (preto + vermelho). Não implemente tema claro.
- Densidade alta de dados, mas legível. Números sempre com `font-variant-numeric: tabular-nums` para não "dançarem" nas tabelas.
- Cada tela responde uma pergunta principal ("estou melhorando?", "como foi essa partida?", "quem mandou bem essa semana?"). O que não responde à pergunta vai para segundo plano.
- Toda tela tem estado de carregamento (skeleton com o formato do conteúdo), vazio (com próxima ação clara) e erro (com como resolver).
- Vitória/derrota nunca depende só de cor: use também texto ou ícone.
- Contraste mínimo AA, foco visível por teclado, alvos de toque de pelo menos 44px no mobile.
- O card de partida e o dashboard precisam funcionar bem em 390px de largura.
- Componentes do 21st.dev são adaptados aos tokens do DESIGN.md. Efeitos pesados (shaders, partículas, fundos animados) só na landing, nunca nas telas de dados.
- A paleta é inspirada no Valorant, mas a identidade é nossa: nada de logo da Riot ou do jogo, símbolo "V", key art oficial ou fontes oficiais. Ícones de agentes e mapas podem vir dos assets da comunidade (as URLs do media.valorant-api.com que a API já retorna).
- O vermelho da marca (`primary` no shadcn) é para a ação principal (uma por tela), o item ativo e destaques. Derrota usa o token `loss`, mais fechado, sempre com texto ou ícone junto.
- O rodapé tem o aviso de não afiliação exigido pela política de fan content da Riot (copiar o texto oficial do site de desenvolvedores da Riot).

## Verificação depois de mudanças

Depois de qualquer mudança de UI:
1. Suba o dev server.
2. Com o **Playwright MCP**, abra a página em 1440px e em 390px de largura e tire screenshots.
3. Compare com o DESIGN.md e com os princípios acima; corrija o que divergir antes de dar a tarefa como pronta.
4. Teste os estados de carregamento, vazio e erro.

Antes de concluir qualquer tarefa: `pnpm lint`, `pnpm typecheck` e `pnpm test` passando.

## Bancos de dev e produção

Dev/e2e e produção são bancos **separados**. Dados de teste nunca vão para a produção: o seed do e2e (e qualquer script que crie dados falsos) chama `assertDevDatabase()` de `src/db/dev-guard.ts`, que só deixa seguir se o próprio banco tiver a marca `COMMENT ON DATABASE <nome> IS 'retake:dev'`. Nunca marque o banco de produção nem contorne a trava. Antes de rodar SQL ou script que escreve, confira para qual banco aponta o `DATABASE_URL` carregado.

## Comandos

```
pnpm dev            servidor de desenvolvimento
pnpm build          build de produção
pnpm lint           ESLint
pnpm typecheck      tsc --noEmit
pnpm test           Vitest
pnpm test:e2e       Playwright
pnpm db:generate    gera migration a partir do schema
pnpm db:migrate     aplica migrations
pnpm sync:once      sincroniza um Riot ID (ex.: pnpm sync:once "Nome#TAG")
pnpm summary:once   resumo semanal de um grupo (ex.: pnpm summary:once meu-grupo --webhook <url>)
pnpm rr:backfill    liga o RR às competitivas salvas sem ele (--all inclui contas sem usuário)
pnpm bagre:once     prévia do resultado do Bagre de um grupo (ex.: pnpm bagre:once meu-grupo --webhook <url>)
```

## Convenções

- Código, nomes de arquivos e commits em inglês; textos da interface em português do Brasil.
- Server Components por padrão; `"use client"` só onde há interação.
- Mutations via Server Actions com validação Zod.
- Commits pequenos, um por passo concluído.
