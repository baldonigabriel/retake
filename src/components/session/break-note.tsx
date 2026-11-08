"use client";

import { Coffee, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BREAK_DISMISSED_COOKIE } from "./break-cookie";

/**
 * The gentle "take a break" note inside "Sessão de hoje", after losses in a
 * row. Friendly, never a scolding; no red. Closing it hides it for the rest
 * of this session (cookie keyed by the session), and it can be turned off for
 * good in Ajustes.
 *
 * Motion (emil-design-eng, within DESIGN.md): enters with the standard 240ms
 * fade + 6px rise; leaves faster (150ms, opacity + 4px up, transform/opacity
 * only), then unmounts. Under reduced motion only the fade remains.
 */
export function BreakNote({ sessionKey, losses }: { sessionKey: string; losses: number }) {
  const [state, setState] = useState<"shown" | "leaving" | "gone">("shown");
  if (state === "gone") return null;

  function close() {
    document.cookie = `${BREAK_DISMISSED_COOKIE}=${encodeURIComponent(sessionKey)}; Path=/; Max-Age=${60 * 60 * 24}; SameSite=Lax`;
    // Keep focus on the card instead of dropping it on <body>.
    document.getElementById("session-title")?.focus();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setState("gone");
    setState("leaving");
    // transitionend doesn't fire if the tab is hidden or the transition is skipped: never get stuck.
    window.setTimeout(() => setState("gone"), 200);
  }

  return (
    <div
      role="status"
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && state === "leaving") setState("gone");
      }}
      className={cn(
        "motion-transform border-b border-line px-4 py-3 transition-[opacity,transform] duration-150 ease-(--ease-out)",
        // The entrance animation holds its values (fill: both), so it must go before the exit transition can run.
        state === "leaving" ? "-translate-y-1 opacity-0" : "animate-enter motion-reduce:animate-none",
      )}
    >
      <div className="flex items-start gap-3 rounded-control bg-surface-2 py-2.5 pr-1.5 pl-3 shadow-hairline">
        <Coffee aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-medium text-fg">
            {losses} derrotas seguidas. Acontece com todo mundo.
          </p>
          <p className="text-fg-secondary">
            Que tal uma pausa de 10 minutos? Uma água, uma esticada, e você volta com a cabeça fresca.
          </p>
          <Link
            href="/settings#break-reminder"
            className="mt-0.5 inline-flex min-h-11 w-fit items-center text-label text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg sm:min-h-0"
          >
            Desligar este aviso nos ajustes
          </Link>
        </div>
        <Button type="button" variant="quiet" size="icon-sm" onClick={close} aria-label="Fechar aviso de pausa" title="Fechar">
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
