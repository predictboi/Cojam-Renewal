// The sponsorship pipeline behind POST /v1/tx/sponsor (DEV-PLAN 4.4, 4.5, 4.8, 6.3), ported from
// server/src/feePayer.js and platform/spike/api/src/feePayer.js with limits and idempotency in Postgres:
//   decode -> static policy -> idempotency -> sender rule (play key or bearer wallet) -> player state (frozen,
//   registered) -> action checks -> fee payer balance floor -> simulation (eth_estimateGas from the sender)
//   -> atomic reservation (limits, budget, sponsored_txs row) -> co-sign -> kaia_sendRawTransaction
//   -> commit, then settle the real fee from the receipt.
// The answer comes once the node accepted the transaction (not after mining).
import { keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Db } from "../db/index.ts";
import type { ChainReader, PlayKeyBinding, RawRpc } from "../chain/index.ts";
import { RpcError } from "../chain/index.ts";
import { ApiError } from "../server/errors.ts";
import { LimitHit, giveBack, addSpent, reserveBudget, takeSlotsIn, utcDay, utcMinute, type Slot } from "../server/limits.ts";
import { decodeSenderTx, coSignAsFeePayer, type SenderTx } from "./decode.ts";
import { checkStatic, decodeRevert, revertToError, type PolicyConfig, type StaticResult } from "./policy.ts";
import type { SponsorResponse, SponsoredAction } from "../../../shared/src/api.ts";

export interface FeePayerLimits {
  predictPerDay: number;
  setPlayKeyPerDay: number;
  otherPerDay: number;
  ipPerDay: number;
  burstPerMinute: number;
  dailyBudgetWei: bigint;
  minBalanceWei: bigint;
  simulate: boolean;
}

export interface SponsorAuth {
  privyUserId: string;
  wallet: Address | null;
}

export interface SponsorContext {
  auth: SponsorAuth | null;
  ipHash: string | null;
}

export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface FeePayerDeps {
  db: Db;
  chain: ChainReader;
  rpc: RawRpc;
  policy: Omit<PolicyConfig, "feePayer">;
  privateKey: Hex;
  limits: FeePayerLimits;
  logger: Logger;
  now?: () => number;
  receiptPollMs?: number;
  receiptTries?: number;
}

export interface FeePayerService {
  address: Address;
  sponsor(raw: unknown, ctx: SponsorContext): Promise<SponsorResponse>;
  /** Refresh a sponsored tx from its receipt (GET /v1/tx/:hash and the startup sweep). */
  refresh(txHash: string): Promise<void>;
  /** Settle rows left in broadcast or uncertain (for example after a restart). */
  sweep(): Promise<number>;
  /** Waits for background receipt polling (tests and shutdown). */
  drain(): Promise<void>;
}

const WALLET_ACTIONS = new Set<SponsoredAction>(["setPlayKey", "settle", "convert", "approve", "stake", "claimInterest", "withdraw"]);

