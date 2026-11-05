import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center gap-4 px-4 py-24 sm:px-6">
      <p className="text-eyebrow uppercase text-fg-muted">Fase 0 · Fundação</p>
      <h1 className="text-heading text-fg">Retake</h1>
      <p className="max-w-prose text-fg-secondary">
        A landing chega na Fase 4. Por enquanto, veja os tokens e componentes base.
      </p>
      <Link
        href="/design-system"
        className="w-fit text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
      >
        Abrir o design system
      </Link>
    </main>
  );
}
