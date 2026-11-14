'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Wallet: EthersWallet, parseUnits } = require('ethers');
const { createKeeper } = require('../src/keeper');
const { MemoryUsageStore } = require('../src/store');
const { silentLogger } = require('../src/log');
const { TOPICS } = require('../src/abi');
const { createFakeSwap, LOCK } = require('./fakeSwap');
const h = require('./helpers');

const ONE = parseUnits('1000', 18);

function setup({ env = {}, fake = {}, startBlock = 100 } = {}) {
  const cfg = h.testConfig({ SWAP_DEPLOY_BLOCK: String(startBlock), KEEPER_CONFIRMATIONS: '0', ...env });
  const chain = createFakeSwap({ startBlock, ...fake });
  const store = new MemoryUsageStore();
  const wallet = new h.KaiaWallet(cfg.feePayerPrivateKey);
  const make = () => createKeeper({ cfg, chain, store, wallet, logger: silentLogger, sleep: async () => {}, receiptPollMs: 0 });
  return { cfg, chain, store, wallet, keeper: make(), make };
}

const users = (n) => Array.from({ length: n }, () => EthersWallet.createRandom().address);

test('does nothing before unlock plus the delay, then releases every due owner in one batch', async () => {
  const { chain, keeper } = setup();
  const holders = users(3);
  holders.forEach((u) => chain.migrate(u, ONE));

  assert.deepEqual(await keeper.tick(), { sent: 0, due: 0 });
  chain.advance(LOCK + 119); // delay is 120 s by default
  assert.deepEqual(await keeper.tick(), { sent: 0, due: 0 });
  chain.advance(1);
  const r = await keeper.tick();
  assert.equal(r.due, 3);
  assert.equal(chain.state.sent.length, 1);
  assert.equal(chain.state.sent[0].name, 'claimForMany');
  assert.equal(chain.state.sent[0].chainId, 8217);
  holders.forEach((u) => assert.equal(chain.released(u), 1));
  assert.equal(keeper.status.pendingLots, 0);
  assert.equal(keeper.status.releasedLots, 3);
});

test('is idempotent: a second round and a restarted keeper send nothing more', async () => {
  const { chain, keeper, make } = setup();
  users(2).forEach((u) => chain.migrate(u, ONE));
  chain.advance(LOCK + 200);
  await keeper.tick();
  await keeper.tick();
  assert.equal(chain.state.sent.length, 1);

  const restarted = make();
  assert.deepEqual(await restarted.tick(), { sent: 0, due: 0 });
  assert.equal(chain.state.sent.length, 1);
});

test('after a restart it finds lots that matured while it was down', async () => {
  const { chain, make } = setup();
  const [a] = users(1);
  chain.migrate(a, ONE);
  chain.advance(LOCK + 3600 * 24 * 3); // down for three days
  const keeper = make();
  await keeper.tick();
  assert.equal(chain.released(a), 1);
  assert.equal(chain.state.sent[0].name, 'claimFor');
});

test('skips owners who already claimed themselves and sends no transaction', async () => {
  const { chain, keeper } = setup();
  const [a] = users(1);
  chain.migrate(a, ONE);
  chain.advance(LOCK + 200);
  chain.userClaim(a); // the owner released it with claim()
  // the Claimed event is in the logs, so the keeper drops the lot without a call
  assert.deepEqual(await keeper.tick(), { sent: 0, due: 0 });
  assert.equal(chain.state.sent.length, 0);
});

test('re-checks on chain before sending, so a lot claimed after the scan is not sent', async () => {
  const { chain, keeper } = setup();
  const [a] = users(1);
  chain.migrate(a, ONE);
  await keeper.tick(); // scanned: one lot, still locked
  chain.advance(LOCK + 200);
  chain.userClaim(a);
  // Hide the Claimed log, as if the node had not indexed it yet: only claimable() can tell.
  chain.state.logs = chain.state.logs.filter((l) => l.topics[0] !== TOPICS.Claimed);
  const r = await keeper.tick();
  assert.equal(r.due, 1);
  assert.equal(chain.state.sent.length, 0);
  assert.equal(keeper.status.pendingLots, 0); // pruned through nextClaimIndex
});

