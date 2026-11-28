'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseUnits } = require('ethers');
const { createApp } = require('../src/server');
const { createFeePayerService } = require('../src/feePayer');
const { MemoryUsageStore } = require('../src/store');
const { silentLogger } = require('../src/log');
const h = require('./helpers');

async function start(chainOpts) {
  const cfg = h.testConfig({ RUN_MODE: 'api' });
  const chain = h.mockChain(chainOpts);
  const store = new MemoryUsageStore();
  const wallet = new h.KaiaWallet(cfg.feePayerPrivateKey);
  const feePayer = createFeePayerService({ cfg, chain, store, wallet, logger: silentLogger, receiptPollMs: 1, receiptTries: 3 });
  const { server } = createApp({ cfg, chain, store, feePayer, keeper: null, logger: silentLogger });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { cfg, chain, store, wallet, feePayer, server, base };
}

const post = (base, body, headers = {}) =>
  fetch(`${base}/api/fee-delegate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://cojam.example', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('HTTP API: sponsor, CORS, gas wallet, health', async (t) => {
  const app = await start();
  t.after(() => app.server.close());
  const holder = new h.KaiaWallet(h.randomKey());

  await t.test('preflight from an allowed origin', async () => {
    const r = await fetch(`${app.base}/api/fee-delegate`, { method: 'OPTIONS', headers: { origin: 'https://cojam.example' } });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), 'https://cojam.example');
  });

  await t.test('preflight from another origin is refused', async () => {
    const r = await fetch(`${app.base}/api/fee-delegate`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  });

  await t.test('POST from another origin is refused', async () => {
    const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate() });
    const r = await post(app.base, { rawTransaction: raw }, { origin: 'https://evil.example' });
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error.code, 'ORIGIN_NOT_ALLOWED');
    assert.equal(app.chain.state.sent.length, 0);
  });

  await t.test('POST a sender signed migrate returns the tx hash', async () => {
    const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), gasLimit: 300000n });
    const r = await post(app.base, { rawTransaction: raw });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.match(body.txHash, /^0x[0-9a-f]{64}$/);
    assert.equal(body.action, 'migrate');
    assert.equal(r.headers.get('access-control-allow-origin'), 'https://cojam.example');
  });

  await t.test('policy errors come back as codes', async () => {
    const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), chainId: 1001, nonce: 1 });
    const r = await post(app.base, { rawTransaction: raw });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error.code, 'CHAIN_ID_MISMATCH');
  });

  await t.test('bad bodies', async () => {
    assert.equal((await post(app.base, 'not json')).status, 400);
    assert.equal((await post(app.base, { tx: '0x' })).status, 400);
    assert.equal((await post(app.base, { rawTransaction: '0x31' }, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await post(app.base, { rawTransaction: '0x' + 'ab'.repeat(20000) })).status, 413);
    assert.equal((await fetch(`${app.base}/api/fee-delegate`)).status, 405);
    assert.equal((await fetch(`${app.base}/nope`)).status, 404);
  });

  await t.test('rate limit answers 429', async () => {
    const w = new h.KaiaWallet(h.randomKey());
    for (let n = 0; n < 10; n++) {
      const r = await post(app.base, { rawTransaction: await h.senderSign(w, { to: h.SWAP, data: h.calls.claim(1), nonce: n }) }, { 'x-forwarded-for': `10.0.0.${n}` });
      assert.equal(r.status, 200);
    }
    const r = await post(app.base, { rawTransaction: await h.senderSign(w, { to: h.SWAP, data: h.calls.claim(1), nonce: 10 }) });
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error.code, 'RATE_LIMITED_SENDER');
  });

  await t.test('GET /api/gas-wallet reports balance, counters and runway', async () => {
    await Promise.all([...app.feePayer._pendingSettlements]);
    const r = await fetch(`${app.base}/api/gas-wallet`, { headers: { origin: 'https://cojam.example' } });
    assert.equal(r.status, 200);
    const g = await r.json();
    assert.equal(g.address, app.wallet.address);
    assert.equal(g.balanceKaia, '100.0');
    assert.equal(g.today.sponsoredTx, 11);
    assert.equal(g.total.sponsoredTx, 11);
    // 11 receipts x 50,000 gas x 27.5 gkei = 0.015125 KAIA
    assert.equal(g.today.spentKaia, '0.015125');
    assert.equal(g.runwayDays, Number((parseUnits('100', 18) * 10n) / parseUnits('0.015125', 18)) / 10);
    assert.equal(g.sponsorshipActive, true);
    assert.ok(!JSON.stringify(g).includes(app.cfg.feePayerPrivateKey.slice(2)));
  });

  await t.test('GET /api/health', async () => {
    const r = await fetch(`${app.base}/api/health`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.ok, true);
    assert.equal(body.rpc.ok, true);
    assert.equal(body.rpc.latestBlock, 1234);
    assert.equal(body.feePayer.aboveFloor, true);
  });
});

test('GET /api/health?strict=1 answers 503 when the RPC is down', async (t) => {
  const app = await start({ balanceError: h.transportError() });
  t.after(() => app.server.close());
  app.chain.getBlockNumber = async () => {
    throw h.transportError();
  };
  assert.equal((await fetch(`${app.base}/api/health`)).status, 200);
  const r = await fetch(`${app.base}/api/health?strict=1`);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).rpc.ok, false);
});
