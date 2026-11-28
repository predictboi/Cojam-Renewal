'use strict';

// The spike sponsorship pipeline for POST /sponsor, adapted from server/src/feePayer.js:
//   decode -> static policy -> burst and daily limit check -> fee payer balance floor
//   -> simulation on the node (eth_estimateGas from the sender) -> atomic reservation
//   -> fee payer signature -> kaia_sendRawTransaction -> commit, then settle the real fee.
// The server answers once the node accepted the transaction (not after mining), like the plan's
// /v1/tx/sponsor. Every decision is logged once, without secrets and without the raw transaction.

const { formatUnits, keccak256 } = require('ethers');
const { decodeSenderTx, checkStatic, revertName, PolicyError } = require('./policy');
const { utcDay } = require('./store');

const IDEMPOTENCY_MS = 10 * 60 * 1000;

// Revert names from simulation mapped to the client codes of DEV-PLAN 4.4.
const REVERT_CODES = {
  AlreadyPredicted: 'ALREADY_DONE',
  PlayKeyInvalid: 'PLAY_KEY_INVALID',
  KeyInUse: 'PLAY_KEY_IN_USE',
};

function createFeePayerService({
  cfg,
  chain,
  store,
  wallet,
  logger,
  now = () => Date.now(),
  receiptPollMs = 2000,
  receiptTries = 45,
}) {
  const feePayerAddress = wallet.address;
  const staticCfg = { chainId: cfg.chainId, spikeAddress: cfg.spikeAddress, feePayerAddress, policy: cfg.policy };
  const recent = new Map(); // raw (lower case) -> { at, promise }
  const burst = new Map(); // sender -> [timestamps in the last minute]
  const pendingSettlements = new Set();

  const pruneRecent = () => {
    const t = now();
    for (const [k, v] of recent) if (t - v.at > IDEMPOTENCY_MS) recent.delete(k);
  };

  // Sliding one minute window per sender. Checked and recorded in one tick.
  function takeBurstSlot(sender) {
    const t = now();
    const list = (burst.get(sender) || []).filter((x) => t - x < 60000);
    if (list.length >= cfg.policy.senderPerMinuteLimit) {
      burst.set(sender, list);
      return false;
    }
    list.push(t);
    burst.set(sender, list);
    if (burst.size > 10000) for (const [k, v] of burst) if (!v.length || t - v[v.length - 1] > 60000) burst.delete(k);
    return true;
  }

  function trackSettlement(id, txHash, reservedWei) {
    const p = settleLater(id, txHash, reservedWei).finally(() => pendingSettlements.delete(p));
    pendingSettlements.add(p);
  }

  async function rpc(fn, what) {
    try {
      return await fn();
    } catch {
      throw new PolicyError('RPC_UNAVAILABLE', `Kaia RPC is unavailable (${what}), try again shortly`, 503);
    }
  }

  async function settleLater(reservationId, txHash, reservedWei) {
    for (let i = 0; i < receiptTries; i++) {
      await new Promise((r) => setTimeout(r, receiptPollMs));
      try {
        const rc = await chain.getReceipt(txHash);
        if (rc && rc.gasUsed !== undefined && rc.effectiveGasPrice !== undefined) {
          const actualWei = rc.gasUsed * rc.effectiveGasPrice;
          await store.settle(reservationId, { actualWei });
          logger.info('sponsored tx mined', {
            txHash,
            status: rc.status === 1 ? 'success' : 'reverted',
            gasUsed: rc.gasUsed,
            feeKaia: formatUnits(actualWei, 18),
          });
          if (rc.status !== 1) logger.warn('sponsored tx reverted on chain: the fee payer still paid the fee', { txHash });
          return;
        }
      } catch {
        // keep polling; the reservation already counts the worst case
      }
    }
    await store.settle(reservationId, { actualWei: reservedWei });
    logger.warn('no receipt in time: kept the reserved worst case cost', { txHash });
  }

  async function run(rawTransaction, ctx) {
    const t0 = now();
    const tx = decodeSenderTx(rawTransaction);
    ctx.from = tx.from;
    ctx.senderTxHash = tx.senderTxHash;
    const { action, args, maxCostWei } = checkStatic(tx, staticCfg, Math.floor(now() / 1000));
    ctx.action = action;
    const day = utcDay(now());
    const pol = cfg.policy;
    const sender = tx.from.toLowerCase();

    if (!takeBurstSlot(sender)) {
      throw new PolicyError('RATE_LIMITED_BURST', `More than ${pol.senderPerMinuteLimit} sponsor requests from this sender in one minute`, 429);
    }
    const used = await store.peek({ sender, ip: ctx.ipKey, day });
    if (used.senderCount >= pol.senderDailyLimit) {
      throw new PolicyError('RATE_LIMITED_SENDER', `This sender already used ${pol.senderDailyLimit} sponsored transactions today (UTC)`, 429);
    }
    if (ctx.ipKey && used.ipCount >= pol.ipDailyLimit) {
      throw new PolicyError('RATE_LIMITED_IP', 'Too many sponsored transactions from this network today', 429);
    }
    if (used.spentWei + maxCostWei > pol.dailyBudgetWei) {
      throw new PolicyError('DAILY_BUDGET_EXHAUSTED', 'The spike sponsorship budget for today (UTC) is used up', 503);
    }

    const balance = await rpc(() => chain.getBalance(feePayerAddress), 'balance');
    if (balance < pol.minBalanceWei || balance < maxCostWei) {
      throw new PolicyError('FEE_PAYER_BALANCE_LOW', `The fee payer ${feePayerAddress} is below its floor; top it up with test KAIA`, 503);
    }

    if (pol.simulate) {
      let estimate;
      try {
        estimate = await chain.estimateGas({ from: tx.from, to: tx.to, data: tx.data });
      } catch (e) {
        if (e && e.isNodeReply) {
          const name = revertName(e.nodeData);
          const code = (name && REVERT_CODES[name]) || 'SIMULATION_FAILED';
          throw new PolicyError(code, `The transaction would fail on chain: ${name || e.nodeMessage || 'reverted'}`);
        }
        throw new PolicyError('RPC_UNAVAILABLE', 'Kaia RPC is unavailable (simulation), try again shortly', 503);
      }
      if (estimate > tx.gasLimit) {
        throw new PolicyError('GAS_LIMIT_TOO_LOW', `Gas limit ${tx.gasLimit} is below the estimate ${estimate}; the transaction would run out of gas`);
      }
    }

    const res = await store.reserve({
      sender,
      ip: ctx.ipKey,
      day,
      costWei: maxCostWei,
      limits: { sender: pol.senderDailyLimit, ip: pol.ipDailyLimit, budgetWei: pol.dailyBudgetWei },
    });
    if (!res.ok) {
      const status = res.code === 'DAILY_BUDGET_EXHAUSTED' ? 503 : 429;
      throw new PolicyError(res.code, 'Sponsorship limit reached', status);
    }

    let signed;
    try {
      signed = await wallet.signTransactionAsFeePayer({
        type: tx.type,
        nonce: tx.nonce,
        gasPrice: tx.gasPrice,
        gasLimit: tx.gasLimit,
        to: tx.to,
        value: tx.value,
        from: tx.from,
        data: tx.data,
        chainId: tx.chainId,
        txSignatures: tx.txSignatures,
      });
    } catch {
      await store.release(res.id);
      throw new PolicyError('INTERNAL', 'Fee payer signing failed', 500);
    }

    let txHash;
    try {
      txHash = await chain.sendKaiaRawTransaction(signed);
    } catch (e) {
      if (e && e.isNodeReply) {
        await store.release(res.id);
        throw new PolicyError('BROADCAST_REJECTED', `The node rejected the transaction: ${e.nodeMessage || 'unknown reason'}`);
      }
      // Transport failure: the node may have accepted it. On Kaia, TxHash = keccak256(fully signed RLP).
      const localHash = keccak256(signed);
      ctx.txHash = localHash;
      await store.commit(res.id, { txHash: localHash });
      trackSettlement(res.id, localHash, maxCostWei);
      throw Object.assign(
        new PolicyError('BROADCAST_UNCERTAIN', 'The RPC did not answer; the transaction may still be on its way. Check the hash before retrying', 502),
        { txHash: localHash }
      );
    }

    ctx.txHash = txHash;
    await store.commit(res.id, { txHash });
    trackSettlement(res.id, txHash, maxCostWei);
    return { txHash, action, from: tx.from, nonce: tx.nonce, args, maxFeeKaia: formatUnits(maxCostWei, 18), serverMs: now() - t0 };
  }

  /**
   * @param {string} rawTransaction sender signed senderTxHashRLP
   * @param {{ ipKey?: string, origin?: string }} meta
   */
  async function sponsor(rawTransaction, meta = {}) {
    const ctx = { ipKey: meta.ipKey, origin: meta.origin };
    pruneRecent();

    // The same signed tx posted twice (double click, retry) returns the first result.
    const key = typeof rawTransaction === 'string' ? rawTransaction.toLowerCase() : null;
    if (key && recent.has(key)) return recent.get(key).promise;

    const promise = run(rawTransaction, ctx).then(
      (out) => {
        logger.info('fee delegation accepted', {
          decision: 'accepted',
          action: out.action,
          from: out.from,
          nonce: out.nonce,
          txHash: out.txHash,
          maxFeeKaia: out.maxFeeKaia,
          serverMs: out.serverMs,
          client: ctx.ipKey,
          origin: ctx.origin,
        });
        return { txHash: out.txHash, action: out.action, from: out.from, nonce: out.nonce, args: out.args, serverMs: out.serverMs };
      },
      (err) => {
        const e = err instanceof PolicyError ? err : new PolicyError('INTERNAL', 'Unexpected error', 500);
        if (err && err.txHash) e.txHash = err.txHash;
        logger[e.status >= 500 ? 'warn' : 'info']('fee delegation rejected', {
          decision: 'rejected',
          code: e.code,
          reason: e.message,
          action: ctx.action,
          from: ctx.from,
          senderTxHash: ctx.senderTxHash,
          txHash: ctx.txHash,
          client: ctx.ipKey,
          origin: ctx.origin,
        });
        if (!(err instanceof PolicyError)) logger.error('unexpected error in fee delegation', { error: err });
        throw e;
      }
    );
    if (key) {
      recent.set(key, { at: now(), promise });
      promise.catch(() => recent.delete(key));
    }
    return promise;
  }

  return { sponsor, feePayerAddress, _pendingSettlements: pendingSettlements };
}

module.exports = { createFeePayerService };
