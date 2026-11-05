// @vitest-environment node
import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { EncryptionKeyError, decrypt, encrypt, parseKey } from "./crypto";

const key = randomBytes(32);
const URL = "https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-JKL";

describe("encrypt / decrypt", () => {
  it("round-trips a value", () => {
    expect(decrypt(encrypt(URL, key), key)).toBe(URL);
    expect(decrypt(encrypt("", key), key)).toBe("");
    expect(decrypt(encrypt("ação ✓", key), key)).toBe("ação ✓");
  });

  it("never stores the plaintext and uses a fresh IV every time", () => {
    const a = encrypt(URL, key);
    const b = encrypt(URL, key);
    expect(a).not.toContain("discord");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^v1\.[\w-]{16}\.[\w-]+$/);
  });

  it("rejects another key", () => {
    expect(() => decrypt(encrypt(URL, key), randomBytes(32))).toThrow();
  });

  it("rejects a ciphertext moved to another context (row)", () => {
    const stored = encrypt(URL, key, "group-a");
    expect(decrypt(stored, key, "group-a")).toBe(URL);
    expect(() => decrypt(stored, key, "group-b")).toThrow();
  });

  it("rejects tampering", () => {
    const [v, iv, body] = encrypt(URL, key).split(".");
    const flipped = Buffer.from(body!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decrypt(`${v}.${iv}.${flipped.toString("base64url")}`, key)).toThrow();
    expect(() => decrypt("v2.aaaa.bbbb", key)).toThrow(/format/);
    expect(() => decrypt("not encrypted", key)).toThrow(/format/);
  });
});

describe("parseKey", () => {
  it("accepts base64 of 32 bytes", () => {
    expect(parseKey(key.toString("base64"))).toEqual(key);
  });

  it("explains how to generate a key when it's missing or the wrong size", () => {
    expect(() => parseKey(undefined)).toThrow(EncryptionKeyError);
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(/openssl rand -base64 32/);
  });
});
