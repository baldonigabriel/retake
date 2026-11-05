# Retake — guia do projeto

> Tracker de desempenho de Valorant para grupos de amigos.
> Escopo completo, telas, modelo de dados e fases: `docs/SPEC.md`. Leia antes de começar qualquer fase.

## O que o produto faz

O usuário entra com a conta do Discord e vincula o próprio Riot ID. Um processo de sincronização busca as partidas novas periodicamente e salva tudo no nosso banco. O app mostra a evolução pessoal (rank, ACS, K/D, HS%, ADR, win rate, desempenho por mapa e agente), a página de cada partida e grupos de amigos com ranking semanal. Depois de cada partida, um card é postado no Discord do grupo.

O diferencial em relação ao Tracker.gg é o lado social: grupos, rankings internos e "partidas que jogamos juntos". Priorize isso nas decisões de produto.

## Stack

- **Next.js** (versão estável mais recente, App Router) + **TypeScript** em modo `strict`
- **Tailwind CSS** + **shadcn/ui**; componentes do 21st.dev entram pelo CLI do shadcn ou pelo MCP do 21st
- **Recharts** via componentes de chart do shadcn
- **PostgreSQL** (Neon ou Supabase) + **Drizzle ORM** com migrations versionadas
- **Better Auth** com login via Discord
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
    (app)/me/                      dashboard pessoal
    (app)/match/[id]/              página da partida
    (app)/groups/                  lista de grupos
    (app)/groups/[slug]/           grupo: ranking, partidas juntos, config
    (app)/settings/
    api/cron/sync/route.ts         sincronização (protegida por CRON_SECRET)
    api/auth/[...all]/route.ts     Better Auth
  db/
    schema.ts                      tabelas Drizzle
    index.ts                       cliente
  lib/
    henrik/                        cliente HTTP, schemas Zod, rate limiter
    sync/                          lógica de sincronização (independente do Next)
    stats/                         funções puras de métricas (100% testadas)
    discord/                       montagem e envio de cards por webhook
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
- **Proibido:** qualquer feature de scouting (estatísticas de adversários antes ou durante uma partida).

### Fórmulas

- ACS = `score / rounds_played`
- K/D = `kills / max(deaths, 1)`
- KDA = `(kills + assists) / max(deaths, 1)`
- HS% = `headshots / (headshots + bodyshots + legshots)`
- ADR = `damage_dealt / rounds_played`
- Win rate = vitórias / partidas (empates contam como não-vitória e aparecem separados)

KAST e métricas por round ficam fora do MVP.

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
```

## Convenções

- Código, nomes de arquivos e commits em inglês; textos da interface em português do Brasil.
- Server Components por padrão; `"use client"` só onde há interação.
- Mutations via Server Actions com validação Zod.
- Commits pequenos, um por passo concluído.
