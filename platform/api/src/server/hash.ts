// Keyed hashes so the database never lists addresses or IPs in the clear (DEV-PLAN 5.1, 4.8).
import { createHmac } from "node:crypto";
import { localPartShape } from "../risk/rules.ts";

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

/**
 * Keyed hash of the local part's shape (digits folded, separators dropped) with the domain, read by the
 * worker's look alike rule (`localPartShape` in src/risk/rules.ts): hana12@ and hana7@ share a shape.
 */
export function emailShapeHash(key: string, normalisedAddress: string): string | null {
  const at = normalisedAddress.lastIndexOf("@");
  if (at <= 0) return null;
  const local = normalisedAddress.slice(0, at);
  const domain = normalisedAddress.slice(at + 1);
  return createHmac("sha256", key).update(`shape:${domain}:${localPartShape(local)}`).digest("hex");
}
