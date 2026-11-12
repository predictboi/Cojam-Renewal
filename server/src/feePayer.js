'use strict';

// The sponsorship pipeline for POST /api/fee-delegate:
//   decode -> static policy -> cheap limit check -> fee payer balance floor
//   -> holder checks and simulation on the node -> atomic reservation (rate limit + budget)
//   -> fee payer signature -> kaia_sendRawTransaction -> commit, then settle the real fee.
// Every decision is logged once, without secrets and without the raw transaction.

const { formatUnits, keccak256 } = require('ethers');
const { decodeSenderTx, checkStatic, PolicyError } = require('./policy');
const { oldCtAbi } = require('./abi');
const { utcDay } = require('./store');

const IDEMPOTENCY_MS = 10 * 60 * 1000;

function createFeePayerService({ cfg, chain, store, wallet, logger, now = () => Date.now(), receiptPollMs = 3000, receiptTries = 40 }) {
  const feePayerAddress = wallet.address;
  const staticCfg = {
    chainId: cfg.chainId,
    oldCtAddress: cfg.oldCtAddress,
    swapAddress: cfg.swapAddress,
    feePayerAddress,
    policy: cfg.policy,
  };
  const recent = new Map(); // senderTxHash -> { at, promise }
  const pendingSettlements = new Set();

  const pruneRecent = () => {
    const t = now();
    for (const [k, v] of recent) if (t - v.at > IDEMPOTENCY_MS) recent.delete(k);
  };

  function trackSettlement(id, txHash, reservedWei) {
    const p = settleLater(id, txHash, reservedWei).finally(() => pendingSettlements.delete(p));
    pendingSettlements.add(p);
  }

  async function rpc(fn, what) {
    try {
      return await fn();
    } catch (e) {
      if (e && e.isNodeReply) throw e;
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
    const tx = decodeSenderTx(rawTransaction);
    ctx.from = tx.from;
    ctx.senderTxHash = tx.senderTxHash;
    const { action, args, maxCostWei } = checkStatic(tx, staticCfg);
    ctx.action = action;
    const day = utcDay(now());
    const pol = cfg.policy;

    // Cheap pre check before any RPC call, so spam costs us no RPC.
    const used = await store.peek({ sender: tx.from.toLowerCase(), ip: ctx.ipKey, day });
    if (used.senderCount >= pol.senderDailyLimit) {
      throw new PolicyError('RATE_LIMITED_SENDER', `This wallet already used ${pol.senderDailyLimit} sponsored transactions today (UTC)`, 429);
    }
    if (ctx.ipKey && used.ipCount >= pol.ipDailyLimit) {
      throw new PolicyError('RATE_LIMITED_IP', 'Too many sponsored transactions from this network today', 429);
    }
    if (used.spentWei + maxCostWei > pol.dailyBudgetWei) {
      throw new PolicyError('DAILY_BUDGET_EXHAUSTED', 'Gas sponsorship is paused until 00:00 UTC; you can still pay the gas yourself', 503);
    }

    const balance = await rpc(() => chain.getBalance(feePayerAddress), 'balance');
    if (balance < pol.minBalanceWei || balance < maxCostWei) {
      throw new PolicyError('FEE_PAYER_BALANCE_LOW', 'Gas sponsorship is paused while the gas wallet is topped up; you can still pay the gas yourself', 503);
    }

    if (action === 'approve') {
      const data = oldCtAbi.encodeFunctionData('balanceOf', [tx.from]);
      const out = await rpc(() => chain.call({ to: cfg.oldCtAddress, data }), 'balanceOf');
      const [bal] = oldCtAbi.decodeFunctionResult('balanceOf', out);
      if (bal === 0n) throw new PolicyError('NO_OLD_CT_BALANCE', 'This wallet holds no old CT, so approval is not sponsored');
    }

    if (pol.simulate) {
      let estimate;
      try {
        estimate = await chain.estimateGas({ from: tx.from, to: tx.to, data: tx.data });
      } catch (e) {
        if (e && e.isNodeReply) {
          throw new PolicyError('SIMULATION_FAILED', `The transaction would fail on chain: ${e.nodeMessage || 'reverted'}`);
        }
        throw new PolicyError('RPC_UNAVAILABLE', 'Kaia RPC is unavailable (simulation), try again shortly', 503);
      }
      if (estimate > tx.gasLimit) {
        throw new PolicyError('GAS_LIMIT_TOO_LOW', `Gas limit ${tx.gasLimit} is below the estimate ${estimate}; the transaction would run out of gas`);
      }
    }

    // Atomic: rate limit slot and worst case budget are taken together.
    const res = await store.reserve({
      sender: tx.from.toLowerCase(),
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
    } catch (e) {
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
      // Transport failure: the node may have accepted it. Keep the reservation (worst case)
      // and return the locally computed hash so the site can look it up.
      // On Kaia, TxHash = keccak256(fully signed RLP), so it is known before the node answers.
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
    return { txHash, action, from: tx.from, args, maxFeeKaia: formatUnits(maxCostWei, 18) };
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
          txHash: out.txHash,
          maxFeeKaia: out.maxFeeKaia,
          client: ctx.ipKey,
          origin: ctx.origin,
        });
        return { txHash: out.txHash, action: out.action };
      },
      (err) => {
        const e = err instanceof PolicyError ? err : new PolicyError('INTERNAL', 'Unexpected error', 500);
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
      // Rejections are not cached, so the holder can fix the cause and retry.
      promise.catch(() => recent.delete(key));
    }
    return promise;
  }

  return { sponsor, feePayerAddress, _pendingSettlements: pendingSettlements };
}

module.exports = { createFeePayerService };
