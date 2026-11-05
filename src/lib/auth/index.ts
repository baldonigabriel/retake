import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import { serverEnv } from "@/env";

import { authOptions } from "./options";

function createAuth() {
  const options = authOptions(db(), serverEnv());
  // nextCookies must be the last plugin: it lets Server Actions set cookies.
  return betterAuth({ ...options, plugins: [nextCookies()] });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** Lazily created so `next build` doesn't need the auth secrets. */
export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}
