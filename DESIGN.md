# Retake — DESIGN.md

> Painel de comando à meia-noite com um vermelho tático.

**Tema:** escuro (único tema no MVP)

**Base:** estilo *Raycast* do Refero Styles (superfícies quase pretas, bordas hairline, sombra "tecla" nos cards, um único acento quente), com a densidade compacta do estilo *Linear* nas telas de dados. Paleta preto e vermelho inspirada no Valorant.

## Essência

A interface é 95% acromática. O vermelho é **sinal**, não decoração: aparece na ação principal, no item ativo da navegação, no destaque do usuário dentro de uma tabela e nos momentos de celebração (MVP da semana). A profundidade vem de degraus sutis entre superfícies, bordas finas e a sombra interna estilo "tecla", nunca de sombras projetadas. Os números são o herói da tela: grandes, condensados, alinhados e fáceis de comparar.

## Cores

### Superfícies

| Token | Valor | Uso |
|---|---|---|
| `--surface-0` | `#050607` | Fundo da página. Único fundo permitido. |
| `--surface-1` | `#0B0C0E` | Cards, painéis, barra de navegação |
| `--surface-2` | `#121316` | Inputs, áreas rebaixadas, linhas alternadas e hover de tabela, skeleton |
| `--surface-3` | `#1B1C1F` | Badges, tooltips, popovers |
| `--border` | `#2A2B2E` | Bordas hairline padrão (1px) |
| `--border-strong` | `#3A3B3E` | Separadores de seção, borda de foco neutra |

### Texto

| Token | Valor | Uso |
|---|---|---|
| `--text-primary` | `#F5F5F4` | Títulos, números, texto principal |
| `--text-secondary` | `#A1A1A3` | Corpo secundário, rótulos de tabela |
| `--text-muted` | `#7C7D80` | Metadados, placeholders (contraste mínimo AA sobre `--surface-0`) |

### Acento (marca)

| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#FF4655` | Ação principal (uma por tela), item ativo da navegação, série principal dos gráficos |
| `--accent-hover` | `#FF5E6B` | Hover do botão principal |
| `--accent-pressed` | `#E03A48` | Estado pressionado |
| `--accent-tint` | `#2A0F12` | Fundo da linha do usuário no placar, fundo do card de MVP |
| `--accent-border` | `#5A1A20` | Borda de elementos com fundo `--accent-tint` |
| `--on-accent` | `#0B0C0E` | Texto sobre o vermelho |

O texto sobre o botão vermelho é **escuro**, não branco: branco sobre `#FF4655` não atinge o contraste AA para texto normal, enquanto o quase-preto passa com folga.

### Resultado

| Token | Valor | Uso |
|---|---|---|
| `--win` | `#34D3A6` | Vitória: barra lateral, chip, variação positiva |
| `--win-tint` | `#0D2A22` | Fundo do chip de vitória |
| `--loss` | `#D9575F` | Derrota: barra lateral, chip, variação negativa |
| `--loss-tint` | `#2A1214` | Fundo do chip de derrota |
| `--draw` | `#A1A1A3` | Empate |

As cores de resultado aparecem **só** em chips, barras e variações. Sempre acompanham texto ("V", "D", "E") ou ícone (▲ ▼), nunca carregam o significado sozinhas. O vermelho de derrota é mais fechado e menos saturado que o `--accent`, para que derrota e ação principal não se confundam.

### Gráficos

Série principal `--accent`; segunda série `#E6E6E6`; terceira `#7C7D80`; grade `--surface-3`; linha de média tracejada em `--border-strong`. Área sob a linha: gradiente do `--accent` a 16% de opacidade até 0%.

## Tipografia

