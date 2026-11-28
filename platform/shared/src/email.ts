// Email normalisation for the sign up allow list (DEV-PLAN 5.1). The PWA uses it for the message only;
// the API is authoritative (it also applies the rule stored per domain in email_domains).
//   1. trim, lower case, googlemail.com -> gmail.com
//   2. rule gmail: drop every "." in the local part and everything from the first "+"
//   3. rule plus (default for listed domains): drop everything from the first "+"
//   4. reject an empty local part, more than one "@", or a malformed domain

export type EmailRule = "gmail" | "plus" | "none";

export interface NormalisedEmail {
  /** Normalised full address (local@domain). */
  address: string;
  local: string;
  domain: string;
}

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOCAL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/;

/** Splits and folds the domain only (no rule applied). Returns null when the address is malformed. */
export function splitEmail(input: string): { local: string; domain: string } | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  const parts = s.split("@");
  if (parts.length !== 2) return null;
  let [local, domain] = parts;
  if (!local || !domain) return null;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (!DOMAIN_RE.test(domain) || !LOCAL_RE.test(local)) return null;
  return { local, domain };
}

/**
 * Normalises an address with `rule` (default: gmail for gmail.com, plus otherwise).
 * Returns null when the address is invalid or its local part is empty after the rule.
 */
export function normaliseEmail(input: string, rule?: EmailRule): NormalisedEmail | null {
  const parts = splitEmail(input);
  if (!parts) return null;
  const r: EmailRule = rule ?? (parts.domain === "gmail.com" ? "gmail" : "plus");
  let local = parts.local;
  if (r === "gmail" || r === "plus") {
    const plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
  }
  if (r === "gmail") local = local.replace(/\./g, "");
  if (!local) return null;
  return { address: `${local}@${parts.domain}`, local, domain: parts.domain };
}
