import { randomBytes } from "node:crypto";

/**
 * Invite token: 18 random bytes → 24 base64url chars (144 bits), so links
 * can't be guessed. Revoking replaces the token (groups.invite_code).
 */
export function newInviteCode(): string {
  return randomBytes(18).toString("base64url");
}
