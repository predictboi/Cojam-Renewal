// Dev only chain stand in (DEV_CHAIN=stub, refused in production): the API runs with no Kaia node and no
// deployed contracts, so the PWA can be built end to end against a local API. Reads come from Postgres
// (users, play_keys, predictions, points_ledger, stakes); a sponsored transaction is "mined" at once by applying
// its effect to the same tables the indexer fills (predict, setPlayKey, revokePlayKey, convert). Balances of CT
// and KAIA are fixed demo figures. Nothing here is used by the real services.
import { decodeFunctionData, encodeFunctionResult, keccak256, toHex, type Address, type Hex } from "viem";
import { parseTransaction } from "@kaiachain/js-ext-core";
import { sql, type Db } from "../db/index.ts";
import { cojamPredictAbi, cojamStakingAbi } from "./abi.ts";
import type { ChainReader, RawRpc, StakingPositionView } from "./index.ts";
import { DEFAULT_PARAMS } from "../routes/common.ts";
import { dayOfMarket, weekOf } from "../../../shared/src/time.ts";

const CT = 10n ** 18n;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const LOCK_DAYS = [30, 90, 180, 365];
const RATES = [
  [800, 900, 1000],
  [1200, 1300, 1400],
  [1800, 1900, 2000],
  [2500, 2600, 2700],
];

