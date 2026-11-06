# Deploy do Retake

Passo a passo para publicar na Vercel com banco no Neon, login pelo Discord e sincronização pelo cron-job.org. Leva uns 20 minutos.

Troque `retake-xyz.vercel.app` pelo endereço que a Vercel der ao projeto (ou pelo seu domínio).

## 0. Gerar os segredos

Rode três vezes no terminal e guarde cada resultado: um para `BETTER_AUTH_SECRET`, um para `CRON_SECRET` e um para `ENCRYPTION_KEY`.

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use valores **novos** em produção, diferentes dos do `.env.local`. Atenção: se a `ENCRYPTION_KEY` mudar depois, os webhooks salvos deixam de funcionar e cada dono de grupo precisa colar o webhook de novo.

## 1. Banco (Neon)

1. No painel do Neon, abra o projeto e clique em **Create child branch**. Dê um nome diferente do branch de desenvolvimento (ex.: `prod`) e escolha **Branch schema only**, para não levar os dados de desenvolvimento e de teste.
2. Em **Connect**, copie as duas URLs desse branch:
   - **direta** (host sem `-pooler`) → `DATABASE_URL`
   - **pooled** (host com `-pooler`) → `DATABASE_URL_POOLED`
3. Aplique as migrations no banco de produção (a partir da sua máquina, com a URL **direta**):

   ```
   $env:DATABASE_URL="postgresql://...direta..."; pnpm db:migrate
   ```

   No Git Bash: `DATABASE_URL="postgresql://...direta..." pnpm db:migrate`.

   Um branch "schema only" já traz as tabelas, mas não o registro de migrações do Drizzle. Se o comando acima falhar com "already exists", é isso: anote as migrações como aplicadas (sem alterar tabelas) inserindo uma linha por migração em `drizzle.__drizzle_migrations` (hash = sha256 do arquivo `.sql`, `created_at` = campo `when` de `drizzle/meta/_journal.json`) e rode `pnpm db:migrate` de novo.

## 2. GitHub

```
gh repo create retake --private --source . --remote origin --push
```

(ou crie o repositório pelo site e rode `git remote add origin <url>` e `git push -u origin master`).

## 3. Vercel

