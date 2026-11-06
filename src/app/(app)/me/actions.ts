"use server";

import { after } from "next/server";

import { db } from "@/db";
import { serverEnv } from "@/env";
import { syncCooldownLeft } from "@/lib/accounts/initial-import";
import { getLinkedAccount, getSessionUser } from "@/lib/auth/session";
import { notifyNewMatches } from "@/lib/discord";
import { discordKey } from "@/lib/discord/key";
import { henrikClient } from "@/lib/henrik";
import { syncAccount } from "@/lib/sync";

export type SyncNowResult =
  | { ok: true; inserted: number }
  | { ok: false; message: string; retryAt?: number };

/** "Sincronizar agora": the newest history page, at most once every 2 minutes. */
export async function syncNowAction(): Promise<SyncNowResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre com o Discord de novo." };
  const account = await getLinkedAccount(user.id);
  if (!account) return { ok: false, message: "Vincule seu Riot ID antes de sincronizar." };

  const now = new Date();
  const wait = syncCooldownLeft(account, now);
  if (wait > 0) {
    const seconds = Math.ceil(wait / 1000);
    return {
      ok: false,
      message: `Sincronizamos há pouco. Tente de novo em ${seconds < 60 ? `${seconds} s` : "1 min"}.`,
      retryAt: now.getTime() + wait,
    };
  }

  const result = await syncAccount({ db: db(), henrik: henrikClient() }, account);
  if (result.status === "error") {
    console.error("[sync-now] failed", result.error);
    return { ok: false, message: "O serviço de dados do Valorant não respondeu. Tente de novo em alguns minutos." };
  }
  // Step 6 for what this sync found: cards go out after the response, so the
  // button doesn't wait on Discord.
  const key = discordKey();
  if (key && result.inserted.length > 0) {
    const inserted = result.inserted;
    after(async () => {
      try {
        await notifyNewMatches(db(), inserted, {
          key,
          appUrl: serverEnv().BETTER_AUTH_URL,
          onlyThese: true,
          deadline: Date.now() + 20_000,
        });
      } catch (error) {
        console.error("[sync-now] discord step failed", error);
      }
    });
  }
  return { ok: true, inserted: result.inserted.length };
}
