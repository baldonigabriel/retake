"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { joinInviteFormAction } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";

/**
 * A real form posting to a Server Action, so "Entrar no grupo" works even if
 * it's tapped before the page hydrates (slow mobile connections). On success
 * the action redirects to the group.
 */
export function JoinGroupButton({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(joinInviteFormAction, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3 sm:w-fit" aria-busy={pending}>
      <input type="hidden" name="code" value={code} />
      {state ? (
        <p role="alert" className="flex gap-2 rounded-control bg-loss-tint px-3 py-2.5 text-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-loss" />
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full sm:w-fit" disabled={pending}>
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
        {pending ? "Entrando…" : "Entrar no grupo"}
      </Button>
    </form>
  );
}
