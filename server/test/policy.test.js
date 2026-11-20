'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { keccak256, recoverAddress, Signature, parseUnits, Wallet: EthersWallet } = require('ethers');
const { parseTransaction, KlaytnTxFactory, TxType } = require('@kaiachain/js-ext-core');
const { createFeePayerService } = require('../src/feePayer');
const { MemoryUsageStore } = require('../src/store');
const { silentLogger } = require('../src/log');
const { oldCtAbi, notSponsoredAbi } = require('../src/abi');
const h = require('./helpers');

function setup({ env = {}, chain: chainOpts = {} } = {}) {
  const cfg = h.testConfig(env);
  const chain = h.mockChain(chainOpts);
  const store = new MemoryUsageStore();
  const feePayerWallet = new h.KaiaWallet(cfg.feePayerPrivateKey);
  const svc = createFeePayerService({ cfg, chain, store, wallet: feePayerWallet, logger: silentLogger, receiptPollMs: 1, receiptTries: 3 });
  const holder = new h.KaiaWallet(h.randomKey());
  return { cfg, chain, store, svc, holder, feePayerWallet };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (e) => {
    assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
    return true;
  });
}

// Verifies the broadcast transaction carries our fee payer and a valid fee payer signature.
function assertFeePayerSigned(signed, feePayerAddress) {
  const p = parseTransaction(signed);
  assert.equal(Number(p.type), TxType.FeeDelegatedSmartContractExecution);
  assert.equal(p.feePayer.toLowerCase(), feePayerAddress.toLowerCase());
  assert.equal(p.feePayerSignatures.length, 1);
  const [v, r, s] = p.feePayerSignatures[0];
  const k = KlaytnTxFactory.fromObject({ ...p, chainId: 8217 });
  const digest = keccak256(k.sigFeePayerRLP());
  const yParity = Number((BigInt(v) - 35n) % 2n);
  assert.equal(recoverAddress(digest, Signature.from({ r, s, yParity })), feePayerAddress);
}

test('accepts approve(swap, amount) on old CT and signs as fee payer', async () => {
  const { svc, chain, holder, feePayerWallet } = setup();
  const raw = await h.senderSign(holder, { to: h.OLD_CT, data: h.calls.approve(h.SWAP), gasLimit: 80000n });
  const out = await svc.sponsor(raw);
  assert.equal(out.action, 'approve');
  assert.match(out.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(chain.state.sent.length, 1);
  assert.equal(out.txHash, keccak256(chain.state.sent[0]));
  assertFeePayerSigned(chain.state.sent[0], feePayerWallet.address);
  // the sender part is untouched
  const p = parseTransaction(chain.state.sent[0]);
  assert.equal(p.from, holder.address);
  assert.equal(p.data, h.calls.approve(h.SWAP));
});

test('accepts migrate(amount) on the swap contract', async () => {
  const { svc, chain, holder, feePayerWallet } = setup();
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), gasLimit: 300000n });
  const out = await svc.sponsor(raw);
  assert.equal(out.action, 'migrate');
  assertFeePayerSigned(chain.state.sent[0], feePayerWallet.address);
});

test('accepts claim(maxLots) on the swap contract', async () => {
  const { svc, holder } = setup();
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.claim(25), gasLimit: 300000n });
  assert.equal((await svc.sponsor(raw)).action, 'claim');
});

test('accepts claimFor(user, maxLots) on the swap contract', async () => {
  const { svc, holder } = setup();
  const other = EthersWallet.createRandom().address;
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.claimFor(other, 5), gasLimit: 300000n });
  assert.equal((await svc.sponsor(raw)).action, 'claimFor');
});

test('accepts claimForMany(users, maxLotsEach) on the swap contract', async () => {
  const { svc, holder } = setup();
  const others = [EthersWallet.createRandom().address, EthersWallet.createRandom().address];
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.claimForMany([holder.address, ...others], 5), gasLimit: 400000n });
  const out = await svc.sponsor(raw);
  assert.equal(out.action, 'claimForMany');
});

