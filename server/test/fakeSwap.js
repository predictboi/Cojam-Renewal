'use strict';

// In-memory stand in for the Kaia RPC plus the CojamMigration contract, enough for the
// keeper: Migrated / Claimed logs, claimable, nextClaimIndex, claimFor, claimForMany,
// signed legacy transactions, nonces, receipts and injectable RPC failures.

const { Transaction, keccak256, parseUnits } = require('ethers');
const { swapAbi } = require('../src/abi');
const { nodeError, transportError, SWAP } = require('./helpers');

const LOCK = 7 * 24 * 3600;

function createFakeSwap({ startBlock = 100, startTime = 1_800_000_000, maxLogRange = Infinity } = {}) {
  const s = {
    block: startBlock,
    time: startTime,
    logs: [],
    lots: new Map(), // user lower -> { list: [{ amount, unlockAt }], next }
    nonces: new Map(),
    receipts: new Map(),
    sent: [],
    balance: parseUnits('50', 18),
    failures: { getBlockNumber: 0 },
    gasPrice: 27500000000n,
  };

  const userOf = (u) => {
    const k = u.toLowerCase();
    if (!s.lots.has(k)) s.lots.set(k, { list: [], next: 0, address: u });
    return s.lots.get(k);
  };

  const emit = (name, args) => {
    const { data, topics } = swapAbi.encodeEventLog(name, args);
    s.logs.push({ address: SWAP, topics, data, blockNumber: `0x${s.block.toString(16)}`, logIndex: `0x${s.logs.length.toString(16)}` });
  };

  function release(user, maxLots, caller) {
    const u = userOf(user);
    let amount = 0n;
    let i = u.next;
    const stop = Math.min(u.list.length, u.next + maxLots);
    while (i < stop && s.time >= u.list[i].unlockAt) {
      amount += u.list[i].amount;
      emit('Claimed', [user, i, u.list[i].amount, caller]);
      i += 1;
    }
    u.next = i;
    return amount;
  }

  function claimable(user, maxLots) {
    const u = userOf(user);
    let amount = 0n;
    let lots = 0;
    for (let i = u.next; i < Math.min(u.list.length, u.next + maxLots) && s.time >= u.list[i].unlockAt; i++) {
      amount += u.list[i].amount;
      lots += 1;
    }
    return [amount, lots];
  }

  // Dry run of a keeper call: total released, or a NothingToClaim revert.
  function simulate(data) {
    const parsed = swapAbi.parseTransaction({ data });
    const users = parsed.name === 'claimFor' ? [parsed.args[0]] : parsed.args[0];
    const max = Number(parsed.args[1]);
    const total = users.reduce((a, u) => a + claimable(u, max)[0], 0n);
    if (total === 0n) throw nodeError('execution reverted: NothingToClaim()');
    return { parsed, users, max };
  }

  const chain = {
    state: s,
    // test controls
    migrate(user, amount) {
      s.block += 1;
      const u = userOf(user);
      const locked = amount - amount / 10n;
      const lotId = u.list.length;
      u.list.push({ amount: locked, unlockAt: s.time + LOCK });
      emit('Migrated', [user, lotId, amount, amount / 10n, locked, s.time + LOCK]);
      return lotId;
    },
    userClaim(user) {
      s.block += 1;
      return release(user, 1000, user);
    },
    advance(seconds) {
      s.time += seconds;
      s.block += seconds;
    },
    released(user) {
      return userOf(user).next;
    },
    // RPC surface used by the keeper
    async getBlockNumber() {
      if (s.failures.getBlockNumber > 0) {
        s.failures.getBlockNumber -= 1;
        throw transportError();
      }
      return s.block;
    },
    async getBlockTimestamp() {
      return s.time;
    },
    async getLogs({ fromBlock, toBlock, topics }) {
      if (toBlock - fromBlock + 1 > maxLogRange) throw nodeError('query block range is too large');
      const wanted = new Set(topics[0]);
      return s.logs.filter((l) => {
        const b = Number(BigInt(l.blockNumber));
        return b >= fromBlock && b <= toBlock && wanted.has(l.topics[0]);
      });
    },
    async call({ data }) {
      const p = swapAbi.parseTransaction({ data });
      if (p.name === 'claimable') return swapAbi.encodeFunctionResult('claimable', claimable(p.args[0], Number(p.args[1])));
      if (p.name === 'nextClaimIndex') return swapAbi.encodeFunctionResult('nextClaimIndex', [userOf(p.args[0]).next]);
      throw nodeError('unsupported call');
    },
    async estimateGas({ data }) {
      const { users } = simulate(data);
      return 60000n + 30000n * BigInt(users.length);
    },
    async getGasPrice() {
      return s.gasPrice;
    },
    async getNonce(address, tag) {
      const n = s.nonces.get(address.toLowerCase()) || 0;
      return tag === 'pending' ? n + (s.pendingExtra || 0) : n;
    },
    async getBalance() {
      return s.balance;
    },
    async sendRawTransaction(signed) {
      const tx = Transaction.from(signed);
      const from = tx.from.toLowerCase();
      const expected = s.nonces.get(from) || 0;
      if (tx.nonce !== expected) throw nodeError(`nonce mismatch ${tx.nonce} != ${expected}`);
      if (tx.to.toLowerCase() !== SWAP.toLowerCase()) throw nodeError('wrong target');
      s.nonces.set(from, expected + 1);
      s.block += 1;
      const { parsed, users, max } = simulate(tx.data);
      for (const u of users) release(u, max, tx.from);
      const hash = keccak256(signed);
      s.sent.push({ hash, name: parsed.name, users: users.map((u) => u.toLowerCase()), max, chainId: Number(tx.chainId) });
      s.receipts.set(hash, { status: 1, gasUsed: 100000n, effectiveGasPrice: tx.gasPrice, blockNumber: s.block });
      return hash;
    },
    async getReceipt(hash) {
      return s.receipts.get(hash) || null;
    },
  };
  return chain;
}

module.exports = { createFakeSwap, LOCK };
