// Dev only chain stand in (DEV_CHAIN=stub, refused in production): the API runs with no Kaia node and no
// deployed contracts, so the PWA can be built end to end against a local API. Reads come from Postgres
// (users, play_keys, predictions, points_ledger, stakes); a sponsored transaction is "mined" at once by applying
// its effect to the same tables the indexer fills (predict, setPlayKey, revokePlayKey, convert). Balances of CT
// and KAIA are fixed demo figures. Nothing here is used by the real services.
import { decodeFunctionData, keccak256, type Address, type Hex } from "viem";
import { parseTransaction } from "@kaiachain/js-ext-core";
import { sql, type Db } from "../db/index.ts";
import { cojamPredictAbi } from "./abi.ts";
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
    async pendingHits() {
      return { points: 0n, landsAt: 0 };
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
      return; // staking or CT call: no stub effect
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

  const rpc: RawRpc = async (method, params) => {
    if (method === "eth_estimateGas") return "0xea60";
    if (method === "kaia_sendRawTransaction") {
      const raw = params[0] as Hex;
      const hash = keccak256(raw);
      await apply(raw, hash);
      receipts.set(hash, { status: "0x1", gasUsed: "0xea60", effectiveGasPrice: "0x666a3d400", blockNumber: `0x${block.toString(16)}`, logs: [] });
      return hash;
    }
    if (method === "kaia_getTransactionReceipt") return receipts.get(params[0] as string) ?? null;
    throw new Error(`dev stub chain does not support ${method}`);
  };

  return { chain, rpc };
}