test('splits large sets into batches of KEEPER_BATCH_SIZE', async () => {
  const { chain, keeper } = setup({ env: { KEEPER_BATCH_SIZE: '2' } });
  users(5).forEach((u) => chain.migrate(u, ONE));
  chain.advance(LOCK + 200);
  const r = await keeper.tick();
  assert.equal(r.sent, 3);
  assert.deepEqual(chain.state.sent.map((t) => t.users.length), [2, 2, 1]);
});

test('releases many lots of one owner across rounds, bounded by KEEPER_MAX_LOTS_EACH', async () => {
  const { chain, keeper } = setup({ env: { KEEPER_MAX_LOTS_EACH: '2' } });
  const [a] = users(1);
  for (let i = 0; i < 5; i++) chain.migrate(a, ONE);
  chain.advance(LOCK + 200);
  await keeper.tick();
  assert.equal(chain.released(a), 2);
  await keeper.tick();
  await keeper.tick();
  assert.equal(chain.released(a), 5);
  assert.equal(chain.state.sent.length, 3);
});

test('waits while an earlier keeper transaction is still pending', async () => {
  const { chain, keeper } = setup();
  users(1).forEach((u) => chain.migrate(u, ONE));
  chain.advance(LOCK + 200);
  chain.state.pendingExtra = 1;
  await keeper.tick();
  assert.equal(chain.state.sent.length, 0);
  chain.state.pendingExtra = 0;
  await keeper.tick();
  assert.equal(chain.state.sent.length, 1);
});

test('pauses releases when the gas wallet is under the keeper floor', async () => {
  const { chain, keeper } = setup();
  users(1).forEach((u) => chain.migrate(u, ONE));
  chain.advance(LOCK + 200);
  chain.state.balance = parseUnits('0.5', 18);
  await keeper.tick();
  assert.equal(chain.state.sent.length, 0);
  assert.equal(keeper.status.balanceLow, true);
});

test('shrinks the log range when the node refuses a large getLogs', async () => {
  const { chain, keeper } = setup({ fake: { maxLogRange: 700 }, env: { KEEPER_LOG_CHUNK_BLOCKS: '5000' } });
  const [a] = users(1);
  chain.migrate(a, ONE);
  chain.advance(LOCK + 200);
  await keeper.tick();
  assert.equal(chain.released(a), 1);
});

test('records the keeper gas in the usage store', async () => {
  const { chain, keeper, store } = setup();
  users(2).forEach((u) => chain.migrate(u, ONE));
  chain.advance(LOCK + 200);
  await keeper.tick();
  const s = store.stats(new Date().toISOString().slice(0, 10));
  assert.equal(s.total.keeperTx, 1);
  assert.equal(s.total.keeperLots, 2);
  assert.equal(s.total.keeperWei, 100000n * 27500000000n);
});

test('backs off with growing delays on RPC errors and recovers', async () => {
  const cfg = h.testConfig({ SWAP_DEPLOY_BLOCK: '100', KEEPER_CONFIRMATIONS: '0', KEEPER_INTERVAL_SECONDS: '10' });
  const chain = createFakeSwap({ startBlock: 100 });
  chain.state.failures.getBlockNumber = 3;
  const delays = [];
  let keeper;
  const sleep = async (ms) => {
    delays.push(ms);
    if (delays.length >= 5) keeper.stop();
  };
  keeper = createKeeper({ cfg, chain, store: new MemoryUsageStore(), wallet: new h.KaiaWallet(cfg.feePayerPrivateKey), logger: silentLogger, sleep, receiptPollMs: 0 });
  keeper.start();
  await new Promise((r) => setTimeout(r, 50));
  // three failures: 20 s, 40 s, 80 s (plus or minus 25% jitter), then the normal 10 s interval
  assert.ok(delays[0] >= 15000 && delays[0] <= 25000, `first backoff ${delays[0]}`);
  assert.ok(delays[1] >= 30000 && delays[1] <= 50000, `second backoff ${delays[1]}`);
  assert.ok(delays[2] >= 60000 && delays[2] <= 100000, `third backoff ${delays[2]}`);
  assert.equal(delays[3], 10000);
  assert.equal(keeper.status.consecutiveErrors, 0);
  assert.equal(keeper.status.lastError, null);
});
