import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "O que o Retake guarda, quem vê e como pedir para apagar seus dados.",
};

const CONTACT = "baldonigabriel3005@gmail.com";
const UPDATED = "9 de novembro de 2026";

/**
 * Privacy policy, required by Google's OAuth consent screen to publish the
 * app. Plain language, and it must match what the code does: update it
 * whenever what we store, who sees it or which services we use changes.
 */
export default function PrivacyPage() {
  return (
    <>
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center px-4 sm:px-6">
        <Link href="/" aria-label="Retake, início" className="flex min-h-11 items-center rounded-control">
          <Logo />
        </Link>
      </header>

      <main id="conteudo" className="mx-auto flex w-full max-w-[68ch] flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-heading text-balance text-fg">Política de Privacidade</h1>
          <p className="text-body-sm text-fg-muted">Atualizada em {UPDATED}</p>
        </div>

        <Section title="Quem somos">
          <p>
            O Retake é um tracker de Valorant para grupos de amigos, feito de forma independente. Não é afiliado nem
            endossado pela Riot Games.
          </p>
        </Section>

        <Section title="O que guardamos">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong className="font-medium text-fg">Da sua conta Google ou Discord:</strong> nome, e-mail e foto de
              perfil, só para você entrar. Nunca publicamos nada em seu nome.
            </li>
            <li>
              <strong className="font-medium text-fg">Do Valorant:</strong> o Riot ID que você vincular e as suas
              partidas (agente, mapa, placar, abates, dano, rounds, armas, rank e RR), buscadas numa API pública de
              dados do jogo.
            </li>
            <li>
              <strong className="font-medium text-fg">Do que você faz no Retake:</strong> grupos e convites, indicações e
              votos do Bagre, metas e preferências.
            </li>
            <li>
              <strong className="font-medium text-fg">Webhook do Discord do grupo:</strong> guardado criptografado.
            </li>
          </ul>
        </Section>

        <Section title="Outros jogadores">
          <p>
            Uma partida tem dez jogadores. Quem não usa o Retake aparece apenas no placar daquela partida, e só para quem
            jogou junto. Não criamos perfis, buscas ou páginas para essas pessoas, e nunca mostramos números de
            adversários antes ou durante uma partida.
          </p>
        </Section>

        <Section title="Quem vê seus dados">
          <p>
            Por padrão, só você e quem está nos seus grupos. Se você escolher deixar o perfil público, qualquer pessoa vê
            as seções que você marcou, pelo link ou pela busca. Grupos, Bagre e duplas nunca aparecem num perfil público.
            Você pode voltar para privado quando quiser em Ajustes, e a mudança vale na hora.
          </p>
        </Section>

        <Section title="Serviços que usamos">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>Vercel, para hospedar o site.</li>
            <li>Neon, para o banco de dados (servidores em São Paulo).</li>
            <li>Google e Discord, para o login.</li>
            <li>HenrikDev, para buscar os dados das partidas.</li>
            <li>
              Google Gemini ou Groq, para escrever o resumo semanal do grupo. Eles recebem só números agregados da semana,
              nunca seu e-mail.
            </li>
          </ul>
        </Section>

        <Section title="Cookies">
          <p>
            Só os necessários: o da sessão de login e dois de preferência (fechar o aviso de pausa e adiar a pergunta
            sobre o perfil público). Sem anúncios e sem rastreamento de terceiros.
          </p>
        </Section>

        <Section title="Seus direitos">
          <p>
            Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir acesso, correção ou exclusão dos seus dados. Para
            apagar sua conta e tudo o que é só seu, use “Apagar minha conta” em Ajustes: vale na hora. Os grupos que você
            criou passam para o membro mais antigo, ou são apagados se não tiverem mais ninguém. Para qualquer outro
            pedido, escreva para{" "}
            <a href={`mailto:${CONTACT}`} className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              {CONTACT}
            </a>
            . Respondemos em até 15 dias.
          </p>
          <p>
            As partidas em si são compartilhadas por quem jogou junto: ao apagar sua conta, deixamos de ligar essas
            partidas a você, e elas seguem no placar dos outros jogadores, como acontece com quem não usa o Retake.
          </p>
        </Section>

        <Section title="Contato">
          <p>
            <a href={`mailto:${CONTACT}`} className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              {CONTACT}
            </a>
          </p>
        </Section>
      </main>

      <SiteFooter bottomNav={false} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-body text-fg-secondary">
      <h2 className="text-subheading text-fg">{title}</h2>
      {children}
    </section>
  );
}
