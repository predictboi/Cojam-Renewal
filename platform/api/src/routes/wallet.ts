// GET /v1/wallet, GET /v1/wallet/history, GET /v1/staking/quote, GET /v1/staking/positions.
// Balances, caps and positions are live chain reads (the chain is the source of truth); history reads the index.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Address } from "viem";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { DEFAULT_PARAMS, chainRead, chainTry, predictParams, requirePlayer, toUnix } from "./common.ts";
import { currentDayId } from "../../../shared/src/time.ts";
import type {
  HistoryKind,
  StakingPositionsResponse,
  StakingQuoteResponse,
  WalletHistoryResponse,
  WalletResponse,
} from "../../../shared/src/api.ts";

const CT = 10n ** 18n;
const LOCK_DAYS = [30, 90, 180, 365];
const max0 = (x: bigint) => (x > 0n ? x : 0n);

export function registerWalletRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;
  const env = deps.config.env;

  app.get("/v1/wallet", async (req): Promise<WalletResponse> => {
    const { user, wallet } = await requirePlayer(kit, req);
    const nowMs = deps.now();
    const today = currentDayId(nowMs);
    const c = deps.chain;
    const params = (await predictParams(deps.db, c, nowMs)) ?? DEFAULT_PARAMS;
    const [ct, kaia, points, player, convUser, convAll] = await Promise.all([
      chainRead(() => c.ctBalance(wallet), "CT balance"),
      chainRead(() => c.kaiaBalance(wallet), "KAIA balance"),
      chainRead(() => c.pointsBalance(wallet), "points"),
      chainRead(() => c.player(wallet), "player"),
      chainRead(() => c.convertedCtOnDay(wallet, today), "conversion caps"),
      chainRead(() => c.convertedCtTotalOnDay(today), "conversion caps"),
    ]);
    const staked = deps.config.addresses.staking ? ((await chainTry(() => c.stakingPrincipalOf(wallet))) ?? 0n) : 0n;
    let pendingHits = 0;
    let landsAt: number | null = null;
    for (const d of [today, today - 1, today - 2, today - 3]) {
      const p = await chainTry(() => c.pendingHits(wallet, d));
      if (p && p.points > 0n) {
        pendingHits += Number(p.points);
        if (p.landsAt > 0 && (landsAt === null || p.landsAt < landsAt)) landsAt = p.landsAt;
      }
    }
    const paused = (await chainTry(() => c.predictPaused())) ?? false;
    const rate = BigInt(params.pointsPerCT);
    const userLeft = max0(BigInt(params.maxConvertCtPerUserPerDay) * CT - convUser);
    const globalLeft = max0(BigInt(params.maxConvertCtPerDay) * CT - convAll);
    const capPoints = ((userLeft < globalLeft ? userLeft : globalLeft) * rate) / CT;
    let maxPts = points < capPoints ? points : capPoints;
    maxPts -= maxPts % rate;
    const allowedFrom = player.registered ? player.registeredAt + params.minAccountAge : null;
    let blocked: WalletResponse["conversion"]["blockedReason"] = null;
    if (!player.registered) blocked = "NOT_REGISTERED";
    else if (player.frozen || user.frozen) blocked = "FROZEN";
    else if (allowedFrom !== null && nowMs / 1000 < allowedFrom) blocked = "ACCOUNT_TOO_NEW";
    else if (userLeft === 0n || globalLeft === 0n) blocked = "DAILY_CAP_REACHED";
    else if (maxPts < BigInt(params.minConvertPoints)) blocked = "BELOW_MINIMUM";
    if (blocked || paused) maxPts = 0n;
    return {
      address: wallet,
      ctWei: ct.toString(),
      kaiaWei: kaia.toString(),
      points: Number(points),
      pendingHitPoints: pendingHits,
      pendingHitLandsAt: landsAt,
      stakedWei: staked.toString(),
      conversion: {
        pointsPerCT: params.pointsPerCT,
        minConvertPoints: params.minConvertPoints,
        maxPointsNow: Number(maxPts),
        ctPreviewWei: ((maxPts * CT) / rate).toString(),
        userCapLeftWei: userLeft.toString(),
        globalCapLeftWei: globalLeft.toString(),
        allowedFrom,
        blockedReason: blocked,
        paused,
      },
      krwPerCt: env.KRW_PER_CT > 0 ? env.KRW_PER_CT : null,
    };
  });

  const histQuery = z.object({ cursor: z.string().regex(/^\d+-\d+$/).optional(), limit: z.coerce.number().int().min(1).max(100).optional() });
  app.get("/v1/wallet/history", async (req): Promise<WalletHistoryResponse> => {
    const q = histQuery.parse(req.query);
    const { wallet } = await requirePlayer(kit, req);
    const limit = q.limit ?? 30;
    let qb = deps.db.selectFrom("wallet_transfers").selectAll().where("wallet", "=", wallet);
    if (q.cursor) {
      const [b, li] = q.cursor.split("-").map(Number);
      qb = qb.where((eb) => eb.or([eb("block", "<", b), eb.and([eb("block", "=", b), eb("log_index", "<", li)])]));
    }
    const rows = await qb.orderBy("block", "desc").orderBy("log_index", "desc").limit(limit + 1).execute();
    const page = rows.slice(0, limit);
    const convs = page.filter((r) => r.kind === "convert").map((r) => r.tx_hash);
    const conv = convs.length ? await deps.db.selectFrom("conversions").select(["tx_hash", "points"]).where("tx_hash", "in", convs).execute() : [];
    const air = page.some((r) => r.kind === "airdrop")
      ? await deps.db.selectFrom("airdrop_rows").select(["tx_hash", "week_id", "rank"]).where("wallet", "=", wallet).execute()
      : [];
    const kindOf = (k: string, dir: string): HistoryKind =>
      k === "convert" ? "conversion" : k === "airdrop" ? "airdrop" : k === "stake" ? "stake" : k === "interest" ? "interest" : k === "withdraw" ? "unstake" : dir === "in" ? "deposit" : "withdrawal";
    return {
      items: page.map((r) => {
        const a = air.find((x) => x.tx_hash === r.tx_hash);
        return {
          kind: kindOf(r.kind, r.direction),
          txHash: r.tx_hash,
          at: toUnix(r.block_time),
          amountWei: r.amount,
          ...(r.kind === "convert" ? { points: conv.find((c) => c.tx_hash === r.tx_hash)?.points } : {}),
          ...(r.kind === "transfer" ? { counterparty: r.counterparty as Address } : {}),
          ...(a ? { weekId: a.week_id, rank: a.rank } : {}),
        };
      }),
      nextCursor: rows.length > limit ? `${page[page.length - 1].block}-${page[page.length - 1].log_index}` : null,
    };
  });

  const quoteQuery = z.object({
    amount: z.string().regex(/^\d{1,40}$/, "amount is a base unit integer string"),
    lock: z.coerce.number().int(),
    lang: z.enum(["en", "ko", "ja"]).optional(),
  });
  app.get("/v1/staking/quote", async (req): Promise<StakingQuoteResponse> => {
    const q = quoteQuery.parse(req.query);
    const lockIndex = LOCK_DAYS.indexOf(q.lock) >= 0 ? LOCK_DAYS.indexOf(q.lock) : q.lock;
    if (lockIndex < 0 || lockIndex > 3) throw new ApiError("BAD_REQUEST", "lock must be 30, 90, 180 or 365 (days) or a lock index 0..3");
    const { user, wallet } = await requirePlayer(kit, req);
    if (!deps.config.addresses.staking) throw new ApiError("NOT_CONFIGURED", "STAKING_ADDRESS is not configured");
    const amount = BigInt(q.amount);
    const c = deps.chain;
    const [quote, state, principal, open] = await Promise.all([
      chainRead(() => c.stakingQuote(amount, lockIndex), "staking quote"),
      chainRead(() => c.stakingState(), "staking state"),
      chainRead(() => c.stakingPrincipalOf(wallet), "staking principal"),
      chainRead(() => c.stakingOpenPositions(wallet), "staking positions"),
    ]);
    const userRoom = state.maxUserPrincipal === 0n ? null : max0(state.maxUserPrincipal - principal);
    const totalRoom = state.maxTotalPrincipal === 0n ? null : max0(state.maxTotalPrincipal - state.totalPrincipal);
    let reason: StakingQuoteResponse["capacity"]["reason"] = null;
    if (user.frozen) reason = "FROZEN";
    else if (amount < state.minStake) reason = "BELOW_MIN_STAKE";
    else if (open >= state.maxOpenPositions) reason = "TOO_MANY_POSITIONS";
    else if (totalRoom !== null && amount > totalRoom) reason = "STAKING_TOTAL_CAP";
    else if (userRoom !== null && amount > userRoom) reason = "STAKING_USER_CAP";
    else if (quote.interest > state.availableRewards) reason = "STAKING_FULL";
    const krwRate = env.KRW_PER_CT;
    return {
      amountWei: amount.toString(),
      lockIndex,
      lockDays: LOCK_DAYS[lockIndex],
      tier: quote.tier,
      aprBps: quote.aprBps,
      interestWei: quote.interest.toString(),
      endsAt: quote.end,
      krw:
        q.lang === "ko" && krwRate > 0
          ? { principal: Math.round((Number(amount / 10n ** 12n) / 1e6) * krwRate), interest: Math.round((Number(quote.interest / 10n ** 12n) / 1e6) * krwRate) }
          : null,
      capacity: {
        userRoomWei: (userRoom ?? amount).toString(),
        totalRoomWei: totalRoom?.toString() ?? null,
        availableRewardsWei: state.availableRewards.toString(),
        fits: reason === null,
        reason,
      },
    };
  });

  app.get("/v1/staking/positions", async (req): Promise<StakingPositionsResponse> => {
    const { wallet } = await requirePlayer(kit, req);
    if (!deps.config.addresses.staking) throw new ApiError("NOT_CONFIGURED", "STAKING_ADDRESS is not configured");
    const [list, state] = await Promise.all([
      chainRead(() => deps.chain.stakingPositions(wallet), "staking positions"),
      chainRead(() => deps.chain.stakingState(), "staking state"),
    ]);
    const nowS = Math.floor(deps.now() / 1000);
    const positions = list.map((p) => ({
      id: p.id,
      principalWei: p.principal.toString(),
      lockIndex: p.lockIndex,
      lockDays: LOCK_DAYS[p.lockIndex] ?? 0,
      aprBps: p.aprBps,
      startsAt: p.start,
      endsAt: p.end,
      maxInterestWei: p.maxInterest.toString(),
      claimedWei: p.claimed.toString(),
      claimableWei: p.claimable.toString(),
      closed: p.closed,
      paidWei: p.closed ? (p.principal + p.claimed).toString() : null,
      canClaim: !p.closed && p.claimable > 0n && (nowS >= p.end || p.claimable >= state.minClaim),
      canWithdraw: !p.closed && nowS >= p.end,
    }));
    const open = list.filter((p) => !p.closed);
    return {
      positions,
      totals: {
        principalWei: open.reduce((a, p) => a + p.principal, 0n).toString(),
        claimableWei: open.reduce((a, p) => a + p.claimable, 0n).toString(),
        open: open.length,
      },
      minClaimWei: state.minClaim.toString(),
    };
  });
}
