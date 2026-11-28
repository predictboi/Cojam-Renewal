// Owner wallet flow against the live local API with a stand in EIP-6963 wallet (no key: it answers eth_* calls with
// fixed values). Proposes a reward change, checks the wrong account refusal, and that the hash lands in the audit log.
//   APP=http://localhost:5192 API=http://localhost:8091 node e2e/owner-flow.cjs
const { chromium } = require('playwright');
const path = require('path');
const APP = process.env.APP || 'http://localhost:5192';
const API = process.env.API || 'http://localhost:8091';
const OWNER = (process.env.OWNER || '0x6Fd4d26d4C1ECc8B9692eD5852f26BF1f16DF5b1').toLowerCase();
const out = path.join(__dirname, '..', 'captures', 'live');

function walletScript(account, chainId) {
  return `(() => {
    const sent = [];
    const provider = { request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['${account}'];
      if (method === 'eth_chainId') return '0x' + (${chainId}).toString(16);
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'eth_sendTransaction') { sent.push(params[0]); window.__sent = sent; return '0x' + 'ab'.repeat(31) + String(sent.length).padStart(2, '0'); }
      if (method === 'eth_getTransactionReceipt') return { status: '0x1', blockNumber: '0x10', blockHash: '0x' + '11'.repeat(32), transactionHash: params[0], transactionIndex: '0x0', from: '${account}', to: null, cumulativeGasUsed: '0x1', gasUsed: '0x1', logs: [], logsBloom: '0x' + '00'.repeat(256), type: '0x0', effectiveGasPrice: '0x1', contractAddress: null };
      if (method === 'eth_blockNumber') return '0x20';
      if (method === 'eth_getBlockByNumber') return { number: '0x20', hash: '0x' + '22'.repeat(32), timestamp: '0x1', transactions: [] };
      throw new Error('unsupported ' + method);
    }, on() {}, removeListener() {} };
    const info = { uuid: 'test', name: 'Test Wallet', icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>', rdns: 'app.test.wallet' };
    window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) })));
  })();`;
}

(async () => {
  const b = await chromium.launch();
  const res = {};
  // 1. wrong account
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(walletScript('0x1111111111111111111111111111111111111111', 1001));
  let p = await ctx.newPage();
  await p.goto(APP + '/rewards', { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.fill('#p-completion', '120');
  await p.click('[data-act="review"]'); await p.waitForSelector('#sheet');
  await p.click('#sheet [data-act="flow-go"]'); await p.waitForTimeout(1500);
  res.wrongWallet = (await p.textContent('#sheet .err').catch(() => null));
  await p.screenshot({ path: path.join(out, 'w-owner-wrongwallet.png') });
  await ctx.close();
  // 2. the owner signs
  ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(walletScript(OWNER, 1001));
  p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(APP + '/rewards', { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.fill('#p-completion', '120');
  await p.fill('#rate-90-0', '11.50').catch(() => {});
  await p.click('[data-act="review"]'); await p.waitForSelector('#sheet');
  await p.screenshot({ path: path.join(out, 'w-owner-review.png') });
  await p.click('#sheet [data-act="flow-go"]');
  await p.waitForSelector('#sheet [data-act="flow-close"]', { timeout: 20000 });
  res.done = await p.textContent('#sheet .note');
  res.sentTx = await p.evaluate(() => (window.__sent || []).map((t) => ({ to: t.to, selector: t.data.slice(0, 10) })));
  await p.screenshot({ path: path.join(out, 'w-owner-done.png') });
  await b.close();
  const aud = await (await fetch(API + '/admin/v1/audit?limit=10', { headers: { 'x-dev-admin': 'dev@cojam.app' } })).json();
  res.audit = aud.entries.map((e) => e.action + (e.tx_hash ? ' tx ' + e.tx_hash.slice(0, 12) + '…' : ''));
  res.errors = errs;
  console.log(JSON.stringify(res, null, 1));
})();