export function createDevStubChain(db: Db, feePayer?: () => Address | undefined): { chain: ChainReader; rpc: RawRpc } {
  const lc = (a: string) => a.toLowerCase();
  const nowS = () => Math.floor(Date.now() / 1000);
  const receipts = new Map<string, object>();
  let block = 1_000_000;

  const chain: ChainReader = {
    async blockNumber() {
      return block;
    },
    async kaiaBalance(a) {
      return feePayer?.() && lc(a) === lc(feePayer()!) ? 1000n * CT : 2n * CT + 400_000_000_000_000_000n;
    },
    async ctBalance() {
      return 1840n * CT + 500_000_000_000_000_000n;
    },
    async ctAllowance() {
      return 0n;
    },
    async pointsBalance(a) {
      const r = await db.selectFrom("points_ledger").select(sql<number>`coalesce(sum(amount),0)::bigint`.as("s")).where("wallet", "=", lc(a)).executeTakeFirst();
      return BigInt(r?.s ?? 0);
    },
    async player(w) {
      const u = await db.selectFrom("users").select(["registration", "frozen", "registered_at"]).where("wallet", "=", lc(w)).executeTakeFirst();
      const ref = await db.selectFrom("referrals").select("inviter").where("invitee", "=", lc(w)).executeTakeFirst();
      return {
        referrer: (ref?.inviter as Address) ?? ZERO,
        registeredAt: u?.registered_at ? Math.floor(u.registered_at.getTime() / 1000) : 0,
        registered: u?.registration === "registered",
        frozen: Boolean(u?.frozen),
        completedOnce: false,
      };
    },
    async playerOf(k) {
      const r = await db.selectFrom("play_keys").selectAll().where("key", "=", lc(k)).where("revoked_tx", "is", null).where("replaced_by", "is", null).executeTakeFirst();
      if (!r) return { player: ZERO, expiresAt: 0, valid: false };
      const exp = Math.floor(r.expires_at.getTime() / 1000);
      return { player: r.wallet as Address, expiresAt: exp, valid: exp > nowS() };
    },
    async playKeyOf(w) {
      const r = await db.selectFrom("play_keys").selectAll().where("wallet", "=", lc(w)).where("revoked_tx", "is", null).where("replaced_by", "is", null).orderBy("created_at", "desc").executeTakeFirst();
      return r ? { key: r.key as Address, expiresAt: Math.floor(r.expires_at.getTime() / 1000) } : { key: ZERO, expiresAt: 0 };
    },
    async dayOf(w, d) {
      const preds = await db.selectFrom("predictions").select(["market_id", "choice"]).where("wallet", "=", lc(w)).where("day_id", "=", d).execute();
      const ud = await db.selectFrom("user_days").selectAll().where("wallet", "=", lc(w)).where("day_id", "=", d).executeTakeFirst();
      const choices = [0, 0, 0, 0, 0];
      for (const p of preds) choices[p.market_id % 5] = p.choice;
      return { answered: preds.length, choices, completed: preds.length === 5, settledMask: ud?.settled_mask ?? 0, hits: ud?.hits ?? 0 };
    },
    async pendingHits(w, d) {
      // Hits on resolved markets of the day whose settle time is still ahead (the indexer view of pendingHits).
      const rows = await db
        .selectFrom("predictions as p")
        .innerJoin("markets as m", "m.market_id", "p.market_id")
        .select(["p.choice", "m.outcome", "m.corrected_outcome", "m.settles_at"])
        .where("p.wallet", "=", lc(w))
        .where("p.day_id", "=", d)
        .execute();
      let points = 0n;
      let landsAt = 0;
      for (const r of rows) {
        const out = r.corrected_outcome ?? r.outcome;
        const at = r.settles_at ? Math.floor(r.settles_at.getTime() / 1000) : 0;
        if ((out === 1 || out === 2) && out === r.choice && at > nowS()) {
          points += BigInt(DEFAULT_PARAMS.hitPoints);
          if (!landsAt || at < landsAt) landsAt = at;
        }
      }
      return { points, landsAt };
    },
    async params() {
      return DEFAULT_PARAMS;
    },
    async pendingParams() {
      return { params: DEFAULT_PARAMS, applyAfter: 0 };
    },
    async market(id) {
      const m = await db.selectFrom("markets").selectAll().where("market_id", "=", id).executeTakeFirst();
      const t = (d: Date | null | undefined) => (d ? Math.floor(d.getTime() / 1000) : 0);
      return { closesAt: t(m?.closes_at), resolvesAt: t(m?.resolves_at), resolvedAt: t(m?.resolved_at), settlesAt: t(m?.settles_at), outcome: m?.outcome ?? 0, correctedOutcome: m?.corrected_outcome ?? 0, contentHash: (m?.content_hash ?? "0x") as Hex };
    },
    async reserve() {
      return 250_000n * CT;
    },
    async convertedCtOnDay() {
      return 0n;
    },
    async convertedCtTotalOnDay() {
      return 0n;
    },
    async predictPaused() {
      return false;
    },
    async stakingQuote(amount, lockIndex) {
      const tier = amount >= 10_000n * CT ? 2 : amount >= 1000n * CT ? 1 : 0;
      const apr = RATES[lockIndex][tier];
      const secs = LOCK_DAYS[lockIndex] * 86400;
      return { tier, aprBps: apr, interest: (amount * BigInt(apr) * BigInt(secs)) / (10_000n * 365n * 86400n), end: nowS() + secs };
    },
    async stakingState() {
      return {
        minStake: 100n * CT,
        minClaim: 10n * CT,
        maxOpenPositions: 20,
        maxTotalPrincipal: 1_850_000n * CT,
        maxUserPrincipal: 1_000_000n * CT,
        totalPrincipal: 120_000n * CT,
        availableRewards: 480_000n * CT,
        paused: false,
      };
    },
    async stakingPrincipalOf(w) {
      return (await this.stakingPositions(w)).filter((p) => !p.closed).reduce((a, p) => a + p.principal, 0n);
    },
    async stakingOpenPositions(w) {
      return (await this.stakingPositions(w)).filter((p) => !p.closed).length;
    },
    async stakingPositions(w): Promise<StakingPositionView[]> {
      const rows = await db.selectFrom("stakes").selectAll().where("wallet", "=", lc(w)).orderBy("position_id").execute();
      const t = nowS();
      return rows.map((r) => {
        const start = Math.floor(r.start_at.getTime() / 1000);
        const end = Math.floor(r.end_at.getTime() / 1000);
        const principal = BigInt(r.principal);
        const earned = (principal * BigInt(r.apr_bps) * BigInt(Math.max(0, Math.min(t, end) - start))) / (10_000n * 365n * 86400n);
        const claimed = BigInt(r.claimed);
        return { id: r.position_id, principal, maxInterest: BigInt(r.max_interest), claimed, claimable: r.closed ? 0n : earned - claimed, start, end, aprBps: r.apr_bps, lockIndex: r.lock_index, closed: r.closed };
      });
    },
    async stakingPosition(w, id) {
      return (await this.stakingPositions(w)).find((p) => p.id === id) ?? null;
    },
  };

  /** Applies a sponsored transaction's effect, as the indexer would after mining. */
  async function apply(raw: Hex, txHash: string) {
    const p: any = parseTransaction(raw);
    const from = lc(p.from);
    let call: { functionName: string; args?: readonly unknown[] };
    try {
      call = decodeFunctionData({ abi: cojamPredictAbi, data: p.data ?? p.input });
    } catch {
      await applyStaking(from, p.data ?? p.input, txHash);
      return;
    }
    const b = ++block;
    if (call.functionName === "predict") {
      const key = await chain.playerOf(from as Address);
      const player = key.player !== ZERO ? key.player : from;
      const marketId = Number(call.args![0] as bigint);
      const day = dayOfMarket(marketId);
      await db
        .insertInto("predictions")
        .values({ wallet: player, market_id: marketId, day_id: day, choice: Number(call.args![1]), tx_hash: txHash, block: b, block_time: new Date() })
        .onConflict((oc) => oc.doNothing())
        .execute();
      const n = (await db.selectFrom("predictions").select("market_id").where("wallet", "=", player).where("day_id", "=", day).execute()).length;
      await db
        .insertInto("user_days")
        .values({ wallet: player, day_id: day, answered: n, completed: n === 5, completed_at: n === 5 ? new Date() : null, completion_points: n === 5 ? 100 : 0 })
        .onConflict((oc) => oc.columns(["wallet", "day_id"]).doUpdateSet({ answered: n, completed: n === 5, completed_at: n === 5 ? new Date() : null, completion_points: n === 5 ? 100 : 0 }))
        .execute();
      if (n === 5) {
        await db
          .insertInto("points_ledger")
          .values({ wallet: player, kind: "completion", amount: 100, day_id: day, week_id: weekOf(day), ranked: true, tx_hash: txHash, log_index: 0, block: b, block_time: new Date() })
          .onConflict((oc) => oc.doNothing())
          .execute();
        await sql`INSERT INTO week_totals (week_id, wallet, points, last_completion_at, last_credit_block) VALUES (${weekOf(day)}, ${player}, 100, now(), ${b})
                  ON CONFLICT (week_id, wallet) DO UPDATE SET points = week_totals.points + 100, last_completion_at = now(), last_credit_block = ${b}`.execute(db);
      }
    } else if (call.functionName === "setPlayKey") {
      const key = lc(call.args![0] as string);
      await db.updateTable("play_keys").set({ replaced_by: key, updated_at: new Date() }).where("wallet", "=", from).where("key", "<>", key).where("replaced_by", "is", null).execute();
      await db
        .insertInto("play_keys")
        .values({ key, wallet: from, expires_at: new Date(Number(call.args![1] as bigint) * 1000), set_tx: txHash })
        .onConflict((oc) => oc.column("key").doUpdateSet({ expires_at: new Date(Number(call.args![1] as bigint) * 1000), revoked_tx: null, replaced_by: null, set_tx: txHash }))
        .execute();
    } else if (call.functionName === "revokePlayKey") {
      await db.updateTable("play_keys").set({ revoked_tx: txHash, updated_at: new Date() }).where((eb) => eb.or([eb("key", "=", from), eb("wallet", "=", from)])).where("revoked_tx", "is", null).execute();
    } else if (call.functionName === "convert") {
      const points = Number(call.args![0] as bigint);
      await db.insertInto("points_ledger").values({ wallet: from, kind: "convert", amount: -points, tx_hash: txHash, log_index: 0, block: b, block_time: new Date() }).execute();
      await db.insertInto("conversions").values({ tx_hash: txHash, wallet: from, points, ct: ((BigInt(points) * CT) / 1000n).toString(), block: b, block_time: new Date() }).execute();
    }
  }

  /** stake, claimInterest and withdraw on CojamStaking (approve on CT has no stub effect). */
  async function applyStaking(from: string, data: Hex, txHash: string) {
    let call: { functionName: string; args?: readonly unknown[] };
    try {
      call = decodeFunctionData({ abi: cojamStakingAbi, data });
    } catch {
      return;
    }
    const b = ++block;
    if (call.functionName === "stake") {
      const amount = call.args![0] as bigint;
      const lockIndex = Number(call.args![1]);
      const q = await chain.stakingQuote(amount, lockIndex);
      const last = await db.selectFrom("stakes").select(sql<number>`coalesce(max(position_id), -1)`.as("m")).where("wallet", "=", from).executeTakeFirst();
      const id = Number(last?.m ?? -1) + 1;
      await db
        .insertInto("stakes")
        .values({ wallet: from, position_id: id, principal: amount.toString(), lock_index: lockIndex, lock_days: LOCK_DAYS[lockIndex], apr_bps: q.aprBps, max_interest: q.interest.toString(), start_at: new Date(), end_at: new Date(q.end * 1000), stake_tx: txHash })
        .execute();
      await db
        .insertInto("wallet_transfers")
        .values({ tx_hash: txHash, log_index: 0, wallet: from, direction: "out", counterparty: ZERO, amount: amount.toString(), kind: "stake", block: b, block_time: new Date() })
        .onConflict((oc) => oc.doNothing())
        .execute();
    } else if (call.functionName === "claimInterest" || call.functionName === "withdraw") {
      const id = Number(call.args![0] as bigint);
      const pos = await chain.stakingPosition(from as Address, id);
      if (!pos || pos.closed) return;
      const claimed = (pos.claimed + pos.claimable).toString();
      await db
        .updateTable("stakes")
        .set(call.functionName === "withdraw" ? { claimed, closed: true, withdraw_tx: txHash } : { claimed })
        .where("wallet", "=", from)
        .where("position_id", "=", id)
        .execute();
    }
  }

  /** Pending nonce of a sender: the highest nonce the fee payer accepted from it, plus one. */
  async function nonceOf(a: string): Promise<number> {
    const r = await db
      .selectFrom("sponsored_txs")
      .select(sql<number | null>`max(nonce)`.as("n"))
      .where("sender", "=", lc(a))
      .where("status", "in", ["broadcast", "uncertain", "mined", "reverted"])
      .executeTakeFirst();
    return r?.n === null || r?.n === undefined ? 0 : Number(r.n) + 1;
  }

  /** eth_call against CojamPredict for the reads the PWA makes (dayOf, playKeyOf, playerOf, pendingHits). */
  async function ethCall(data: Hex): Promise<Hex> {
    const call = decodeFunctionData({ abi: cojamPredictAbi, data });
    const out = (functionName: string, result: unknown) => encodeFunctionResult({ abi: cojamPredictAbi, functionName, result } as never);
    const args = (call.args ?? []) as readonly unknown[];
    switch (call.functionName) {
      case "dayOf": {
        const d = await chain.dayOf(args[0] as Address, Number(args[1]));
        return out("dayOf", [d.answered, d.choices, d.completed, d.settledMask, d.hits]);
      }
      case "playKeyOf": {
        const k = await chain.playKeyOf(args[0] as Address);
        return out("playKeyOf", [k.key, BigInt(k.expiresAt)]);
      }
      case "playerOf": {
        const k = await chain.playerOf(args[0] as Address);
        return out("playerOf", [k.player, BigInt(k.expiresAt), k.valid]);
      }
      case "pendingHits": {
        const h = await chain.pendingHits(args[0] as Address, Number(args[1]));
        return out("pendingHits", [h.points, BigInt(h.landsAt)]);
      }
      default:
        throw new Error(`dev stub chain does not answer eth_call ${call.functionName}`);
    }
  }

  const rpc: RawRpc = async (method, params) => {
    if (method === "eth_estimateGas") return "0xea60";
    if (method === "eth_chainId") return toHex(1001);
    if (method === "eth_blockNumber") return toHex(block);
    if (method === "eth_gasPrice") return toHex(25_000_000_000n);
    if (method === "eth_getBalance") return toHex(await chain.kaiaBalance(params[0] as Address));
    if (method === "eth_getTransactionCount") return toHex(await nonceOf(params[0] as string));
    if (method === "eth_call") return ethCall((params[0] as { data: Hex }).data);
    if (method === "kaia_sendRawTransaction") {
      const raw = params[0] as Hex;
      const hash = keccak256(raw);
      await apply(raw, hash);
      receipts.set(hash, { status: "0x1", gasUsed: "0xea60", effectiveGasPrice: "0x666a3d400", blockNumber: `0x${block.toString(16)}`, transactionIndex: "0x0", logs: [] });
      return hash;
    }
    if (method === "kaia_getTransactionReceipt" || method === "eth_getTransactionReceipt") {
      const hit = receipts.get(params[0] as string);
      if (hit) return hit;
      // After an API restart: a transaction the fee payer recorded as sent counts as mined.
      const row = await db.selectFrom("sponsored_txs").select("status").where("tx_hash", "=", params[0] as string).executeTakeFirst();
      if (row && ["broadcast", "uncertain", "mined"].includes(row.status))
        return { status: "0x1", gasUsed: "0xea60", effectiveGasPrice: "0x5d21dba00", blockNumber: `0x${block.toString(16)}`, transactionIndex: "0x0", logs: [] };
      return null;
    }
    throw new Error(`dev stub chain does not support ${method}`);
  };

  return { chain, rpc };
}