test('rejects claimForMany with no users, too many users, a zero user or a bad maxLotsEach', async () => {
  const { svc, holder, cfg } = setup();
  const many = Array.from({ length: cfg.policy.maxClaimUsers + 1 }, () => EthersWallet.createRandom().address);
  const cases = [
    h.calls.claimForMany([], 5),
    h.calls.claimForMany(many, 5),
    h.calls.claimForMany([holder.address, '0x0000000000000000000000000000000000000000'], 5),
    h.calls.claimForMany([holder.address], 0),
    h.calls.claimForMany([holder.address], cfg.policy.maxClaimLots + 1),
  ];
  for (const [i, data] of cases.entries()) {
    await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data, nonce: i })), 'CALLDATA_INVALID');
  }
});

test('never sponsors the master withdraw or any admin style selector', async () => {
  const { svc, holder, chain } = setup();
  const calls = [
    notSponsoredAbi.encodeFunctionData('withdraw', [parseUnits('1', 18)]),
    notSponsoredAbi.encodeFunctionData('sweep', []),
    notSponsoredAbi.encodeFunctionData('pauseMigrate', []),
    notSponsoredAbi.encodeFunctionData('withdrawReserve', [holder.address, parseUnits('1', 18)]),
    notSponsoredAbi.encodeFunctionData('recoverERC20', [h.OLD_CT, holder.address, 1n]),
    notSponsoredAbi.encodeFunctionData('transferOwnership', [holder.address]),
  ];
  for (const [i, data] of calls.entries()) {
    await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data, nonce: i })), 'SELECTOR_NOT_ALLOWED');
  }
  assert.equal(chain.state.sent.length, 0);
});

test('rejects a value transfer inside a smart contract execution', async () => {
  const { svc, holder, chain } = setup();
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), value: 1n });
  await expectCode(svc.sponsor(raw), 'VALUE_NOT_ZERO');
  assert.equal(chain.state.sent.length, 0);
});

test('rejects a fee delegated value transfer tx type', async () => {
  const { svc, holder } = setup();
  const raw = await holder.signTransaction({
    type: TxType.FeeDelegatedValueTransfer,
    from: holder.address,
    to: h.SWAP,
    value: parseUnits('1', 18),
    gasLimit: 21000n,
    gasPrice: 27500000000n,
    chainId: 8217,
    nonce: 0,
  });
  await expectCode(svc.sponsor(raw), 'TX_TYPE_NOT_ALLOWED');
});

test('rejects partial fee delegation and plain Ethereum transactions', async () => {
  const { svc, holder } = setup();
  const ratio = await holder.signTransaction({
    type: TxType.FeeDelegatedSmartContractExecutionWithRatio,
    from: holder.address,
    to: h.SWAP,
    data: h.calls.migrate(),
    value: 0n,
    feeRatio: 50,
    gasLimit: 300000n,
    gasPrice: 27500000000n,
    chainId: 8217,
    nonce: 0,
  });
  await expectCode(svc.sponsor(ratio), 'TX_TYPE_NOT_ALLOWED');
  const eth = await new EthersWallet(h.randomKey()).signTransaction({ type: 0, to: h.SWAP, data: h.calls.migrate(), gasLimit: 300000n, gasPrice: 27500000000n, chainId: 8217, nonce: 0 });
  await expectCode(svc.sponsor(eth), 'TX_TYPE_NOT_ALLOWED');
});

test('rejects a call to any other contract', async () => {
  const { svc, holder } = setup();
  const raw = await h.senderSign(holder, { to: EthersWallet.createRandom().address, data: h.calls.migrate() });
  await expectCode(svc.sponsor(raw), 'TARGET_NOT_ALLOWED');
});

test('rejects approve to a spender other than the swap', async () => {
  const { svc, holder } = setup();
  const raw = await h.senderSign(holder, { to: h.OLD_CT, data: h.calls.approve(EthersWallet.createRandom().address) });
  await expectCode(svc.sponsor(raw), 'SPENDER_NOT_ALLOWED');
});

