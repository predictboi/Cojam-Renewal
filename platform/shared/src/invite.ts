// Invite code rules (DEV-PLAN section 7, `invites`): 6 to 8 characters from capital letters and the digits 2 to 9,
// never 0 or 1 (so O, I and L are always letters). Issued with 7 characters. Stored upper case; matched case
// insensitively after dropping anything that is not a letter or digit.

export const INVITE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 7;
export const INVITE_MIN_LENGTH = 6;
export const INVITE_MAX_LENGTH = 8;

/** Upper case, letters and digits only. "ab-c d23" -> "ABCD23". */
export function normaliseInviteCode(input: string): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** True when the normalised code has a valid length and alphabet. */
export function isInviteCodeShape(code: string): boolean {
  if (code.length < INVITE_MIN_LENGTH || code.length > INVITE_MAX_LENGTH) return false;
  for (const ch of code) if (!INVITE_ALPHABET.includes(ch)) return false;
  return true;
}

/** Invite link for a code (the Gate route /i/{code}). */
export function inviteLink(code: string, appUrl = "https://app.cojam.app"): string {
  return `${appUrl.replace(/\/$/, "")}/i/${code}`;
}

/** Masks a name for public lists: first two characters and the last, the rest as asterisks. */
export function maskName(name: string): string {
  const chars = [...name];
  if (chars.length <= 3) return chars[0] + "*".repeat(Math.max(1, chars.length - 1));
  return chars.slice(0, 2).join("") + "*".repeat(chars.length - 3) + chars[chars.length - 1];
}

/** Short address for display: 0x7A3f…1C7e. */
export function shortAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
