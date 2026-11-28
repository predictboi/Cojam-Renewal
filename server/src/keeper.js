'use strict';

// Keeper: releases matured lots to their owners with claimForMany / claimFor, paying the
// gas from the same gas wallet. The keeper holds no privileges: the contract always pays
// the lot owner, never the caller, so a stolen keeper key can only release lots on time.
//
// Source of truth is the chain, so the keeper is idempotent and safe to restart:
//   * On start it rescans Migrated and Claimed events from SWAP_DEPLOY_BLOCK.
//   * Before sending it re-reads claimable(user) and drops users with nothing matured.
//   * It estimates gas first; a revert (for example NothingToClaim after a race) costs nothing.
//   * It never sends while one of its own transactions is still pending.
//   * After a release it re-reads nextClaimIndex(user) to prune what was released.

const { formatUnits } = require('ethers');
const { swapAbi, TOPICS } = require('./abi');
const { utcDay } = require('./store');

const MAX_BACKOFF_MS = 5 * 60 * 1000;

function createKeeper({
  cfg,
  chain,
  store,
  wallet,
  logger,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  receiptPollMs = 2000,
  receiptTries = 60,
}) {
  const k = cfg.keeper;
  const swap = cfg.swapAddress;
  const lots = new Map(); // user (lower case) -> Map(lotId -> { unlockAt, amount })
  let lastScanned = k.startBlock - 1;
  let chunk = k.logChunk;
  let running = false;
  let stopping = false;
  let wake = null;

  const status = {
    enabled: true,
    startedAt: null,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    consecutiveErrors: 0,
    lastScannedBlock: lastScanned,
    pendingUsers: 0,
    pendingLots: 0,
    dueLots: 0,
    oldestDueUnlockAt: null,
    lastTxHash: null,
    releasedLots: 0,
    balanceLow: false,
  };

  const callView = async (name, args) => {
    const out = await chain.call({ to: swap, data: swapAbi.encodeFunctionData(name, args) });
    return swapAbi.decodeFunctionResult(name, out);
  };

  function applyLog(log) {
    const parsed = swapAbi.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return;
    const user = parsed.args.user.toLowerCase();
    const lotId = Number(parsed.args.lotId);
    if (parsed.name === 'Migrated') {
      if (!lots.has(user)) lots.set(user, new Map());
      lots.get(user).set(lotId, { unlockAt: Number(parsed.args.unlockAt), amount: parsed.args.lockedAmount });
    } else if (parsed.name === 'Claimed') {
      const m = lots.get(user);
      if (m) {
        m.delete(lotId);
        if (m.size === 0) lots.delete(user);
      }
    }
  }

  async function scan(toBlock) {
    while (lastScanned < toBlock) {
      const from = lastScanned + 1;
      const to = Math.min(toBlock, from + chunk - 1);
      let logs;
      try {
        logs = await chain.getLogs({ address: swap, topics: [[TOPICS.Migrated, TOPICS.Claimed]], fromBlock: from, toBlock: to });
      } catch (e) {
        // Some nodes cap the block range or the result size: shrink and retry.
        if (e && e.isNodeReply && chunk > 10) {
          chunk = Math.max(10, Math.floor(chunk / 2));
          logger.warn('keeper: getLogs refused, shrinking the range', { chunk, reason: e.nodeMessage });
          continue;
        }
        throw e;
      }
      logs
        .slice()
        .sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || Number(BigInt(a.logIndex) - BigInt(b.logIndex)))
        .forEach(applyLog);
      lastScanned = to;
      status.lastScannedBlock = to;
    }
  }

  async function prune(user) {
    const [next] = await callView('nextClaimIndex', [user]);
    const m = lots.get(user);
    if (!m) return;
    for (const id of [...m.keys()]) if (id < Number(next)) m.delete(id);
    if (m.size === 0) lots.delete(user);
  }

  function dueUsers(chainNow) {
    const due = [];
    let pendingLots = 0;
    let dueLots = 0;
    let oldest = null;
    for (const [user, m] of lots) {
      let first = null;
      for (const lot of m.values()) {
        pendingLots += 1;
        if (lot.unlockAt + k.unlockDelaySec <= chainNow) {
          dueLots += 1;
          if (first === null || lot.unlockAt < first) first = lot.unlockAt;
        }
      }
      if (first !== null) {
        due.push({ user, first });
        if (oldest === null || first < oldest) oldest = first;
      }
    }
    status.pendingUsers = lots.size;
    status.pendingLots = pendingLots;
    status.dueLots = dueLots;
    status.oldestDueUnlockAt = oldest === null ? null : new Date(oldest * 1000).toISOString();
    return due.sort((a, b) => a.first - b.first).map((d) => d.user);
  }

  async function waitReceipt(hash) {
    for (let i = 0; i < receiptTries; i++) {
      const rc = await chain.getReceipt(hash);
      if (rc) return rc;
      await sleep(receiptPollMs);
    }
    return null;
  }

  async function release(users) {
    // Re-check on chain: only users with something matured right now.
    const ready = [];
    for (const user of users) {
      const [amount] = await callView('claimable', [user, k.maxLotsEach]);
      if (amount > 0n) ready.push(user);
      else await prune(user);
    }
    if (ready.length === 0) return;

    const data =
      ready.length === 1
        ? swapAbi.encodeFunctionData('claimFor', [ready[0], k.maxLotsEach])
        : swapAbi.encodeFunctionData('claimForMany', [ready, k.maxLotsEach]);

    let estimate;
    try {
      estimate = await chain.estimateGas({ from: wallet.address, to: swap, data });
    } catch (e) {
      if (e && e.isNodeReply) {
        logger.warn('keeper: release would revert, skipped this round', { users: ready.length, reason: e.nodeMessage });
        return;
      }
      throw e;
    }

    const networkPrice = await chain.getGasPrice();
    if (networkPrice > k.maxGasPriceWei) {
      logger.warn('keeper: network gas price above the cap, waiting', { gasPriceWei: networkPrice });
      return;
    }
    const gasLimit = (estimate * 12n) / 10n + 10000n;
    const nonce = await chain.getNonce(wallet.address, 'pending');
    const signed = await wallet.signTransaction({
      type: 0,
      chainId: cfg.chainId,
      nonce,
      gasPrice: networkPrice,
      gasLimit,
      to: swap,
      data,
      value: 0n,
    });
    const hash = await chain.sendRawTransaction(signed);
    status.lastTxHash = hash;
    logger.info('keeper: release sent', { txHash: hash, users: ready.length, maxLotsEach: k.maxLotsEach });

    const rc = await waitReceipt(hash);
    if (!rc) {
      logger.warn('keeper: no receipt yet, will re-check next round', { txHash: hash });
      return;
    }
    const cost = rc.gasUsed * (rc.effectiveGasPrice ?? networkPrice);
    let released = 0;
    for (const user of ready) {
      const before = lots.get(user) ? lots.get(user).size : 0;
      await prune(user);
      const after = lots.get(user) ? lots.get(user).size : 0;
      released += before - after;
    }
    status.releasedLots += released;
    await store.recordKeeper({ day: utcDay(now()), costWei: cost, lots: released });
    const level = rc.status === 1 ? 'info' : 'error';
    logger[level](`keeper: release ${rc.status === 1 ? 'mined' : 'reverted'}`, {
      txHash: hash,
      users: ready.length,
      lots: released,
      gasUsed: rc.gasUsed,
      feeKaia: formatUnits(cost, 18),
    });
  }

  async function tick() {
    status.lastRunAt = new Date(now()).toISOString();
    const head = await chain.getBlockNumber();
    await scan(Math.max(lastScanned, head - k.confirmations));

    const chainNow = await chain.getBlockTimestamp('latest');
    const due = dueUsers(chainNow);
    if (due.length === 0) return { sent: 0, due: 0 };

    const latest = await chain.getNonce(wallet.address, 'latest');
    const pending = await chain.getNonce(wallet.address, 'pending');
    if (pending > latest) {
      logger.info('keeper: an earlier keeper tx is still pending, waiting', { latest, pending });
      return { sent: 0, due: due.length };
    }

    const balance = await chain.getBalance(wallet.address);
    status.balanceLow = balance < k.minBalanceWei;
    if (status.balanceLow) {
      logger.error('keeper: gas wallet balance below the keeper floor, releases paused', {
        balanceKaia: formatUnits(balance, 18),
        dueUsers: due.length,
      });
      return { sent: 0, due: due.length };
    }

    let sent = 0;
    for (let i = 0; i < due.length && !stopping; i += k.batchSize) {
      await release(due.slice(i, i + k.batchSize));
      sent += 1;
    }
    dueUsers(chainNow);
    return { sent, due: due.length };
  }

  async function loop() {
    while (!stopping) {
      let delay = k.intervalMs;
      try {
        await tick();
        status.lastSuccessAt = new Date(now()).toISOString();
        if (status.consecutiveErrors > 0) logger.info('keeper: recovered', { after: status.consecutiveErrors });
        status.consecutiveErrors = 0;
        status.lastError = null;
      } catch (e) {
        status.consecutiveErrors += 1;
        status.lastError = e && e.message ? e.message.slice(0, 200) : 'error';
        delay = Math.min(MAX_BACKOFF_MS, k.intervalMs * 2 ** Math.min(status.consecutiveErrors, 8));
        delay = Math.round(delay * (0.75 + Math.random() * 0.5));
        logger.warn('keeper: round failed, backing off', { error: status.lastError, retryInMs: delay });
      }
      await new Promise((resolve) => {
        wake = resolve;
        sleep(delay).then(resolve);
      });
    }
    running = false;
  }

  return {
    status,
    tick,
    start() {
      if (running) return;
      running = true;
      stopping = false;
      status.startedAt = new Date(now()).toISOString();
      logger.info('keeper: started', { fromBlock: k.startBlock, intervalMs: k.intervalMs, address: wallet.address });
      loop();
    },
    stop() {
      stopping = true;
      if (wake) wake();
    },
    _lots: lots,
  };
}

module.exports = { createKeeper };
