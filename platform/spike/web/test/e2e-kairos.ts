// End to end check of steps c, d, e and f on Kairos, with a locally generated key standing in for the
// Privy wallet (it signs the same SigHash the PWA hands to Privy's secp256k1_sign).
// Needs the spike API running (default http://localhost:8787, see api/scripts/local-with-test-key.js).
// Step f needs test KAIA on the stand in: set FUND_FROM_CONTRACTS_ENV=1 to send 0.01 test KAIA to it
// from the PRIVATE_KEY in contracts/.env (read from the file, never printed).
//   node test/e2e-kairos.ts            writes ../e2e-result.kairos.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JsonRpcProvider, Wallet, parseEther, formatEther } from 'ethers';
import {
  localSigner,
  signSponsorMine,
  signAndSponsor,
  playKeyBurst,
  readPlayer,
  setPlayKeyData,
  predictData,
  newMarketBase,
  txUrl,
  type Ctx,
} from '../src/lib/flow.ts';
import { spikeAbi } from '../src/lib/kaiaTx.ts';
import { rpc, RpcError } from '../src/lib/rpc.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dep = JSON.parse(readFileSync(path.join(here, '..', '..', 'contract', 'deployment.kairos.json'), 'utf8'));
const ctx: Ctx = {
  rpcUrl: process.env.KAIROS_RPC_URL || 'https://public-en-kairos.node.kaia.io',
  apiBase: process.env.SPIKE_API || 'http://localhost:8787',
  chainId: 1001,
  contract: dep.address,
};

const log = (...a: unknown[]) => console.log(...a);
const report: Record<string, unknown> = { ranAt: new Date().toISOString(), contract: ctx.contract, api: ctx.apiBase, standIn: 'local ethers key in place of the Privy wallet' };

async function main() {
  const player = Wallet.createRandom();
  const playKey = Wallet.createRandom();
  const P = localSigner(player, 'stand-in for Privy wallet');
  const K = localSigner(playKey, 'play key');
  report.player = player.address;
  report.playKey = playKey.address;
  log('player (stand in)', player.address, ' play key', playKey.address);

  // c. setPlayKey signed by the "Privy" wallet (no KAIA held), sponsored
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 86400;
  const c = await signSponsorMine(ctx, P, 'setPlayKey', setPlayKeyData(playKey.address, expiresAt));
  log('c setPlayKey', c.txHash, `sign ${c.signMs} ms, post ${c.postMs} ms, mined after ${c.mineMs} ms, gas ${c.receipt.gasUsed}`);
  log('  signature', c.signature.conversion);
  report.c_setPlayKey = { txHash: c.txHash, url: c.url, signMs: c.signMs, postMs: c.postMs, mineMs: c.mineMs, totalMs: c.totalMs, gasUsed: c.receipt.gasUsed.toString(), feePayer: c.receipt.feePayer, signature: c.signature };

  // d. five predicts by the play key, back to back without waiting for receipts
  const base = newMarketBase();
  const d = await playKeyBurst(ctx, K, base, 5);
  for (const s of d.sent) log('d predict', s.nonce, s.txHash, `sign ${s.signMs} ms post ${s.postMs} ms`);
  log('  mined order (nonces)', d.minedOrder.join(','), 'in nonce order:', d.inNonceOrder, `send all ${d.sendAllMs} ms, total ${d.totalMs} ms`);
  const state = await readPlayer(ctx, player.address, playKey.address);
  log('  chain state', state);
  report.d_playKeyBurst = {
    txs: d.sent.map((s, i) => ({ nonce: s.nonce, txHash: s.txHash, url: s.url, signMs: s.signMs, postMs: s.postMs, block: d.mined[i].blockNumber, index: d.mined[i].transactionIndex, status: d.mined[i].status })),
    minedOrder: d.minedOrder,
    inNonceOrder: d.inNonceOrder,
    sendAllMs: d.sendAllMs,
    totalMs: d.totalMs,
    stateAfter: state,
    creditedToPlayer: state.points === 5 && state.keyPoints === 0,
  };

  // duplicate predict is refused by simulation before broadcast (ALREADY_DONE)
  try {
    await signAndSponsor(ctx, K, 'predict', predictData(base, 1));
    report.duplicate = 'NOT REFUSED (unexpected)';
  } catch (e) {
    report.duplicate = (e as Error).message;
    log('duplicate predict refused:', (e as Error).message);
  }

  // e. direct predict signed by the "Privy" wallet
  const e = await signSponsorMine(ctx, P, 'predict', predictData(base + 100n, 2));
  log('e direct predict', e.txHash, `sign ${e.signMs} ms, post ${e.postMs} ms, mined after ${e.mineMs} ms, gas ${e.receipt.gasUsed}`);
  report.e_directPredict = { txHash: e.txHash, url: e.url, signMs: e.signMs, postMs: e.postMs, mineMs: e.mineMs, totalMs: e.totalMs, gasUsed: e.receipt.gasUsed.toString() };

  // soulbound: transfer reverts
  try {
    await rpc(ctx.rpcUrl, 'eth_call', [{ from: player.address, to: ctx.contract, data: spikeAbi.encodeFunctionData('transfer', [playKey.address, 1]) }, 'latest']);
    report.soulbound = 'transfer did NOT revert (unexpected)';
  } catch (err) {
    const data = (err as RpcError).data;
    let name = (err as Error).message;
    try {
      if (data) name = spikeAbi.parseError(data)?.name || name;
    } catch {
      /* keep message */
    }
    report.soulbound = `transfer reverts: ${name}`;
    log('soulbound transfer reverts:', name);
  }

  // f. user paid plain transfer from the "Privy" wallet
  const provider = new JsonRpcProvider(ctx.rpcUrl, 1001, { staticNetwork: true });
  if (process.env.FUND_FROM_CONTRACTS_ENV === '1') {
    const envText = readFileSync(path.join(here, '..', '..', '..', '..', 'contracts', '.env'), 'utf8');
    const m = envText.match(/^\s*PRIVATE_KEY\s*=\s*["']?([0-9a-fA-Fx]+)["']?\s*$/m);
    if (!m) throw new Error('PRIVATE_KEY not found in contracts/.env');
    const funder = new Wallet(m[1].startsWith('0x') ? m[1] : `0x${m[1]}`, provider);
    const ftx = await funder.sendTransaction({ to: player.address, value: parseEther('0.01'), type: 0 });
    await ftx.wait();
    report.f_funding = { txHash: ftx.hash, url: txUrl(ftx.hash), amountKaia: '0.01' };
    log('funded stand in with 0.01 test KAIA', ftx.hash);
    const pw = player.connect(provider);
    const t0 = performance.now();
    const tx = await pw.sendTransaction({ to: funder.address, value: parseEther('0.001') });
    const sendMs = Math.round(performance.now() - t0);
    const rc = await tx.wait();
    report.f_userPaidTransfer = { txHash: tx.hash, url: txUrl(tx.hash), txType: tx.type, sendMs, totalMs: Math.round(performance.now() - t0), status: rc?.status, balanceAfterKaia: formatEther(await provider.getBalance(player.address)) };
    log('f user paid transfer', tx.hash, 'type', tx.type, 'status', rc?.status);
  } else {
    report.f_userPaidTransfer = 'skipped (set FUND_FROM_CONTRACTS_ENV=1)';
  }

  report.finalState = await readPlayer(ctx, player.address, playKey.address);
  const out = path.join(here, '..', '..', 'e2e-result.kairos.json');
  writeFileSync(out, JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
  log('wrote', out);
}

main().catch((e) => {
  console.error('E2E FAILED:', e);
  process.exit(1);
});
