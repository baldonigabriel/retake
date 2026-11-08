---
version: 1
slug: "src-app-marketing-login-page-tsx"
primary_target: "src/app/(marketing)/login/page.tsx"
related_targets: ["src/components/auth/social-sign-in-button.tsx"]
---

# Login

## Scope

- Primary target: `src/app/(marketing)/login/page.tsx`
- Related targets: `src/components/auth/social-sign-in-button.tsx`
- Visitor mode: Operate

## Audience and task

Uma pessoa nova ou desconectada precisa escolher Google ou Discord, concluir o OAuth e voltar ao destino que pediu. Os dois métodos têm o mesmo peso; a tela também deve deixar claro que a segunda conta pode ser vinculada depois em Ajustes.

## Constraints

- Herdar integralmente o sistema visual de `DESIGN.md`.
- Manter o destino `next` seguro e preservar estados de erro do OAuth.
- Um único fluxo por clique, com estado pendente e feedback acessível.
- Funcionar a 1440 px e 390 px, com alvos de toque de pelo menos 44 px.
- Não insinuar que o Retake publica ou age em nome da pessoa.

## Direction contract

THESIS: A tela é uma escolha de porta, não uma apresentação de marketing. Ela recusa hierarquia entre provedores e reduz a decisão a dois caminhos equivalentes para chegar ao mesmo perfil do Retake.

OWN-WORLD: Superfície quase preta, card compacto em `surface-1`, borda hairline e tipografia Inter do sistema existente. A marca vermelha identifica o produto; os provedores aparecem em controles neutros equivalentes, sem transformar cores externas em um segundo acento.

STORY: A pessoa reconhece o Retake, entende que Google e Discord são opções iguais, escolhe uma e sabe que poderá ligar a outra depois em Ajustes. Em falha, recebe uma mensagem específica e pode tentar novamente sem perder o destino.

FIRST VIEWPORT: Logo acima de um card único e estreito, centralizado no espaço disponível. O card abre com título e uma explicação curta, mostra o alerta quando necessário, apresenta os dois botões empilhados com a mesma altura e encerra com uma nota breve sobre vinculação e dados lidos.

FORM: Extensão precisa de uma superfície estabelecida, estrutura direta escolhida sem rodada de conceitos porque a spec fixa conteúdo, hierarquia e equivalência. seed: none (unavailable).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved decisions

Nenhuma decisão material em aberto para esta fase.
