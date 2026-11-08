# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jogadores de Valorant que acompanham o próprio desempenho e jogam com grupos de amigos. Eles usam o Retake para entender a evolução pessoal, rever partidas e comparar resultados dentro do grupo.

## Product Purpose

O Retake transforma o histórico de partidas de Valorant em um painel pessoal e social. O produto sincroniza dados do Riot ID, calcula métricas a partir das partidas e reúne rankings, partidas em conjunto e rituais do grupo.

## Positioning

O diferencial em relação a trackers individuais é o contexto social: grupos privados, rankings internos e leitura das partidas jogadas em conjunto.

## Operating Context

O acesso usa Google ou Discord, com os dois provedores podendo apontar para o mesmo usuário. Depois do primeiro login, a pessoa vincula o próprio Riot ID. O app é usado principalmente depois das partidas e ao longo da semana para acompanhar forma, comparar amigos e revisar resultados.

## Capabilities and Constraints

- Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui, PostgreSQL com Drizzle e Better Auth.
- Login por Google e Discord; nunca é permitido remover o último método de acesso.
- Jogadores são identificados por `puuid`; nome e tag do Riot ID podem mudar.
- A API HenrikDev roda apenas no servidor, com validação Zod e rate limit.
- Estatísticas são calculadas das partidas gravadas e sempre deixam o modo explícito.
- Dados sociais são privados por padrão e scouting antes ou durante partidas é proibido.
- Deploy na Vercel; sincronização acionada por uma rota protegida e agendador externo.

## Brand Commitments

O produto se chama Retake e usa voz direta em português do Brasil. A identidade é própria, inspirada na energia tática do Valorant sem usar logos, fontes ou key art da Riot. `DESIGN.md` é a fonte da verdade visual.

## Evidence on Hand

- Especificação funcional em `docs/SPEC.md`.
- Regras de implementação e produto em `CLAUDE.md`.
- Sistema visual documentado em `DESIGN.md`.
- Dados sintéticos de desenvolvimento e testes em `e2e/support/seed.ts`; não são prova comercial nem dados reais de usuários.

## Product Principles

- Priorizar o valor social sem esconder a evolução individual.
- Fazer cada tela responder uma pergunta principal.
- Proteger privacidade e impedir usos de scouting.
- Explicar amostras, modos e limitações junto dos números.
- Manter ações críticas reversíveis ou explicitamente confirmadas.

## Accessibility & Inclusion

Contraste mínimo AA, foco visível por teclado, alvos de toque de pelo menos 44 px no mobile e significado nunca comunicado apenas por cor.
