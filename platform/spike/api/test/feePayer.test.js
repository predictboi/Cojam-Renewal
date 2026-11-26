'use strict';

// Policy and pipeline tests with a mocked chain (no network). Sender transactions are built with
// @kaiachain/ethers-ext Wallet, the same encoder the swap site uses.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Wallet: KWallet } = require('@kaiachain/ethers-ext/v6');
const { Wallet, Interface, ZeroAddress } = require('ethers');
const { loadConfig } = require('../src/config');
const { createFeePayerService } = require('../src/feePayer');
const { createApp } = require('../src/server');
const { MemoryUsageStore } = require('../src/store');
const { silentLogger } = require('../src/log');
const { spikeAbi } = require('../src/policy');

const SPIKE = '0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58';
const FEE_PAYER = Wallet.createRandom();
const baseEnv = {
  FEE_PAYER_PRIVATE_KEY: FEE_PAYER.privateKey,
  SPIKE_CONTRACT_ADDRESS: SPIKE,
  ALLOWED_ORIGINS: 'http://localhost:5173',
  SENDER_PER_MINUTE_LIMIT: '3',
  SENDER_DAILY_TX_LIMIT: '5',
};

function mockChain(over = {}) {
  const sent = [];
  return {
    sent,
    getBalance: async () => 10n ** 19n,
    estimateGas: async () => 80000n,
    sendKaiaRawTransaction: async (signed) => {
      sent.push(signed);
      return '0x' + 'ab'.repeat(32);
    },
    getReceipt: async () => null,
    getBlockNumber: async () => 1,
    ...over,
  };
}

function service(chain = mockChain(), env = {}) {
  const cfg = loadConfig({ ...baseEnv, ...env });
  const fp = createFeePayerService({ cfg, chain, store: new MemoryUsageStore(), wallet: new KWallet(FEE_PAYER.privateKey), logger: silentLogger, receiptTries: 0 });
  return { cfg, fp, chain };
}

async function sign(sender, { to = SPIKE, data, gasLimit = 150000, gasPrice = 27500000000n, value = 0, chainId = 1001, nonce = 0, type = 0x31 } = {}) {
  const w = new KWallet(sender.privateKey);
  return w.signTransaction({ type, chainId, nonce, gasPrice, gasLimit, to, value, from: sender.address, data });
}
const predict = (m = 1n, c = 1) => spikeAbi.encodeFunctionData('predict', [m, c]);
const setKey = (k, exp) => spikeAbi.encodeFunctionData('setPlayKey', [k, exp]);
const now = () => Math.floor(Date.now() / 1000);

test('config refuses a chain other than Kairos and never echoes the key', () => {
  assert.throws(() => loadConfig({ ...baseEnv, CHAIN_ID: '8217' }), /1001/);
  try {
    loadConfig({ ...baseEnv, FEE_PAYER_PRIVATE_KEY: 'zz-secret-zz' });
    assert.fail('should throw');
  } catch (e) {
    assert.doesNotMatch(e.message, /zz-secret-zz/);
  }
});

test('a predict is co-signed and broadcast', async () => {
  const { fp, chain } = service();
  const s = Wallet.createRandom();
  const out = await fp.sponsor(await sign(s, { data: predict(7n, 2) }));
  assert.equal(out.action, 'predict');
  assert.equal(out.from, s.address);
  assert.deepEqual(out.args, { marketId: '7', choice: 2 });
  assert.equal(chain.sent.length, 1);
  assert.match(chain.sent[0], /^0x31/);
});

test('setPlayKey within the lifetime is accepted; outside it is refused', async () => {
  const { fp } = service();
  const s = Wallet.createRandom();
  const k = Wallet.createRandom().address;
  assert.equal((await fp.sponsor(await sign(s, { data: setKey(k, now() + 30 * 86400) }))).action, 'setPlayKey');
  await assert.rejects(fp.sponsor(await sign(s, { nonce: 1, data: setKey(k, now() + 91 * 86400) })), { code: 'CALLDATA_INVALID' });
  await assert.rejects(fp.sponsor(await sign(s, { nonce: 2, data: setKey(k, now() - 1) })), { code: 'CALLDATA_INVALID' });
  await assert.rejects(fp.sponsor(await sign(s, { nonce: 3, data: setKey(ZeroAddress, now() + 100) })), { code: 'CALLDATA_INVALID' });
  await assert.rejects(fp.sponsor(await sign(s, { nonce: 4, data: setKey(s.address, now() + 100) })), { code: 'CALLDATA_INVALID' });
});