test('rejects unknown selectors on both contracts', async () => {
  const { svc, holder } = setup();
  const transfer = '0xa9059cbb' + '00'.repeat(12) + h.SWAP.slice(2).toLowerCase() + '00'.repeat(31) + '01';
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.OLD_CT, data: transfer })), 'SELECTOR_NOT_ALLOWED');
  const withdraw = '0x2e1a7d4d' + '00'.repeat(31) + '01'; // withdraw(1): master only, never sponsored
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: withdraw, nonce: 2 })), 'SELECTOR_NOT_ALLOWED');
  const allowanceRead = oldCtAbi.encodeFunctionData('allowance', [holder.address, h.SWAP]);
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.OLD_CT, data: allowanceRead, nonce: 3 })), 'SELECTOR_NOT_ALLOWED');
});

test('rejects non canonical or out of range calldata', async () => {
  const { svc, holder } = setup();
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate() + 'ff' })), 'CALLDATA_INVALID');
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(0n), nonce: 1 })), 'CALLDATA_INVALID');
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.claim(51), nonce: 2 })), 'CALLDATA_INVALID');
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.claimFor(holder.address, 0), nonce: 3 })), 'CALLDATA_INVALID');
});

test('dust is not sponsored: migrate under MIN_SPONSORED_OLD_CT and approve from a dust wallet', async () => {
  const { svc, holder, chain } = setup({ chain: { oldCtBalance: parseUnits('0.5', 18) } });
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(parseUnits('0.5', 18)) })), 'AMOUNT_TOO_SMALL');
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.OLD_CT, data: h.calls.approve(h.SWAP), nonce: 1 })), 'NO_OLD_CT_BALANCE');
  assert.equal(chain.state.sent.length, 0);
});

test('rejects a transaction signed for another chain id', async () => {
  const { svc, holder } = setup();
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), chainId: 1001 });
  await expectCode(svc.sponsor(raw), 'CHAIN_ID_MISMATCH');
});

test('rejects gas limit above the cap', async () => {
  const { svc, holder } = setup();
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.OLD_CT, data: h.calls.approve(h.SWAP), gasLimit: 120001n })), 'GAS_LIMIT_TOO_HIGH');
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), gasLimit: 600001n })), 'GAS_LIMIT_TOO_HIGH');
});

test('rejects gas price above the cap', async () => {
  const { svc, holder } = setup();
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), gasPrice: 51n * h.GKEI });
  await expectCode(svc.sponsor(raw), 'GAS_PRICE_TOO_HIGH');
});

test('rejects a tampered sender signature', async () => {
  const { svc, holder } = setup();
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate() });
  const p = parseTransaction(raw);
  const r = p.txSignatures[0][1];
  const tampered = raw.replace(r.slice(2), (BigInt(r) ^ 1n).toString(16).padStart(64, '0'));
  assert.notEqual(tampered, raw);
  await expectCode(svc.sponsor(tampered), 'SENDER_SIGNATURE_INVALID');
});

test('rejects garbage input', async () => {
  const { svc } = setup();
  await expectCode(svc.sponsor('hello'), 'DECODE_FAILED');
  await expectCode(svc.sponsor('0x31c0'), 'DECODE_FAILED');
});

test('rate limits each sender per UTC day', async () => {
  const { svc, holder, chain } = setup();
  for (let n = 0; n < 10; n++) {
    await svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.claim(1), nonce: n }));
  }
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.claim(1), nonce: 10 })), 'RATE_LIMITED_SENDER');
  assert.equal(chain.state.sent.length, 10);
  // another holder is not affected
  const other = new h.KaiaWallet(h.randomKey());
  await svc.sponsor(await h.senderSign(other, { to: h.SWAP, data: h.calls.claim(1) }));
});

test('rate limits per client network', async () => {
  const { svc } = setup({ env: { IP_DAILY_TX_LIMIT: '2' } });
  for (let n = 0; n < 2; n++) {
    const w = new h.KaiaWallet(h.randomKey());
    await svc.sponsor(await h.senderSign(w, { to: h.SWAP, data: h.calls.claim(1) }), { ipKey: 'client-a' });
  }
  const w = new h.KaiaWallet(h.randomKey());
  await expectCode(svc.sponsor(await h.senderSign(w, { to: h.SWAP, data: h.calls.claim(1) }), { ipKey: 'client-a' }), 'RATE_LIMITED_IP');
});

