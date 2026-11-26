// Unit tests for the 0x31 assembly (node --test, Node 22 strips the types).
// A locally generated key stands in for the Privy wallet: it signs the same SigHash that the PWA
// passes to Privy's secp256k1_sign, so everything except the Privy call itself is covered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Wallet, encodeRlp, keccak256, toBeHex, getAddress, Signature } from 'ethers';
import { buildFdCall, toKaiaSignature, assembleSenderRaw, signFdCall, spikeAbi, FD_SCE } from '../src/lib/kaiaTx.ts';

const require = createRequire(import.meta.url);
// The spike fee payer's decoder (copied from server/src/policy.js), used as the independent check.
const policy = require('../../api/src/policy.js');
// The swap site's signing path (@kaiachain/ethers-ext Wallet), installed in api/.
const ext = require('../../api/node_modules/@kaiachain/ethers-ext/dist/cjs/v6/index.js');

const CONTRACT = '0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58';
const call = (from: string, nonce = 3) => ({
  chainId: 1001,
  from,
  to: CONTRACT,
  data: spikeAbi.encodeFunctionData('predict', [123456789n, 2]),
  nonce,
  gasLimit: 150000n,
  gasPrice: 27_500_000_000n,
});

const minimal = (n: bigint | number) => (BigInt(n) === 0n ? '0x' : toBeHex(BigInt(n)));

test('SigHash equals the Kaia spec computed by hand', () => {
  const w = Wallet.createRandom();
  const c = call(w.address);
  const { sigHash } = buildFdCall(c);
  // SigRLP = encode([ encode([type, nonce, gasPrice, gas, to, value, from, input]), chainid, 0, 0 ])
  const inner = encodeRlp([toBeHex(FD_SCE), minimal(c.nonce), minimal(c.gasPrice), minimal(c.gasLimit), c.to.toLowerCase(), '0x', c.from.toLowerCase(), c.data]);
  const sigRlp = encodeRlp([inner, minimal(c.chainId), '0x', '0x']);
  assert.equal(sigHash, keccak256(sigRlp));
});

test('a local key signature over the SigHash is decoded by the fee payer as the sender', async () => {
  const w = Wallet.createRandom();
  const { raw, sig } = await signFdCall(call(w.address), async (h) => w.signingKey.sign(h).serialized);
  assert.match(raw, /^0x31/);
  assert.equal(sig.byteLength, 65);
  assert.ok(sig.vReturned === 27 || sig.vReturned === 28);
  assert.equal(sig.vKaia, 1001 * 2 + 35 + sig.yParity);
  const tx = policy.decodeSenderTx(raw);
  assert.equal(tx.type, 0x31);
  assert.equal(tx.chainId, 1001);
  assert.equal(tx.from, w.address);
  assert.equal(tx.signer, w.address);
  assert.equal(tx.to, getAddress(CONTRACT));
  assert.equal(tx.nonce, 3);
  assert.equal(tx.value, 0n);
  assert.equal(tx.data, call(w.address).data.toLowerCase());
});

test('identical to the @kaiachain/ethers-ext Wallet output (the swap site path)', async () => {
  const w = Wallet.createRandom();
  const c = call(w.address, 0);
  const { raw } = await signFdCall(c, async (h) => w.signingKey.sign(h).serialized);
  const kw = new ext.Wallet(w.privateKey);
  const viaExt = await kw.signTransaction({ type: FD_SCE, chainId: c.chainId, nonce: c.nonce, gasPrice: c.gasPrice, gasLimit: c.gasLimit, to: c.to, value: 0, from: c.from, data: c.data });
  assert.equal(raw.toLowerCase(), viaExt.toLowerCase());
});

test('v given as 0/1 (yParity) is converted the same way as 27/28', async () => {
  const w = Wallet.createRandom();
  const built = buildFdCall(call(w.address));
  const s = w.signingKey.sign(built.sigHash);
  const as01 = s.r + s.s.slice(2) + (s.yParity === 1 ? '01' : '00');
  const a = toKaiaSignature(built.sigHash, s.serialized, 1001, w.address);
  const b = toKaiaSignature(built.sigHash, as01, 1001, w.address);
  assert.equal(a.vKaia, b.vKaia);
  assert.equal(b.vReturned, s.yParity);
  assert.equal(policy.decodeSenderTx(assembleSenderRaw(built, b)).signer, w.address);
});

test('a 64 byte compact (EIP-2098) signature also works', () => {
  const w = Wallet.createRandom();
  const built = buildFdCall(call(w.address));
  const s = w.signingKey.sign(built.sigHash);
  const compact = Signature.from(s).compactSerialized;
  const info = toKaiaSignature(built.sigHash, compact, 1001, w.address);
  assert.equal(info.byteLength, 64);
  assert.equal(policy.decodeSenderTx(assembleSenderRaw(built, info)).signer, w.address);
});

test('a signature from another key is refused before anything is posted', () => {
  const w = Wallet.createRandom();
  const other = Wallet.createRandom();
  const built = buildFdCall(call(w.address));
  assert.throws(() => toKaiaSignature(built.sigHash, other.signingKey.sign(built.sigHash).serialized, 1001, w.address), /recovers to/);
});

test('garbage from the signer gives a clear error', () => {
  const w = Wallet.createRandom();
  const built = buildFdCall(call(w.address));
  assert.throws(() => toKaiaSignature(built.sigHash, 'nope', 1001, w.address), /not a hex string/);
  assert.throws(() => toKaiaSignature(built.sigHash, '0x1234', 1001, w.address), /Unexpected signature length/);
});

test('setPlayKey calldata decodes on the fee payer policy', async () => {
  const w = Wallet.createRandom();
  const key = Wallet.createRandom();
  const now = Math.floor(Date.now() / 1000);
  const c = { ...call(w.address), data: spikeAbi.encodeFunctionData('setPlayKey', [key.address, now + 30 * 86400]), gasLimit: 160000n };
  const { raw } = await signFdCall(c, async (h) => w.signingKey.sign(h).serialized);
  const tx = policy.decodeSenderTx(raw);
  const out = policy.checkStatic(tx, { chainId: 1001, spikeAddress: CONTRACT, feePayerAddress: Wallet.createRandom().address, policy: { maxGasLimit: 250000, maxGasPriceWei: 50_000_000_000n, maxKeyLifetimeSec: 90 * 86400 } }, now);
  assert.equal(out.action, 'setPlayKey');
  assert.equal(out.args.key, key.address);
});
