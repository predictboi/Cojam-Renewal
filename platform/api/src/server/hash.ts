// Keyed hashes so the database never lists addresses or IPs in the clear (DEV-PLAN 5.1, 4.8).
import { createHmac } from "node:crypto";

export function emailHash(key: string, normalisedAddress: string): string {
  return createHmac("sha256", key).update(`email:${normalisedAddress}`).digest("hex");
}

export function ipHash(salt: string, ip: string | undefined): string | null {
  if (!ip) return null;
  return createHmac("sha256", salt).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

/** Device ids are random strings the PWA keeps; accept only a sane shape. */
export function cleanDeviceId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}