test('static policy refusals', async () => {
  const { fp } = service();
  const s = Wallet.createRandom();
  const other = new Interface(['function revokePlayKey()', 'function transfer(address,uint256)']);
  await assert.rejects(fp.sponsor(await sign(s, { to: Wallet.createRandom().address, data: predict() })), { code: 'TARGET_NOT_ALLOWED' });
  await assert.rejects(fp.sponsor(await sign(s, { data: other.encodeFunctionData('revokePlayKey', []) })), { code: 'SELECTOR_NOT_ALLOWED' });
  await assert.rejects(fp.sponsor(await sign(s, { data: other.encodeFunctionData('transfer', [s.address, 1]) })), { code: 'SELECTOR_NOT_ALLOWED' });
  await assert.rejects(fp.sponsor(await sign(s, { data: predict(1n, 3) })), { code: 'CALLDATA_INVALID' });
  await assert.rejects(fp.sponsor(await sign(s, { data: predict() + '00' })), { code: 'CALLDATA_INVALID' });
  await assert.rejects(fp.sponsor(await sign(s, { data: predict(), gasLimit: 300000 })), { code: 'GAS_LIMIT_TOO_HIGH' });
  await assert.rejects(fp.sponsor(await sign(s, { data: predict(), gasPrice: 60000000000n })), { code: 'GAS_PRICE_TOO_HIGH' });
  await assert.rejects(fp.sponsor(await sign(s, { data: predict(), chainId: 8217 })), { code: 'CHAIN_ID_MISMATCH' });
  await assert.rejects(fp.sponsor(await sign(s, { data: predict(), type: 0x30 })), { code: 'TX_TYPE_NOT_ALLOWED' });
  await assert.rejects(fp.sponsor('0x31zz'), { code: 'DECODE_FAILED' });
});

test('value above zero is refused', async () => {
  // ethers-ext refuses value on a non payable call only on chain, so craft it directly.
  const { fp } = service();
  const s = Wallet.createRandom();
  await assert.rejects(fp.sponsor(await sign(s, { data: predict(), value: 1 })), { code: 'VALUE_NOT_ZERO' });
});

test('per sender burst limit (per minute) and daily limit', async () => {
  const { fp } = service(mockChain(), { SENDER_PER_MINUTE_LIMIT: '3', SENDER_DAILY_TX_LIMIT: '100' });
  const s = Wallet.createRandom();
  for (let i = 0; i < 3; i++) await fp.sponsor(await sign(s, { nonce: i, data: predict(BigInt(i)) }));
  await assert.rejects(fp.sponsor(await sign(s, { nonce: 3, data: predict(3n) })), { code: 'RATE_LIMITED_BURST' });

  const d = service(mockChain(), { SENDER_PER_MINUTE_LIMIT: '100', SENDER_DAILY_TX_LIMIT: '2' });
  for (let i = 0; i < 2; i++) await d.fp.sponsor(await sign(s, { nonce: i, data: predict(BigInt(i)) }));
  await assert.rejects(d.fp.sponsor(await sign(s, { nonce: 2, data: predict(2n) })), { code: 'RATE_LIMITED_SENDER' });
});

test('simulation reverts are named: AlreadyPredicted -> ALREADY_DONE, PlayKeyInvalid -> PLAY_KEY_INVALID', async () => {
  const revert = (data) => async () => {
    throw Object.assign(new Error('reverted'), { isNodeReply: true, nodeMessage: 'execution reverted', nodeData: data });
  };
  const s = Wallet.createRandom();
  const a = service(mockChain({ estimateGas: revert(spikeAbi.encodeErrorResult('AlreadyPredicted', [5n])) }));
  await assert.rejects(a.fp.sponsor(await sign(s, { data: predict(5n) })), { code: 'ALREADY_DONE' });
  const b = service(mockChain({ estimateGas: revert(spikeAbi.encodeErrorResult('PlayKeyInvalid', [])) }));
  await assert.rejects(b.fp.sponsor(await sign(s, { data: predict(5n) })), { code: 'PLAY_KEY_INVALID' });
  const c = service(mockChain({ estimateGas: async () => 200000n }));
  await assert.rejects(c.fp.sponsor(await sign(s, { data: predict(5n) })), { code: 'GAS_LIMIT_TOO_LOW' });
});

test('low fee payer balance pauses sponsorship', async () => {
  const { fp } = service(mockChain({ getBalance: async () => 1n }));
  await assert.rejects(fp.sponsor(await sign(Wallet.createRandom(), { data: predict() })), { code: 'FEE_PAYER_BALANCE_LOW' });
});

test('the same raw posted twice is broadcast once', async () => {
  const { fp, chain } = service();
  const raw = await sign(Wallet.createRandom(), { data: predict(9n) });
  const [a, b] = await Promise.all([fp.sponsor(raw), fp.sponsor(raw)]);
  assert.equal(a.txHash, b.txHash);
  assert.equal(chain.sent.length, 1);
});

test('HTTP: CORS only for allowed origins, /health and /sponsor', async () => {
  const { cfg, fp, chain } = service();
  const { server } = createApp({ cfg, chain, feePayer: fp, logger: silentLogger });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const pre = await fetch(`${base}/sponsor`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const bad = await fetch(`${base}/sponsor`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.status, 403);
    const badPost = await fetch(`${base}/sponsor`, { method: 'POST', headers: { Origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
    assert.equal(badPost.status, 403);
    const h = await (await fetch(`${base}/health`)).json();
    assert.equal(h.chainId, 1001);
    assert.equal(h.feePayer.address, FEE_PAYER.address);
    assert.equal(JSON.stringify(h).includes(FEE_PAYER.privateKey.slice(2)), false);
    const ok = await fetch(`${base}/sponsor`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ rawTransaction: await sign(Wallet.createRandom(), { data: predict(11n) }) }),
    });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).action, 'predict');
  } finally {
    server.close();
  }
});
