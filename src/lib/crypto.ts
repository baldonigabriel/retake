/**
 * Secrets at rest (Discord webhook URLs): AES-256-GCM with a random 96-bit IV
 * per value and an optional "context" bound as additional authenticated data
 * (e.g. the group id), so a ciphertext copied to another row fails to open.
 *
 * Stored format: `v1.<iv>.<ciphertext+tag>` (base64url parts). The version
 * prefix leaves room for key rotation later.
 *
 * The key is ENCRYPTION_KEY: base64 of exactly 32 random bytes
 * (`openssl rand -base64 32`). Pure functions take the key explicitly so they
 * are testable; `serverKey()` reads it from the environment.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { serverEnv } from "@/env";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class EncryptionKeyError extends Error {}

/** Decodes and checks an ENCRYPTION_KEY value. */
export function parseKey(raw: string | undefined): Buffer {
  if (!raw) throw new EncryptionKeyError("ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new EncryptionKeyError("ENCRYPTION_KEY must be base64 of 32 bytes. Generate one with: openssl rand -base64 32");
  }
  return key;
}

let cachedKey: Buffer | undefined;

/** The app key from the environment (server only). */
export function serverKey(): Buffer {
  cachedKey ??= parseKey(serverEnv().ENCRYPTION_KEY);
  return cachedKey;
}

export function encrypt(plaintext: string, key: Buffer, context = ""): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${iv.toString("base64url")}.${body.toString("base64url")}`;
}

/** Throws when the value was tampered with, uses another key or another context. */
export function decrypt(stored: string, key: Buffer, context = ""): string {
  const [version, ivPart, bodyPart, ...rest] = stored.split(".");
  if (version !== VERSION || !ivPart || !bodyPart || rest.length > 0) throw new Error("Unrecognised ciphertext format");
  const iv = Buffer.from(ivPart, "base64url");
  const body = Buffer.from(bodyPart, "base64url");
  if (iv.length !== IV_BYTES || body.length < TAG_BYTES) throw new Error("Unrecognised ciphertext format");

  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
  return Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]).toString("utf8");
}
