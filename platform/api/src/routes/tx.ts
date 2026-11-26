// POST /v1/tx/sponsor and GET /v1/tx/:hash.
// A predict or revokePlayKey sent by a valid play key needs no bearer token (the on chain key binding authorises
// it); every other action needs the bearer whose embedded wallet is the sender.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { decodeEventLog, type Hex } from "viem";
import type { RouteKit } from "../server/app.ts";
import { ApiError } from "../server/errors.ts";
import { cojamPredictAbi, cojamStakingAbi } from "../chain/abi.ts";
import type { SponsorResponse, SponsoredAction, TxStatusResponse } from "../../../shared/src/api.ts";

export function registerTxRoutes(app: FastifyInstance, kit: RouteKit): void {
  const { deps } = kit;

  const body = z.object({ rawTransaction: z.string().min(4).max(10_000) });
  app.post("/v1/tx/sponsor", async (req): Promise<SponsorResponse> => {
    const { rawTransaction } = body.parse(req.body);
    if (!deps.feePayer) throw new ApiError("NOT_CONFIGURED", "APP_FEE_PAYER_PRIVATE_KEY or contract addresses are not configured");
    // Optional auth: a missing token is fine for play key predicts; a bad token is still an error.
    const auth = await kit.authUser(req, { optional: true });
    return deps.feePayer.sponsor(rawTransaction, {
      auth: auth ? { privyUserId: auth.privyUserId, wallet: auth.wallet } : null,
      ipHash: kit.ipHashOf(req),
    });
  });

  app.get("/v1/tx/:hash", async (req): Promise<TxStatusResponse> => {
    const { hash } = z.object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).parse(req.params);
    await kit.authUser(req);
    const h = hash.toLowerCase();
    const row = await deps.db.selectFrom("sponsored_txs").selectAll().where("tx_hash", "=", h).executeTakeFirst();
    let rc: any = null;
    try {
      rc = await deps.rpc("kaia_getTransactionReceipt", [h]);
    } catch {
      rc = null;
    }
    if (rc && row && ["broadcast", "uncertain"].includes(row.status)) await deps.feePayer?.refresh(h).catch(() => {});
    if (!rc && !row) throw new ApiError("TX_NOT_FOUND");
    const action = (row?.action ?? null) as SponsoredAction | null;
    if (!rc) {
      return { txHash: h, status: row && ["released", "rejected"].includes(row.status) ? "unknown" : "pending", action, blockNumber: null, gasUsed: null, result: null };
    }
    const ok = Number(BigInt(rc.status ?? 0)) === 1;
    const result: Record<string, unknown> = {};
    for (const log of rc.logs ?? []) {
      for (const abi of [cojamPredictAbi, cojamStakingAbi]) {
        try {
          const ev = decodeEventLog({ abi, data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]] }) as { eventName: string; args: any };
          if (ev.eventName === "Predicted") Object.assign(result, { marketId: Number(ev.args.marketId), choice: Number(ev.args.choice), answered: Number(ev.args.answered) });
          else if (ev.eventName === "PointsCredited") result.pointsCredited = Number(result.pointsCredited ?? 0) + Number(ev.args.amount);
          else if (ev.eventName === "WelcomePaid") result.welcomePoints = Number(ev.args.amount);
          else if (ev.eventName === "Converted") Object.assign(result, { points: Number(ev.args.points), ctWei: String(ev.args.ctAmount) });
          else if (ev.eventName === "PlayKeySet") Object.assign(result, { playKey: String(ev.args.key).toLowerCase(), expiresAt: Number(ev.args.expiresAt) });
          else if (ev.eventName === "Staked") Object.assign(result, { positionId: Number(ev.args.id), amountWei: String(ev.args.amount) });
          else if (ev.eventName === "InterestClaimed") result.interestWei = String(ev.args.amount);
          else if (ev.eventName === "Withdrawn") Object.assign(result, { principalWei: String(ev.args.principal), interestWei: String(ev.args.interest) });
          break;
        } catch {
          // not this contract's event
        }
      }
    }
    return {
      txHash: h,
      status: ok ? "mined" : "reverted",
      action,
      blockNumber: rc.blockNumber ? Number(BigInt(rc.blockNumber)) : null,
      gasUsed: rc.gasUsed ? BigInt(rc.gasUsed).toString() : null,
      result: Object.keys(result).length ? result : null,
    };
  });
}
