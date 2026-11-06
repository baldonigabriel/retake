import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FullConfig } from "@playwright/test";

import { seed, type SeededSession } from "./support/seed";

export const AUTH_DIR = path.join(__dirname, ".auth");
export const ONBOARDED_STATE = path.join(AUTH_DIR, "onboarded.json");
export const FRESH_STATE = path.join(AUTH_DIR, "fresh.json");
export const EMPTY_STATE = path.join(AUTH_DIR, "empty.json");
export const FRIEND_STATE = path.join(AUTH_DIR, "friend.json");

function storageState(session: SeededSession, baseURL: string) {
  const { hostname } = new URL(baseURL);
  return {
    cookies: [
      {
        name: session.name,
        value: session.value,
        domain: hostname,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const { onboarded, fresh, empty, friend } = await seed();
  await mkdir(AUTH_DIR, { recursive: true });
  await writeFile(ONBOARDED_STATE, JSON.stringify(storageState(onboarded, baseURL)));
  await writeFile(FRESH_STATE, JSON.stringify(storageState(fresh, baseURL)));
  await writeFile(EMPTY_STATE, JSON.stringify(storageState(empty, baseURL)));
  await writeFile(FRIEND_STATE, JSON.stringify(storageState(friend, baseURL)));
}