test('parallel requests cannot pass the last free slot twice', async () => {
  const { svc, holder, chain } = setup({ env: { SENDER_DAILY_TX_LIMIT: '1' } });
  const a = h.senderSign(holder, { to: h.SWAP, data: h.calls.claim(1), nonce: 0 });
  const b = h.senderSign(holder, { to: h.SWAP, data: h.calls.claim(1), nonce: 1 });
  const results = await Promise.allSettled([svc.sponsor(await a), svc.sponsor(await b)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'RATE_LIMITED_SENDER');
  assert.equal(chain.state.sent.length, 1);
});

test('stops at the global daily KAIA budget', async () => {
  // Worst case per tx here: 300,000 gas x 27.5 gkei = 0.00825 KAIA. Budget 0.02 fits two.
  const { svc } = setup({ env: { DAILY_BUDGET_KAIA: '0.02' } });
  for (let n = 0; n < 2; n++) {
    const w = new h.KaiaWallet(h.randomKey());
    await svc.sponsor(await h.senderSign(w, { to: h.SWAP, data: h.calls.migrate(), gasLimit: 300000n }));
  }
  const w = new h.KaiaWallet(h.randomKey());
  await expectCode(svc.sponsor(await h.senderSign(w, { to: h.SWAP, data: h.calls.migrate(), gasLimit: 300000n })), 'DAILY_BUDGET_EXHAUSTED');
});

test('refuses when the fee payer balance is under the floor', async () => {
  const { svc, holder, chain } = setup({ chain: { feePayerBalance: parseUnits('4.99', 18) } });
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate() })), 'FEE_PAYER_BALANCE_LOW');
  assert.equal(chain.state.sent.length, 0);
});

test('refuses approve from a wallet with no old CT', async () => {
  const { svc, holder } = setup({ chain: { oldCtBalance: 0n } });
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.OLD_CT, data: h.calls.approve(h.SWAP) })), 'NO_OLD_CT_BALANCE');
});

test('refuses a transaction that would revert or run out of gas', async () => {
  const { svc, holder, chain, store } = setup({ chain: { estimateError: h.nodeError('execution reverted: NothingToClaim()') } });
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.claim(1) })), 'SIMULATION_FAILED');
  chain.state.estimateError = null;
  chain.state.estimate = 150000n;
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), gasLimit: 100000n, nonce: 1 })), 'GAS_LIMIT_TOO_LOW');
  // nothing was counted against the holder
  assert.equal(store.peek({ sender: holder.address.toLowerCase(), day: new Date().toISOString().slice(0, 10) }).senderCount, 0);
});

test('an RPC outage or a node rejection does not consume the holder quota', async () => {
  const { svc, holder, chain, store } = setup({ chain: { sendError: h.nodeError('nonce too low') } });
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate() })), 'BROADCAST_REJECTED');
  chain.state.sendError = null;
  chain.state.estimateError = h.transportError();
  await expectCode(svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), nonce: 1 })), 'RPC_UNAVAILABLE');
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(store.peek({ sender: holder.address.toLowerCase(), day }).senderCount, 0);
  assert.equal(store.peek({ sender: holder.address.toLowerCase(), day }).spentWei, 0n);
});

test('the same signed transaction posted twice is broadcast once', async () => {
  const { svc, holder, chain } = setup();
  const raw = await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate() });
  const [a, b] = await Promise.all([svc.sponsor(raw), svc.sponsor(raw)]);
  assert.equal(a.txHash, b.txHash);
  assert.equal(chain.state.sent.length, 1);
});

test('the real fee replaces the reserved worst case once the receipt arrives', async () => {
  const { svc, holder, store } = setup();
  await svc.sponsor(await h.senderSign(holder, { to: h.SWAP, data: h.calls.migrate(), gasLimit: 300000n }));
  await Promise.all([...svc._pendingSettlements]);
  const s = store.stats(new Date().toISOString().slice(0, 10));
  // mock receipt: 50,000 gas x 27.5 gkei
  assert.equal(s.today.sponsoredSpentWei, 50000n * 27500000000n);
  assert.equal(s.total.sponsored, 1);
});