export function createFeePayerService(deps: FeePayerDeps): FeePayerService {
  const { db, chain, rpc, limits, logger } = deps;
  const now = deps.now ?? (() => Date.now());
  const account = privateKeyToAccount(deps.privateKey);
  const feePayer = account.address;
  const policy: PolicyConfig = { ...deps.policy, feePayer };
  const receiptPollMs = deps.receiptPollMs ?? 2000;
  const receiptTries = deps.receiptTries ?? 45;

  const inflight = new Map<string, Promise<SponsorResponse>>();
  const pending = new Set<Promise<void>>();
  const bindingCache = new Map<string, { b: PlayKeyBinding; until: number }>();
  let balanceCache: { wei: bigint; until: number } | null = null;
  let budgetCache: { wei: bigint; until: number } | null = null;
  let paramsCache: { pointsPerCT: number; minConvertPoints: number; until: number } | null = null;
  let stakingCache: { minStake: bigint; until: number } | null = null;

  async function readChain<T>(fn: () => Promise<T>, what: string): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("RPC_UNAVAILABLE", `Kaia RPC is unavailable (${what}), try again shortly`);
    }
  }

  async function bindingOf(key: Address): Promise<PlayKeyBinding> {
    const k = key.toLowerCase();
    const hit = bindingCache.get(k);
    const t = now();
    if (hit && hit.until > t) return hit.b;
    const b = await readChain(() => chain.playerOf(key), "playerOf");
    if (b.valid) bindingCache.set(k, { b, until: Math.min(t + 60_000, b.expiresAt * 1000) });
    if (bindingCache.size > 50_000) bindingCache.clear();
    return b;
  }

  async function feePayerBalance(): Promise<bigint> {
    const t = now();
    if (balanceCache && balanceCache.until > t) return balanceCache.wei;
    const wei = await readChain(() => chain.kaiaBalance(feePayer), "fee payer balance");
    balanceCache = { wei, until: t + 10_000 };
    return wei;
  }

  /** Global daily budget: 3 x the 7 day average spend, at least DAILY_BUDGET_KAIA (DEV-PLAN 4.8). */
  async function dailyBudget(): Promise<bigint> {
    const t = now();
    if (budgetCache && budgetCache.until > t) return budgetCache.wei;
    const days = Array.from({ length: 7 }, (_, i) => utcDay(t - (i + 1) * 86_400_000));
    const rows = await db.selectFrom("usage_daily").select("spent_wei").where("key", "=", "budget").where("day", "in", days).execute();
    const sum = rows.reduce((acc, r) => acc + BigInt(r.spent_wei), 0n);
    const avg3 = (sum * 3n) / 7n;
    const wei = avg3 > limits.dailyBudgetWei ? avg3 : limits.dailyBudgetWei;
    budgetCache = { wei, until: t + 300_000 };
    return wei;
  }

  async function convertParams() {
    const t = now();
    if (paramsCache && paramsCache.until > t) return paramsCache;
    const p = await readChain(() => chain.params(), "params");
    paramsCache = { pointsPerCT: p.pointsPerCT, minConvertPoints: p.minConvertPoints, until: t + 60_000 };
    return paramsCache;
  }

  async function minStake(): Promise<bigint> {
    const t = now();
    if (stakingCache && stakingCache.until > t) return stakingCache.minStake;
    const s = await readChain(() => chain.stakingState(), "staking state");
    stakingCache = { minStake: s.minStake, until: t + 60_000 };
    return s.minStake;
  }

  /** The sender rule. Returns the player the call acts for and whether a play key sent it. */
  async function resolveSender(tx: SenderTx, st: StaticResult, auth: SponsorAuth | null): Promise<{ player: Address; viaKey: boolean }> {
    const from = tx.from.toLowerCase() as Address;
    const authWallet = auth?.wallet?.toLowerCase() ?? null;
    if (st.action === "predict" || st.action === "revokePlayKey") {
      const b = await bindingOf(tx.from);
      const bound = b.player && !/^0x0{40}$/i.test(b.player);
      if (bound) {
        if (st.action === "predict" && !b.valid) throw new ApiError("PLAY_KEY_INVALID", "The play key has expired: renew it with setPlayKey");
        const player = b.player.toLowerCase() as Address;
        if (authWallet && authWallet !== player) throw new ApiError("SENDER_NOT_ALLOWED", "The play key belongs to another player");
        return { player, viaKey: true };
      }
      if (authWallet && authWallet === from) return { player: from, viaKey: false };
      if (!auth) throw new ApiError("PLAY_KEY_INVALID", "The sender is not a current play key (expired, revoked or replaced)");
      if (!authWallet) throw new ApiError("WALLET_MISSING");
      throw new ApiError("PLAY_KEY_INVALID", "The sender is neither the bearer's wallet nor a current play key");
    }
    if (!WALLET_ACTIONS.has(st.action)) throw new ApiError("SELECTOR_NOT_ALLOWED");
    if (!auth) throw new ApiError("AUTH_REQUIRED");
    if (!authWallet) throw new ApiError("WALLET_MISSING");
    if (authWallet !== from) throw new ApiError("SENDER_NOT_ALLOWED", `${st.action} must be sent by the bearer's embedded wallet`);
    return { player: from, viaKey: false };
  }

  async function checkPlayer(player: Address): Promise<void> {
    const row = await db.selectFrom("users").select(["frozen", "registration"]).where("wallet", "=", player).executeTakeFirst();
    if (row?.frozen) throw new ApiError("FROZEN");
    const p = await readChain(() => chain.player(player), "player");
    if (p.frozen) throw new ApiError("FROZEN");
    if (!p.registered) throw new ApiError("NOT_REGISTERED");
  }

  async function checkAction(st: StaticResult, player: Address): Promise<void> {
    const a = st.args;
    if (a.action === "predict") {
      const done = await db
        .selectFrom("predictions")
        .select("choice")
        .where("wallet", "=", player)
        .where("market_id", "=", a.marketId)
        .executeTakeFirst();
      if (done) throw new ApiError("ALREADY_DONE", `Market ${a.marketId} is already answered`, { choice: done.choice });
      const mined = await db
        .selectFrom("sponsored_txs")
        .select("tx_hash")
        .where("wallet", "=", player)
        .where("action", "=", "predict")
        .where("market_id", "=", a.marketId)
        .where("status", "=", "mined")
        .executeTakeFirst();
      if (mined) throw new ApiError("ALREADY_DONE", `Market ${a.marketId} is already answered`, { txHash: mined.tx_hash });
    } else if (a.action === "convert") {
      const p = await convertParams();
      if (a.points % BigInt(p.pointsPerCT) !== 0n) throw new ApiError("NOT_MULTIPLE_OF_RATE", `Points must be a multiple of ${p.pointsPerCT}`);
      if (a.points < BigInt(p.minConvertPoints)) throw new ApiError("BELOW_MINIMUM", `At least ${p.minConvertPoints} points`);
    } else if (a.action === "stake") {
      const min = await minStake();
      if (a.amount < min) throw new ApiError("BELOW_MIN_STAKE", `At least ${min} base units`, { minStakeWei: min.toString() });
    }
  }

  async function simulate(tx: SenderTx, viaKey: boolean, tokenless: boolean): Promise<void> {
    let estimate: bigint;
    try {
      const r = await rpc("eth_estimateGas", [{ from: tx.from, to: tx.to, data: tx.data, value: "0x0" }]);
      estimate = BigInt(r as string);
    } catch (e) {
      if (e instanceof RpcError && e.isNodeReply) {
        const rev = decodeRevert(e.nodeData);
        if (rev?.name === "NotRegistered" && (viaKey || tokenless)) {
          bindingCache.delete(tx.from.toLowerCase());
          throw new ApiError("PLAY_KEY_INVALID", "The play key no longer serves a player (replaced or revoked)");
        }
        if (rev?.name === "BadPlayKey") bindingCache.delete(tx.from.toLowerCase());
        throw revertToError(rev, e.nodeMessage);
      }
      throw new ApiError("RPC_UNAVAILABLE", "Kaia RPC is unavailable (simulation), try again shortly");
    }
    if (estimate > tx.gasLimit) {
      throw new ApiError("GAS_LIMIT_TOO_LOW", `Gas limit ${tx.gasLimit} is below the estimate ${estimate}`, { estimate: estimate.toString() });
    }
  }

  function slotsFor(st: StaticResult, player: Address, ctx: SponsorContext, t: number): Slot[] {
    const day = utcDay(t);
    const kind = st.action === "predict" ? "predict" : st.action === "setPlayKey" ? "setPlayKey" : "other";
    const limit = kind === "predict" ? limits.predictPerDay : kind === "setPlayKey" ? limits.setPlayKeyPerDay : limits.otherPerDay;
    const slots: Slot[] = [
      { bucket: utcMinute(t), key: `burst:${player}`, limit: limits.burstPerMinute, code: "RATE_LIMITED_BURST" },
      { bucket: day, key: `${kind}:${player}`, limit, code: "RATE_LIMITED_SENDER" },
    ];
    if (ctx.auth) slots.push({ bucket: day, key: `user:${kind}:${ctx.auth.privyUserId}`, limit, code: "RATE_LIMITED_USER" });
    if (ctx.ipHash) slots.push({ bucket: day, key: `ip:${ctx.ipHash}`, limit: limits.ipPerDay, code: "RATE_LIMITED_IP" });
    return slots;
  }

  async function settleLater(senderTxHash: string, txHash: string, reservedWei: bigint, day: string): Promise<void> {
    for (let i = 0; i < receiptTries; i++) {
      await new Promise((r) => setTimeout(r, receiptPollMs));
      if (await settleFromReceipt(senderTxHash, txHash, reservedWei, day)) return;
    }
  }

  async function settleFromReceipt(senderTxHash: string, txHash: string, reservedWei: bigint, day: string): Promise<boolean> {
    let rc: any;
    try {
      rc = await rpc("kaia_getTransactionReceipt", [txHash]);
    } catch {
      return false;
    }
    if (!rc) return false;
    const gasUsed = BigInt(rc.gasUsed ?? 0);
    const price = BigInt(rc.effectiveGasPrice ?? rc.gasPrice ?? 0);
    const actual = gasUsed * price;
    const ok = Number(BigInt(rc.status ?? 0)) === 1;
    const updated = await db
      .updateTable("sponsored_txs")
      .set({ status: ok ? "mined" : "reverted", actual_wei: actual.toString(), updated_at: new Date() })
      .where("sender_tx_hash", "=", senderTxHash)
      .where("status", "in", ["broadcast", "uncertain"])
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) > 0) await addSpent(db, day, "budget", actual - reservedWei);
    if (!ok) logger.warn({ txHash }, "sponsored tx reverted on chain: the fee payer still paid the fee");
    return true;
  }

  function track(p: Promise<void>) {
    const q = p.catch((e) => logger.error({ err: String(e) }, "receipt polling failed")).finally(() => pending.delete(q));
    pending.add(q);
  }

  async function run(raw: unknown, ctx: SponsorContext): Promise<SponsorResponse> {
    const t = now();
    const tx = await decodeSenderTx(raw);
    const st = checkStatic(tx, policy, Math.floor(t / 1000));

    // Idempotency: the same signed transaction posted twice is broadcast once.
    const prior = await db.selectFrom("sponsored_txs").selectAll().where("sender_tx_hash", "=", tx.senderTxHash).executeTakeFirst();
    if (prior && prior.tx_hash && ["broadcast", "uncertain", "mined", "reverted"].includes(prior.status)) {
      return { txHash: prior.tx_hash, action: st.action, from: tx.from.toLowerCase() as Address, player: (prior.wallet ?? tx.from.toLowerCase()) as Address, nonce: tx.nonce, duplicate: true };
    }

    const { player, viaKey } = await resolveSender(tx, st, ctx.auth);
    await checkPlayer(player);
    await checkAction(st, player);

    const balance = await feePayerBalance();
    if (balance < limits.minBalanceWei || balance < st.maxCostWei) {
      throw new ApiError("FEE_PAYER_BALANCE_LOW", `The fee payer ${feePayer} is below its floor`);
    }
    if (limits.simulate) await simulate(tx, viaKey, !ctx.auth);

    const day = utcDay(t);
    const slots = slotsFor(st, player, ctx, t);
    const budget = await dailyBudget();
    const marketId = st.args.action === "predict" ? st.args.marketId : null;
    try {
      await db.transaction().execute(async (trx) => {
        await takeSlotsIn(trx, slots);
        if (!(await reserveBudget(trx, day, st.maxCostWei, budget))) throw new LimitHit("DAILY_BUDGET_EXHAUSTED", slots[0]);
        const row = {
          sender_tx_hash: tx.senderTxHash,
          sender: tx.from.toLowerCase(),
          wallet: player,
          privy_user_id: ctx.auth?.privyUserId ?? null,
          action: st.action,
          target: tx.to!.toLowerCase(),
          market_id: marketId,
          choice: st.args.action === "predict" ? st.args.choice : null,
          nonce: tx.nonce,
          status: "reserved" as const,
          reserved_wei: st.maxCostWei.toString(),
          ip_hash: ctx.ipHash,
        };
        const ins = await trx
          .insertInto("sponsored_txs")
          .values(row)
          .onConflict((oc) =>
            oc.column("sender_tx_hash").doUpdateSet({ ...row, tx_hash: null, error_code: null, updated_at: new Date() }).where("sponsored_txs.status", "in", ["released", "rejected"]),
          )
          .executeTakeFirst();
        if (Number(ins.numInsertedOrUpdatedRows ?? 0) === 0) throw new ApiError("CONFLICT", "This transaction is being processed; retry in a moment");
      });
    } catch (e) {
      if (e instanceof LimitHit) {
        const code = e.code as "RATE_LIMITED_BURST" | "RATE_LIMITED_SENDER" | "RATE_LIMITED_USER" | "RATE_LIMITED_IP" | "DAILY_BUDGET_EXHAUSTED";
        throw new ApiError(code, undefined, code === "DAILY_BUDGET_EXHAUSTED" ? undefined : { limit: e.slot.limit });
      }
      throw e;
    }

    const release = async (code: string) => {
      await db.transaction().execute(async (trx) => {
        await giveBack(trx, slots);
        await addSpent(trx, day, "budget", -st.maxCostWei);
        await trx
          .updateTable("sponsored_txs")
          .set({ status: "released", error_code: code, updated_at: new Date() })
          .where("sender_tx_hash", "=", tx.senderTxHash)
          .execute();
      });
    };

    let signed: Hex;
    try {
      signed = await coSignAsFeePayer(tx, feePayer, deps.privateKey);
    } catch {
      await release("INTERNAL");
      throw new ApiError("INTERNAL", "Fee payer signing failed");
    }

    let txHash: string;
    let status: "broadcast" | "uncertain" = "broadcast";
    try {
      txHash = String(await rpc("kaia_sendRawTransaction", [signed]));
    } catch (e) {
      if (e instanceof RpcError && e.isNodeReply) {
        if (/known transaction|already known/i.test(e.nodeMessage)) {
          txHash = keccak256(signed);
        } else {
          await release("BROADCAST_REJECTED");
          throw new ApiError("BROADCAST_REJECTED", `The node rejected the transaction: ${e.nodeMessage || "unknown reason"}`, { reason: e.nodeMessage });
        }
      } else {
        // Transport failure: the node may have accepted it. On Kaia the hash is keccak256 of the fully signed RLP.
        txHash = keccak256(signed);
        status = "uncertain";
      }
    }

    await db
      .updateTable("sponsored_txs")
      .set({ status, tx_hash: txHash, updated_at: new Date() })
      .where("sender_tx_hash", "=", tx.senderTxHash)
      .execute();
    track(settleLater(tx.senderTxHash, txHash, st.maxCostWei, day));
    logger.info({ decision: "accepted", action: st.action, from: tx.from, player, viaKey, nonce: tx.nonce, txHash, serverMs: now() - t }, "fee delegation accepted");
    if (status === "uncertain") {
      throw new ApiError("BROADCAST_UNCERTAIN", "The RPC did not answer; the transaction may still be on its way. Check the hash before retrying", { txHash });
    }
    return { txHash, action: st.action, from: tx.from.toLowerCase() as Address, player, nonce: tx.nonce, duplicate: false };
  }

  return {
    address: feePayer,
    async sponsor(raw, ctx) {
      const key = typeof raw === "string" ? raw.toLowerCase() : null;
      if (key && inflight.has(key)) {
        const r = await inflight.get(key)!;
        return { ...r, duplicate: true };
      }
      const p = run(raw, ctx).catch((e) => {
        if (!(e instanceof ApiError)) logger.error({ err: String(e?.stack ?? e) }, "unexpected error in fee delegation");
        else logger.info({ decision: "rejected", code: e.code, reason: e.message }, "fee delegation rejected");
        throw e instanceof ApiError ? e : new ApiError("INTERNAL", "Unexpected error");
      });
      if (key) {
        inflight.set(key, p);
        p.finally(() => inflight.delete(key)).catch(() => {});
      }
      return p;
    },
    async refresh(txHash) {
      const row = await db.selectFrom("sponsored_txs").selectAll().where("tx_hash", "=", txHash).executeTakeFirst();
      if (!row || !["broadcast", "uncertain"].includes(row.status)) return;
      await settleFromReceipt(row.sender_tx_hash, txHash, BigInt(row.reserved_wei), utcDay(row.created_at.getTime()));
    },
    async sweep() {
      const rows = await db
        .selectFrom("sponsored_txs")
        .select(["sender_tx_hash", "tx_hash", "reserved_wei", "created_at"])
        .where("status", "in", ["broadcast", "uncertain"])
        .where("tx_hash", "is not", null)
        .limit(500)
        .execute();
      let n = 0;
      for (const r of rows) {
        if (await settleFromReceipt(r.sender_tx_hash, r.tx_hash!, BigInt(r.reserved_wei), utcDay(r.created_at.getTime()))) n++;
        else if (now() - r.created_at.getTime() > 3_600_000) {
          await db.updateTable("sponsored_txs").set({ status: "released", error_code: "NO_RECEIPT", updated_at: new Date() }).where("sender_tx_hash", "=", r.sender_tx_hash).execute();
        }
      }
      return n;
    },
    async drain() {
      await Promise.all([...pending]);
    },
  };
}