| Família | Uso | Pesos |
|---|---|---|
| **Inter** | Interface e texto corrido | 400, 500, 600 |
| **Barlow Condensed** | Números de destaque (KPIs, placar, rank), rótulos curtos em caixa alta | 600, 700 |
| **Geist Mono** | Metadados técnicos: tag do Riot ID (#BR1), duração, IDs, timestamps | 400, 500 |

Todo número em tabela, KPI ou placar usa `font-variant-numeric: tabular-nums`.

### Escala

| Papel | Família | Tamanho / peso / altura | Observação |
|---|---|---|---|
| eyebrow | Inter | 11px / 500 / 1.2 | caixa alta, `letter-spacing: 0.08em`, `--text-muted` |
| label | Inter | 12px / 500 / 1.3 | rótulos de KPI e cabeçalhos de tabela |
| table | Inter | 13px / 400 / 1.4 | células de tabela |
| body-sm | Inter | 14px / 400 / 1.5 | texto padrão das telas de dados |
| body | Inter | 16px / 400 / 1.5 | texto padrão da landing |
| subheading | Inter | 20px / 500 / 1.3 | título de card/seção |
| heading | Inter | 28px / 600 / 1.15 | título de página |
| stat-md | Barlow Condensed | 32px / 600 / 1 | números em cards menores |
| stat-lg | Barlow Condensed | 48px / 700 / 1 | KPI principal, placar da partida |
| hero | Inter | 56px / 600 / 1.05 | só na landing, `letter-spacing: -0.02em` |

Não use Barlow Condensed para frases ou parágrafos: ela é reservada a números e rótulos de até três palavras.

## Espaçamento e forma

**Unidade base:** 4px. Use apenas 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 120.

**Telas de dados (compactas):** gap entre elementos de 8–12px, padding de card de 16–20px, gap entre cards de 12–16px.

**Landing (confortável):** padding de card de 24px, 96–120px entre seções.

**Largura máxima:** 1200px no conteúdo; o fundo ocupa a tela inteira.

### Raio

| Elemento | Valor |
|---|---|
| badges e chips | 4px |
| botões e inputs | 6px |
| cards | 12px |
| cards grandes e modais | 16px |
| pills e avatares | 9999px |

### Assinatura: corte chanfrado

Os cards de **destaque** (MVP da semana, cabeçalho de rank no dashboard, resultado no topo da partida) têm o canto superior direito cortado em diagonal de 10px via `clip-path`, com borda `--accent-border`. É o único elemento angular do sistema e evoca interfaces táticas sem copiar a do jogo. Limite a no máximo um elemento chanfrado por tela.

## Elevação

| Nível | Tratamento |
|---|---|
| Card padrão | Fundo `--surface-1` + `inset 0 0 0 1px var(--border)` |
| Card elevado ("tecla") | `rgba(255,255,255,0.05) 0 1px 0 0 inset, rgba(255,255,255,0.12) 0 0 0 1px, rgba(0,0,0,0.2) 0 -1px 0 0 inset` |
| Popover, menu, tooltip | Fundo `--surface-3`, borda `--border-strong`, `0 8px 24px rgba(0,0,0,0.5)` (único lugar com sombra projetada) |
| Destaque de MVP | Card elevado + `0 0 32px rgba(255,70,85,0.12)` (brilho vermelho discreto) |

## Componentes

**Barra de navegação.** Fixa no topo, fundo `--surface-0` a 80% com `backdrop-filter: blur(24px)`, borda inferior `--border`. Logo à esquerda, links no centro em 14px `--text-secondary` (ativo: `--text-primary` com indicador de 2px em `--accent` embaixo), avatar e seletor de grupo à direita. No mobile, vira barra inferior com 4 ícones e rótulos.

**Botão primário.** Fundo `--accent`, texto `--on-accent` 14px/600, raio 6px, padding 10px 16px, altura mínima 40px (44px no mobile). **Apenas um por tela.**

**Botão secundário.** Fundo `#E6E6E6`, texto `#1B1C1F` 14px/500, mesmo tamanho do primário.

**Botão fantasma.** Transparente, borda `--border`, texto `--text-secondary`; no hover, borda `--border-strong` e texto `--text-primary`.

**Botão destrutivo.** Transparente, borda `--loss`, texto `--loss`. Sempre com confirmação.

**Input.** Fundo `--surface-2`, borda `--border`, raio 6px, padding 10px 12px, texto 14px. Foco: borda `--accent` + anel de 3px `rgba(255,70,85,0.25)`. O input do Riot ID mostra a tag (#BR1) em Geist Mono com cor `--text-muted`.

**Card de KPI.** Eyebrow com o nome da métrica; número em `stat-lg`; abaixo, chip de variação (▲ +2,1 vs. sua média) em `--win` ou `--loss`; mini-gráfico (sparkline) opcional à direita em `--text-muted`.

**Linha de partida.** Altura de 64px. Barra vertical de 3px à esquerda na cor do resultado, letra do resultado (V/D/E) em Barlow Condensed, ícone do agente em círculo de 36px, nome do mapa e modo, K/D/A em Geist Mono, ACS em `stat-md` reduzido, placar "13–9" e tempo relativo ("há 2 h") em `--text-muted`. Hover: fundo `--surface-2`. A linha inteira é clicável.

**Placar da partida.** Duas tabelas (uma por time) com cabeçalho mostrando o nome do time, resultado e rounds. Células 13px com números tabulares, cabeçalho fixo ao rolar, colunas numéricas alinhadas à direita. A linha do usuário tem fundo `--accent-tint` e borda esquerda de 2px `--accent`. Membros do mesmo grupo recebem um badge "grupo" discreto.

**Ranking do grupo.** Posição em Barlow Condensed (1º–3º em `--text-primary`, demais em `--text-muted`), avatar, nome, valor da métrica em destaque e variação em relação à semana anterior. O usuário logado é destacado como no placar.

**Badge e chip.** Fundo `--surface-3`, texto 12px `--text-secondary`, raio 4px, padding 2px 6px.

**Gráfico de linha.** Linha de 2px, pontos só no hover, área com gradiente, grade horizontal hairline, sem grade vertical. Tooltip em `--surface-3` com o valor em Barlow Condensed.

**Skeleton.** Blocos `--surface-2` com o mesmo formato do conteúdo final e brilho sutil passando (desligado com `prefers-reduced-motion`).

**Estado vazio.** Ícone em linha de 32px em `--text-muted`, uma frase explicando o que falta e a próxima ação como botão primário.

**Toast.** Fundo `--surface-3`, borda `--border-strong`, canto inferior direito (topo no mobile), 4s de duração.

## Movimento

Movimento aqui é resposta, não enfeite: confirma que a interface ouviu o clique, mostra que um número mudou e suaviza a troca entre estados. A referência é a skill emil-design-eng, sempre dentro dos limites abaixo.

### Regras gerais

- Anime apenas `transform` e `opacity`. A única exceção é a contagem de números (ver abaixo). Fundo, borda e cor de texto não têm transição; quando um hover precisa de fundo ou borda suave, ele vem de uma camada (`::before`) que só muda de opacidade.
- Curva `ease-out` forte em tudo (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`); nunca `ease-in`.
- Interações ficam abaixo de 300ms: 150ms em hover e foco, 160ms no press, 150ms para abrir menus e popovers (100ms para fechar), 200ms no indicador das abas e filtros.
- Nada em laço. As únicas repetições permitidas são os indicadores de carregamento (brilho do skeleton e spinner), só enquanto algo carrega, e o fundo do hero da landing.
- Nenhuma animação atrasa a leitura de um dado nem desloca o layout: o espaço final é reservado antes de qualquer coisa se mexer, e o valor certo está no HTML e para leitores de tela desde o primeiro instante.
- Sync em segundo plano e atualizações automáticas (o refresh depois de "Sincronizar agora", o cron) nunca animam: o valor novo aparece direto.
- Ações disparadas pelo teclado não animam: trocar uma aba pelo teclado move o indicador sem deslizar.
- Nada de parallax, partículas, shaders ou fundos animados nas telas de dados. Efeitos pesados só na landing.

### Exceção: contagem de números

Os KPIs do painel, o ranking e o MVP do grupo, a comparação 1x1 e as metas usam `@number-flow/react`.

- **Duração de 700ms** (faixa permitida: 600–800ms), `ease-out`. É a única animação acima de 300ms numa interação, porque precisa de tempo para os dígitos serem lidos enquanto giram.
- Formato pt-BR idêntico ao texto estático: vírgula decimal, `%` colado ao número e as mesmas casas decimais. Sempre `tabular-nums`.
- Anima **na primeira exibição no navegador** (ao chegar na tela por navegação, contando a partir de zero) e **quando um filtro muda o valor** (modo, período, semana, jogador da comparação). Num carregamento completo da página, o número já chega pronto no HTML e não conta, para nunca mostrar um valor errado antes de o JavaScript carregar.
- Nunca anima a cada re-render nem em sync em segundo plano.
- Trocar a métrica (ACS → K/D) troca o número sem contar: é outra grandeza, não o mesmo número mudando.
- A largura final do número é reservada antes de a contagem começar, para nada ao lado se mexer.
- Leitores de tela recebem só o valor final.

### Interação

- Hover só em `@media (hover: hover) and (pointer: fine)`, e só em elementos clicáveis. Muda fundo e/ou borda, nunca tamanho, posição ou peso da fonte.
- Press: `scale(0.97)` em botões, itens de navegação e cards clicáveis. Linhas de lista que ocupam a largura do painel usam `scale(0.99)`, para o recuo em pixels ficar parecido com o de um botão.
- Foco por teclado é sempre igual ou mais forte que o hover: a mesma camada de fundo do hover mais o anel de 2px em `--accent`.

### Gráficos

- Primeira renderização: a série entra da esquerda para a direita (máscara com `scaleX`) em 300ms.
- Troca de filtro ou de métrica: a série nova entra com fade e 4px de subida em 200ms; os eixos trocam direto. Sync em segundo plano não reanima.
- Hover: linha guia vertical, ponto ativo maior (raio 5px com anel na cor do card) e tooltip no estilo de popover (`--surface-3`, borda forte, sombra) com mapa, agente, resultado (texto e cor) e o valor em Barlow Condensed.
- Toque: tocar no ponto abre o tooltip; tocar fora do gráfico fecha.

### Listas e estados

- Partidas, ranking e grupos entram em sequência só no primeiro carregamento: 40ms entre itens (faixa: 30–60ms), escalonando no máximo os 10 primeiros (os seguintes entram junto com o décimo), 240ms por item, com opacidade e 6px de subida.
- Skeleton → conteúdo: o conteúdo aparece com fade de 150ms.
- Troca de filtro: o conteúdo atual fica a 60% de opacidade (fade de 150ms) até o novo chegar; nada de skeleton piscando.
- Abas e filtros (controle segmentado): um indicador desliza até a opção escolhida em 200ms, assim que ela é clicada, sem esperar os dados.
- Popovers e menus crescem a partir do elemento que os abriu, de `scale(0.95)` e opacidade 0 (nunca de `scale(0)`). Modais abrem centralizados (200ms; fecham em 120ms).
- Toasts entram e saem deslizando com fade (só `transform` e `opacity`, sem animar altura): 240ms na entrada, 180ms na saída.

### Destaques de produto

- O card de MVP da semana e o resultado de vitória no topo da partida entram com fade e `scale(0.98)` e recebem, uma única vez, um brilho diagonal discreto que atravessa o card (700ms). Na vitória, a barra de resultado cresce de baixo para cima.
- Derrota e empate não têm celebração.

### Movimento reduzido

Com `prefers-reduced-motion: reduce`:

- Nada se desloca nem muda de escala: sem press, sem escalonamento, sem slide, sem brilho e sem contagem (o número troca direto).
- Fica só um fade curto (150ms) nas entradas de listas, conteúdo, gráficos, popovers e toasts. O indicador das abas troca de lugar sem deslizar.
- O brilho do skeleton é desligado.

## Imagens

Ícones de agentes e mapas vêm dos assets da comunidade (URLs do media.valorant-api.com retornadas pela API). No cabeçalho da página de partida, a imagem do mapa entra como fundo com overlay de `--surface-0` a 85% para não competir com os números. Na landing, o hero usa formas geométricas diagonais abstratas em vermelho com desfoque grande sobre o fundo preto (o único momento "cinematográfico" do sistema), seguidas de uma prévia real do dashboard. Sem fotos de banco de imagem.

## Faça

- Use `#050607` como único fundo de página.
- Mantenha um único botão vermelho por tela.
- Use texto escuro sobre o vermelho.
- Use números tabulares em todo lugar que exibe estatística.
- Acompanhe cores de resultado com texto ou ícone.
- Separe superfícies com bordas hairline e degraus de cor, não com sombras.
- Mantenha o grid de 4px.

## Não faça

- Não use o logo do Valorant ou da Riot, o símbolo "V", key art oficial nem as fontes oficiais do jogo. Paleta inspirada sim; identidade copiada não.
- Não use o vermelho em texto corrido, links comuns, ícones decorativos ou bordas gerais.
- Não use mais de uma cor de acento na mesma superfície.
- Não use sombras projetadas em cards (só em popovers e menus).
- Não use Barlow Condensed em frases.
- Não crie seções em tema claro.
- Não use gradientes em botões ou cards; gradiente só no hero da landing e na área dos gráficos.

## Referência rápida para agentes

- fundo: `#050607` · card: `#0B0C0E` · borda: `#2A2B2E`
- texto: `#F5F5F4` / `#A1A1A3` / `#7C7D80`
- acento: `#FF4655` (texto sobre ele: `#0B0C0E`)
- vitória: `#34D3A6` · derrota: `#D9575F` · empate: `#A1A1A3`
- raios: 4 / 6 / 12 / 16 · grid: 4px

## Tokens para Tailwind v4 + shadcn/ui

```css
@import "tailwindcss";

@theme {
  --color-surface-0: #050607;
  --color-surface-1: #0B0C0E;
  --color-surface-2: #121316;
  --color-surface-3: #1B1C1F;
  --color-line: #2A2B2E;
  --color-line-strong: #3A3B3E;

  --color-fg: #F5F5F4;
  --color-fg-secondary: #A1A1A3;
  --color-fg-muted: #7C7D80;

  --color-accent: #FF4655;
  --color-accent-hover: #FF5E6B;
  --color-accent-pressed: #E03A48;
  --color-accent-tint: #2A0F12;
  --color-accent-line: #5A1A20;
  --color-on-accent: #0B0C0E;

  --color-win: #34D3A6;
  --color-win-tint: #0D2A22;
  --color-loss: #D9575F;
  --color-loss-tint: #2A1214;
  --color-draw: #A1A1A3;

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-stat: "Barlow Condensed", "Inter", ui-sans-serif, sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;

  --radius-chip: 4px;
  --radius-control: 6px;
  --radius-card: 12px;
  --radius-card-lg: 16px;

  --shadow-key: rgba(255,255,255,0.05) 0 1px 0 0 inset, rgba(255,255,255,0.12) 0 0 0 1px, rgba(0,0,0,0.2) 0 -1px 0 0 inset;
  --shadow-pop: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-mvp: 0 0 32px rgba(255,70,85,0.12);
}

/* Mapeamento para as variáveis que os componentes do shadcn esperam */
:root {
  --background: #050607;
  --foreground: #F5F5F4;
  --card: #0B0C0E;
  --card-foreground: #F5F5F4;
  --popover: #1B1C1F;
  --popover-foreground: #F5F5F4;
  --primary: #FF4655;
  --primary-foreground: #0B0C0E;
  --secondary: #E6E6E6;
  --secondary-foreground: #1B1C1F;
  --muted: #121316;
  --muted-foreground: #7C7D80;
  --accent: #121316;            /* no shadcn, "accent" é o hover neutro */
  --accent-foreground: #F5F5F4;
  --destructive: #D9575F;
  --border: #2A2B2E;
  --input: #2A2B2E;
  --ring: #FF4655;
  --radius: 0.375rem;           /* 6px */
}
```

Atenção ao nome `accent`: no shadcn ele significa a cor neutra de hover, não a cor da marca. A cor da marca no shadcn é `primary`.
