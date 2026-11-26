// Headless Chromium check of the built PWA in ?devkey=1 mode (Privy is not used: it needs an email code).
// Needs: `npm run build && npm run preview` (http://localhost:4173) and the spike API on :8787.
// Playwright is not a dependency of this folder; run with the global install:
//   NODE_PATH=$(npm root -g) node test/browser-check.cjs
// Set FUND_FROM_CONTRACTS_ENV=1 to fund the dev key with 0.01 test KAIA for step f from contracts/.env
// PRIVATE_KEY (read from the file, never printed). Writes ../browser-check.result.json and a screenshot.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { JsonRpcProvider, Wallet, parseEther } = require('ethers');

const BASE = process.env.SPIKE_WEB || 'http://localhost:4173';
const OUT = path.join(__dirname, '..', '..');
const RPC = 'https://public-en-kairos.node.kaia.io';

async function stepDone(page, id, timeout = 120000) {
  const sel = `section[aria-labelledby="h-${id}"] .badge`;
  await page.waitForFunction((s) => {
    const t = document.querySelector(s)?.textContent;
    return t === 'ok' || t === 'error';
  }, sel, { timeout });
  return page.textContent(sel);
}
const click = (page, name) => page.getByRole('button', { name }).click();
const stepText = (page, id) => page.textContent(`section[aria-labelledby="h-${id}"]`);

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
  const browser = await chromium.launch({ proxy });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(`${m.type()}: ${m.text()}`.slice(0, 400));
  });
  page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${e.message}`));

  const out = { base: BASE, checkedAt: new Date().toISOString() };
  await page.goto(`${BASE}/?devkey=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => /holds .* KAIA|unreachable|No fee payer/.test(document.body.innerText), null, { timeout: 30000 });
  out.feePayerBanner = await page.textContent('.banner-ok, .banner-warn');

  // Installability: manifest, service worker, icons (Chrome DevTools protocol)
  const cdp = await context.newCDPSession(page);
  const sw = await page.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 10000))]);
    return reg ? { scope: reg.scope, active: !!reg.active } : null;
  });
  await page.reload({ waitUntil: 'load' });
  out.serviceWorker = { ...sw, controllingAfterReload: await page.evaluate(() => !!navigator.serviceWorker.controller) };
  const manifest = await cdp.send('Page.getAppManifest');
  out.manifest = { url: manifest.url, errors: manifest.errors, parsed: manifest.data ? JSON.parse(manifest.data) : null };
  out.installabilityErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors;
  for (const icon of out.manifest.parsed?.icons || []) {
    const r = await page.request.get(new URL(icon.src, BASE).href);
    icon.httpStatus = r.status();
  }

  await page.waitForFunction(() => /holds .* KAIA/.test(document.body.innerText), null, { timeout: 30000 });
  const devAddr = (await page.textContent('section[aria-labelledby="h-b"] code')).trim();
  out.devKeyAddress = devAddr;

  // f before funding: the "no KAIA" path
  await click(page, 'Send 0.001 KAIA');
  out.f_noKaia = { badge: await stepDone(page, 'f'), error: await page.textContent('section[aria-labelledby="h-f"] .error') };

  // c, d, e
  await click(page, 'Authorise play key');
  out.c = { badge: await stepDone(page, 'c') };
  await click(page, 'Measure 5 raw signatures');
  out.c2 = { badge: await stepDone(page, 'c2') };
  await click(page, 'Send 5 predicts');
  out.d = { badge: await stepDone(page, 'd', 180000) };
  await click(page, 'Predict directly');
  out.e = { badge: await stepDone(page, 'e') };

  if (process.env.FUND_FROM_CONTRACTS_ENV === '1') {
    const text = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'contracts', '.env'), 'utf8');
    const m = text.match(/^\s*PRIVATE_KEY\s*=\s*["']?([0-9a-fA-Fx]+)["']?\s*$/m);
    const funder = new Wallet(m[1].startsWith('0x') ? m[1] : `0x${m[1]}`, new JsonRpcProvider(RPC, 1001, { staticNetwork: true }));
    const tx = await funder.sendTransaction({ to: devAddr, value: parseEther('0.01'), type: 0 });
    await tx.wait();
    out.f_funding = tx.hash;
    await click(page, 'Send 0.001 KAIA');
    await page.waitForFunction(() => document.querySelector('section[aria-labelledby="h-f"] .badge')?.textContent === 'running', null, { timeout: 5000 }).catch(() => {});
    out.f = { badge: await stepDone(page, 'f') };
  }

  // play key survives a reload (IndexedDB)
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => /On launch: found/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  out.playKeyAfterReload = (await stepText(page, 'd')).match(/On launch: [^.]*\./)?.[0];

  // The report as the tester would copy it (after the reload the steps are fresh, so copy before? no:
  // re-run nothing; copy shows launch info). Re-run c..e quickly is not needed: read the pre-reload report instead.
  await page.screenshot({ path: path.join(OUT, 'browser-check.png'), fullPage: true });
  out.consoleWarningsAndErrors = consoleMsgs;
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'browser-check.result.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error('BROWSER CHECK FAILED', e);
  process.exit(1);
});