1. **Add New › Project**, importe o repositório `retake`. A Vercel detecta Next.js e pnpm; o `vercel.json` já define o build e a região `gru1` (São Paulo, perto do Neon `sa-east-1`).
2. Em **Environment Variables** (ambiente *Production*), cadastre:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | URL direta do branch `production` |
   | `DATABASE_URL_POOLED` | URL pooled do branch `production` (é a que o app usa em produção) |
   | `BETTER_AUTH_SECRET` | segredo gerado no passo 0 |
   | `BETTER_AUTH_URL` | `https://retake-xyz.vercel.app` (sem barra no fim) |
   | `DISCORD_CLIENT_ID` | do app do Discord (passo 4) |
   | `DISCORD_CLIENT_SECRET` | do app do Discord (passo 4) |
   | `HENRIK_API_KEY` | sua chave do HenrikDev |
   | `CRON_SECRET` | segredo gerado no passo 0 |
   | `ENCRYPTION_KEY` | segredo gerado no passo 0 |
   | `GEMINI_API_KEY` | opcional: chave gratuita do [Google AI Studio](https://aistudio.google.com/apikey), para o resumo semanal |
   | `GROQ_API_KEY` | opcional: chave gratuita do [Groq](https://console.groq.com/keys), reserva se o Gemini falhar |

3. Clique em **Deploy**. Se você só descobrir o endereço depois do primeiro deploy, ajuste `BETTER_AUTH_URL` e faça **Redeploy**.

## 4. Discord (login)

No [portal de desenvolvedores do Discord](https://discord.com/developers/applications), abra o app usado no login (ou crie um só para produção):

1. **OAuth2 › Redirects › Add Redirect**: `https://retake-xyz.vercel.app/api/auth/callback/discord` e salve.
2. Copie **Client ID** e **Client Secret** (Reset Secret, se precisar) para as variáveis da Vercel.

O redirect de `http://localhost:3000/api/auth/callback/discord` pode continuar lá para o desenvolvimento.

## 5. Agendador (cron-job.org)

Crie um cronjob em [cron-job.org](https://cron-job.org) (Create cronjob):

- **URL:** `https://retake-xyz.vercel.app/api/cron/sync`
- **Schedule:** a cada 10 minutos (Every 10 minutes; até 15 também serve)
- **Advanced › Request method:** `POST`
- **Advanced › Headers:** `Authorization` = `Bearer <CRON_SECRET>` (a palavra `Bearer`, um espaço e o segredo)
- Salve e use **Test run**: a resposta esperada é `202 {"accepted":true}`. A rota responde na hora e continua o trabalho em segundo plano, então o limite de 30 s do cron-job.org não atrapalha.

Para ver o resultado completo de uma rodada:

```
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" "https://retake-xyz.vercel.app/api/cron/sync?wait=1"
```

## 5.1 Resumo semanal com IA

Toda segunda a partir das 9h (horário de Brasília), a mesma rota do cron posta no Discord de cada grupo com webhook o resumo da semana que terminou. Os números (partidas, vitórias, MVP, maior placar, quem mais evoluiu) são calculados pelo código; a IA só escreve o texto a partir deles.

- O texto vem do **Gemini** (`gemini-3.5-flash-lite`, plano gratuito); se ele falhar, do **Groq** (`openai/gpt-oss-120b`, plano gratuito); se os dois falharem ou não houver chaves, de frases-modelo por regras. O rodapé do card diz quem escreveu, e a tabela `weekly_summaries` guarda o provedor de cada resumo.
- Cada chamada de IA tem timeout de 8 s, um 429 pula o provedor (sem repetir em laço) e respostas com número que não está nos dados são descartadas.
- O post sai uma única vez por grupo e semana, mesmo com duas rodadas do cron ao mesmo tempo. Semana sem nenhuma partida não gera post.
- As duas chaves são opcionais. Sem elas, o resumo sai pelas regras.

Para ver ou mandar um resumo na hora (não interfere no post oficial de segunda):

```
pnpm summary:once <slug-do-grupo>                      # mostra números, texto e provedor
pnpm summary:once <slug-do-grupo> --webhook <url>      # manda para um webhook de teste
pnpm summary:once <slug-do-grupo> --week last --send   # semana passada, no webhook do grupo
```

## 6. Conferir

1. Abra o site, entre com o Discord e vincule seu Riot ID.
2. Crie um grupo, vá em **Ajustes do grupo › Discord**, cole o webhook do canal (Editar canal › Integrações › Webhooks) e clique em **Enviar mensagem de teste**: aparece "Canal conectado ao Retake" no canal.
3. Jogue uma partida. Em até ~15 minutos chega o card no canal. Na Vercel, **Logs** mostra uma linha `[cron] sync` a cada rodada, com `newMatches` e `discord.sent`.

## Problemas comuns

- **Login volta com erro:** o redirect do Discord não bate exatamente com `BETTER_AUTH_URL` + `/api/auth/callback/discord` (confira https e barra no fim).
- **Cron responde 401:** o header precisa ser `Authorization: Bearer <CRON_SECRET>`, com o mesmo valor da Vercel.
- **Resumo da semana não chegou:** ele sai a partir de segunda às 9h, só para grupos com webhook e com pelo menos uma partida na semana. Na Vercel, **Logs** mostra `summaries` na linha `[cron] sync`; `pnpm summary:once <slug>` mostra o que seria enviado.
- **Card não chegou:** o card só sai para partidas que começaram nas últimas 6 horas e para grupos com webhook salvo. Se o webhook foi apagado no Discord, a mensagem de teste avisa; salve um novo.
- **"Webhook salvo, mas não conseguimos lê-lo":** a `ENCRYPTION_KEY` mudou. Cole o webhook de novo.
