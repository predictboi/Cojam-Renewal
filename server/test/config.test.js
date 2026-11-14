'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, ConfigError, OLD_CT_MAINNET } = require('../src/config');
const { createLogger } = require('../src/log');
const h = require('./helpers');

test('fails fast and lists every missing value', () => {
  assert.throws(
    () => loadConfig({}),
    (e) => {
      assert.ok(e instanceof ConfigError);
      for (const name of ['KAIA_RPC_URL', 'CHAIN_ID', 'SWAP_CONTRACT_ADDRESS', 'FEE_PAYER_PRIVATE_KEY', 'ALLOWED_ORIGINS', 'SWAP_DEPLOY_BLOCK']) {
        assert.ok(e.problems.some((p) => p.startsWith(name)), `missing ${name}`);
      }
      return true;
    }
  );
});

test('rejects a malformed key without echoing it', () => {
  const bad = 'not-a-key-1234';
  assert.throws(
    () => loadConfig(h.testEnv({ FEE_PAYER_PRIVATE_KEY: bad })),
    (e) => e.message.includes('FEE_PAYER_PRIVATE_KEY') && !e.message.includes(bad)
  );
});

test('rejects unknown chains and bad origins', () => {
  assert.throws(() => loadConfig(h.testEnv({ CHAIN_ID: '1' })), /CHAIN_ID/);
  assert.throws(() => loadConfig(h.testEnv({ ALLOWED_ORIGINS: 'cojam.example' })), /ALLOWED_ORIGINS/);
});

test('defaults the old CT to the real Kaia mainnet token and applies policy defaults', () => {
  const cfg = loadConfig(h.testEnv());
  assert.equal(cfg.oldCtAddress.toLowerCase(), OLD_CT_MAINNET);
  assert.equal(cfg.policy.senderDailyLimit, 10);
  assert.equal(cfg.policy.maxGasPriceWei, 50n * 10n ** 9n);
  assert.equal(cfg.policy.minBalanceWei, 5n * 10n ** 18n);
  assert.equal(cfg.keeper.startBlock, 100);
});

test('the API alone does not need SWAP_DEPLOY_BLOCK', () => {
  const env = h.testEnv({ RUN_MODE: 'api' });
  delete env.SWAP_DEPLOY_BLOCK;
  assert.equal(loadConfig(env).keeper.enabled, false);
});

test('the logger masks secret looking fields', () => {
  const lines = [];
  const log = createLogger({ sink: (l) => lines.push(l) });
  log.info('x', { privateKey: '0xabc', rawTransaction: '0x31', from: '0x1' });
  const o = JSON.parse(lines[0]);
  assert.equal(o.privateKey, '[redacted]');
  assert.equal(o.rawTransaction, '[redacted]');
  assert.equal(o.from, '0x1');
});
