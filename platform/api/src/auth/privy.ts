// Access token verification and user lookup.
//   AuthVerifier.verify(token)      -> the Privy user id from a verified access token (signature, app id, expiry)
//   AuthVerifier.profile(userId)    -> the verified email and the embedded wallet from Privy's user record (cached)
// Production uses Privy (@privy-io/node). Tests pass a stub. The dev bypass (AUTH_DEV_BYPASS=1, never in
// production) derives a deterministic user from the X-Dev-User header so the PWA can run against a local API.
import { verifyAccessToken, PrivyClient } from "@privy-io/node";
import { createRemoteJWKSet } from "jose";
import { getAddress, keccak256, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface VerifiedToken {
  privyUserId: string;
}
export interface PrivyProfile {
  email: string | null;
  wallet: Address | null;
}
export interface AuthVerifier {
  verify(token: string): Promise<VerifiedToken>;
  profile(privyUserId: string, opts?: { fresh?: boolean }): Promise<PrivyProfile>;
}

export class AuthFailed extends Error {}

/** Picks the verified email and the Privy embedded Ethereum wallet from a Privy user record. */
export function profileFromPrivyUser(user: { linked_accounts?: any[] }): PrivyProfile {
  const accounts = Array.isArray(user?.linked_accounts) ? user.linked_accounts : [];
  const email = accounts.find((a) => a?.type === "email" && typeof a.address === "string")?.address ?? null;
  const embedded = accounts.find(
    (a) => a?.type === "wallet" && a.chain_type === "ethereum" && (a.wallet_client_type === "privy" || a.connector_type === "embedded"),
  );
  return { email, wallet: embedded?.address ? (getAddress(embedded.address).toLowerCase() as Address) : null };
}

export function createPrivyVerifier(opts: { appId: string; appSecret?: string; verificationKey?: string; cacheMs?: number }): AuthVerifier {
  const key = opts.verificationKey
    ? opts.verificationKey.replace(/\\n/g, "\n")
    : createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${opts.appId}/jwks.json`));
  const client = opts.appSecret ? new PrivyClient({ appId: opts.appId, appSecret: opts.appSecret }) : null;
  const cache = new Map<string, { p: PrivyProfile; until: number }>();
  const cacheMs = opts.cacheMs ?? 5 * 60_000;
  return {
    async verify(token) {
      try {
        const r = await verifyAccessToken({ access_token: token, app_id: opts.appId, verification_key: key as any });
        return { privyUserId: r.user_id };
      } catch (e) {
        throw new AuthFailed((e as Error).message);
      }
    },
    async profile(privyUserId, o) {
      const hit = cache.get(privyUserId);
      // A profile without a wallet is not cached: the embedded wallet appears right after the first login.
      if (!o?.fresh && hit && hit.until > Date.now() && hit.p.wallet) return hit.p;
      if (!client) throw new AuthFailed("PRIVY_APP_SECRET is not configured: user lookup is unavailable");
      const user = await client.users()._get(privyUserId);
      const p = profileFromPrivyUser(user as any);
      cache.set(privyUserId, { p, until: Date.now() + cacheMs });
      if (cache.size > 20_000) cache.clear();
      return p;
    },
  };
}

// ---------------------------------------------------------------- dev bypass

/** Deterministic dev wallet key for a dev user name (never used outside AUTH_DEV_BYPASS). */
export function devWalletKey(name: string): Hex {
  return keccak256(toHex(`cojam-dev-wallet:${name}`));
}

export function devIdentity(name: string): { privyUserId: string; email: string; wallet: Address } {
  const clean = name.trim().toLowerCase();
  const email = clean.includes("@") ? clean : `${clean}@gmail.com`;
  return {
    privyUserId: `dev:${clean}`,
    email,
    wallet: privateKeyToAccount(devWalletKey(clean)).address.toLowerCase() as Address,
  };
}

/** Token = "dev:<name>" (sent by the auth hook from the X-Dev-User header). */
export function createDevVerifier(): AuthVerifier {
  return {
    async verify(token) {
      if (!token.startsWith("dev:") || token.length < 5) throw new AuthFailed("dev token must be dev:<name>");
      return { privyUserId: devIdentity(token.slice(4)).privyUserId };
    },
    async profile(privyUserId) {
      if (!privyUserId.startsWith("dev:")) throw new AuthFailed("not a dev user");
      const id = devIdentity(privyUserId.slice(4));
      return { email: id.email, wallet: id.wallet };
    },
  };
}
