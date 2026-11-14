// End to end test of the live swap app (/migrate/) against the real contracts on Kaia Kairos, with no wallet extension.
//
//   node tools/e2e/live-swap.js [mm] [kaia] [errors] [claim]      (default: all four)
//
// A mock EIP-1193 wallet is injected into the page. Its request() goes to Node through page.exposeFunction, where an
// ethers Wallet holds the throwaway Kairos test key (PRIVATE_KEY in contracts/.env, never printed) and signs:
//   mm     MetaMask style window.ethereum (EIP-6963 rdns io.metamask) that starts on the wrong chain (8217). The page
//          switches it to Kairos, the first approve is rejected in the wallet, then approve, swap: self paid
//          eth_sendTransaction. Checks the 10% new CT arrived and the lot exists on chain and in the page history.
//   kaia   Kaia Wallet style window.klaytn (isKaikas) implementing klay_signTransaction: the page builds 0x31 fee delegated
//          approve and migrate, a local gas server (server/, RUN_MODE=api, same key as fee payer) co-signs and sends.
//          Checks the transactions on chain are type 0x31 with the fee payer set.
//   errors Kaia Wallet with the gas server unreachable: InsufficientReserve and NothingToClaim map to their states, the fee
//          payer error offers "Pay the fee myself", and approve and swap then go out as 0x30 paid by the wallet.
//   claim  Same Kaia Wallet path against CojamMigrationShortLock (1 minute lock, contracts/deployments/kairos.json), served
//          to the page by rewriting network.js: swap, wait for the unlock, then the sponsored claim from the page.
//
// Needs: playwright (global), server/node_modules (npm ci in server/), network access to Kairos. Starts
// `python3 -m http.server 8811 -d site` and the gas servers itself when their ports are free. Amounts are a few test CT.
const path = require("path"), fs = require("fs"), { spawn } = require("child_process"), net = require("net"), assert = require("assert");
const ROOT = path.resolve(__dirname, "../..");
const sreq = require("module").createRequire(path.join(ROOT, "server/package.json"));
const { ethers } = sreq("ethers");
const kx = sreq("@kaiachain/ethers-ext/v6");
const { chromium } = require(require.resolve("playwright", { paths: [process.execPath.replace(/bin\/node$/, "lib/node_modules"), ROOT] }));

const RPC = "https://public-en-kairos.node.kaia.io";
const DEP = JSON.parse(fs.readFileSync(path.join(ROOT, "contracts/deployments/kairos.json"), "utf8"));
const OLD = DEP.oldToken, NEW = DEP.newToken, SWAP = DEP.migration, SHORT = DEP.shortLockTest.swap, SHORT_BLOCK = DEP.shortLockTest.deployBlock;
const SITE = "http://localhost:8811", GAS_MAIN = 8787, GAS_SHORT = 8788;

function envKey() {
  const txt = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8");
  const m = txt.match(/^PRIVATE_KEY\s*=\s*"?(0x)?([0-9a-fA-F]{64})"?\s*$/m);
  if (!m) throw new Error("PRIVATE_KEY missing in contracts/.env");
  return "0x" + m[2];
}
const KEY = envKey();
const rp = new ethers.JsonRpcProvider(RPC, 1001, { staticNetwork: true });
const wallet = new ethers.Wallet(KEY, rp);
const kwallet = new kx.Wallet(KEY, new kx.JsonRpcProvider(RPC));
const ADDR = wallet.address;
const erc = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
const sw = new ethers.Interface(["function lotCount(address) view returns (uint256)", "function lotOf(address,uint256) view returns (uint256,uint256,bool)", "function nextClaimIndex(address) view returns (uint256)"]);
const bal = async (tok) => BigInt(await rp.call({ to: tok, data: erc.encodeFunctionData("balanceOf", [ADDR]) }));
const lotCount = async (s) => Number(await rp.call({ to: s, data: sw.encodeFunctionData("lotCount", [ADDR]) }));
const nextClaim = async (s) => Number(await rp.call({ to: s, data: sw.encodeFunctionData("nextClaimIndex", [ADDR]) }));
const lotOf = async (s, i) => sw.decodeFunctionResult("lotOf", await rp.call({ to: s, data: sw.encodeFunctionData("lotOf", [ADDR, i]) }));

const log = (...a) => console.log("[e2e]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const portFree = (p) => new Promise((res) => { const s = net.createServer().once("error", () => res(false)).once("listening", () => s.close(() => res(true))).listen(p, "127.0.0.1"); });
const kids = [];
async function startSite() {
  if (!(await portFree(8811))) { log("site already served on 8811"); return; }
  kids.push(spawn("python3", ["-m", "http.server", "8811", "-d", path.join(ROOT, "site")], { stdio: "ignore" }));
  await sleep(800);
}
async function startGas(port, swap, block) {
  if (!(await portFree(port))) throw new Error("port " + port + " busy");
  const env = Object.assign({}, process.env, {
    RUN_MODE: "api", PORT: String(port), KAIA_RPC_URL: RPC, CHAIN_ID: "1001", OLD_CT_ADDRESS: OLD, SWAP_CONTRACT_ADDRESS: swap,
    SWAP_DEPLOY_BLOCK: String(block), FEE_PAYER_PRIVATE_KEY: KEY, ALLOWED_ORIGINS: SITE, TRUST_PROXY: "false", MIN_FEE_PAYER_BALANCE_KAIA: "1"
  });
  const p = spawn(process.execPath, ["src/index.js"], { cwd: path.join(ROOT, "server"), env, stdio: ["ignore", "pipe", "pipe"] });
  kids.push(p);
  const lines = [];
  p.stdout.on("data", (d) => String(d).split("\n").filter(Boolean).forEach((l) => lines.push(l)));
  p.stderr.on("data", (d) => String(d).split("\n").filter(Boolean).forEach((l) => lines.push(l)));
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try { const r = await fetch("http://localhost:" + port + "/api/health"); if (r.ok) return lines; } catch (e) {}
  }
  throw new Error("gas server did not start: " + lines.slice(-5).join(" / "));
}

// ---------- the mock wallet ----------
const TYPE = { FEE_DELEGATED_SMART_CONTRACT_EXECUTION: 0x31, SMART_CONTRACT_EXECUTION: 0x30 };
function makeHandler(record) {
  return async (json) => {
    const { method, params } = JSON.parse(json);
    try {
      let result;
      switch (method) {
        case "eth_requestAccounts": case "eth_accounts": case "klay_requestAccounts": case "klay_accounts": result = [ADDR]; break;
        case "wallet_watchAsset": result = true; break;
        case "eth_sendTransaction": {
          const t = params[0];
          const r = await wallet.sendTransaction({ to: t.to, data: t.data, value: 0, gasLimit: t.gas ? BigInt(t.gas) : undefined });
          record.push({ method, hash: r.hash, to: t.to, selector: t.data.slice(0, 10) });
          result = r.hash; break;
        }
        case "klay_signTransaction": case "klay_sendTransaction": {
          const t = params[0];
          const type = typeof t.type === "string" && TYPE[t.type] != null ? TYPE[t.type] : Number(t.type);
          const nonce = await rp.getTransactionCount(ADDR, "pending");
          const gasPrice = t.gasPrice ? BigInt(t.gasPrice) : BigInt(await rp.send("eth_gasPrice", []));
          const raw = await kwallet.signTransaction({ type, from: ADDR, to: t.to, data: t.data, value: 0, gasLimit: BigInt(t.gas), gasPrice, chainId: 1001, nonce });
          if (method === "klay_signTransaction") { record.push({ method, type: "0x" + type.toString(16), to: t.to, selector: t.data.slice(0, 10), gas: Number(BigInt(t.gas)) }); result = { rawTransaction: raw }; }
          else { result = await rp.send("klay_sendRawTransaction", [raw]); record.push({ method, hash: result }); }
          break;
        }
        default: result = await rp.send(method.replace(/^klay_chainI[dD]$/, "eth_chainId").replace(/^klay_/, "eth_"), params || []);
      }
      return JSON.stringify({ result: result === undefined ? null : result });
    } catch (e) {
      const data = e.data || (e.info && e.info.error && e.info.error.data) || (e.error && e.error.data);
      return JSON.stringify({ error: { code: e.code === "CALL_EXCEPTION" ? 3 : -32603, message: e.shortMessage || e.message, data } });
    }
  };
}
// Runs in the page before any script. cfg: {kind: "mm" | "kaia", chainId}
function injectWallet(cfg) {
  const ls = {};
  let chainId = Number(sessionStorage.getItem("__cjChain")) || cfg.chainId; // a real wallet keeps its network across reloads
  const emit = (ev, v) => (ls[ev] || []).slice().forEach((f) => { try { f(v); } catch (e) {} });
  window.__cjRejectNext = false;
  const p = {
    request: async ({ method, params }) => {
      if (/^(eth|klay)_chainI[dD]$/.test(method)) return "0x" + chainId.toString(16);
      if (method === "net_version") return String(chainId);
      if ((method === "eth_sendTransaction" || method === "klay_signTransaction" || method === "klay_sendTransaction") && window.__cjRejectNext) {
        window.__cjRejectNext = false; const e = new Error("User rejected the request."); e.code = 4001; throw e;
      }
      if (method === "wallet_switchEthereumChain" || method === "wallet_switchKlaytnChain") {
        const id = parseInt(params[0].chainId, 16);
        if (id !== 1001) { const e = new Error("Unrecognized chain"); e.code = 4902; throw e; }
        chainId = id; sessionStorage.setItem("__cjChain", String(id)); setTimeout(() => emit("chainChanged", "0x" + id.toString(16)), 10); return null;
      }
      if (method === "wallet_addEthereumChain" || method === "wallet_addKlaytnChain") return null;
      const o = JSON.parse(await window.__cjRpc(JSON.stringify({ method, params })));
      if (o.error) { const e = new Error(o.error.message); e.code = o.error.code; if (o.error.data) e.data = o.error.data; throw e; }
      return o.result;
    },
    on: (ev, fn) => { (ls[ev] = ls[ev] || []).push(fn); },
    removeListener: (ev, fn) => { ls[ev] = (ls[ev] || []).filter((f) => f !== fn); },
    // ethers-ext's Web3Provider routes through send when it exists (window.klaytn has one); it ends in request().
    send: function () { throw new Error("use request"); }
  };
  let info;
  if (cfg.kind === "mm") { p.isMetaMask = true; window.ethereum = p; info = { uuid: "e2e-mm", name: "MetaMask", icon: "data:,", rdns: "io.metamask" }; }
  else { p.isKaikas = true; p.selectedAddress = null; window.klaytn = p; info = { uuid: "e2e-kaia", name: "Kaia Wallet", icon: "data:,", rdns: "io.kaiawallet" }; }
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider: p }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
}

async function newPage(browser, cfg, record, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.__errs = errs;
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await page.exposeFunction("__cjRpc", makeHandler(record));
  await page.addInitScript(injectWallet, cfg);
  if (opts.swap) {
    // Point the page at another swap (the short lock test contract) by rewriting network.js on the way in.
    await page.route("**/assets/network.js", async (route) => {
      const r = await route.fetch(); let body = await r.text();
      body = body.replace(/swap: "0x[0-9a-fA-F]{40}"/, 'swap: "' + opts.swap + '"').replace(/deployBlock: \d+/, "deployBlock: " + opts.block);
      route.fulfill({ response: r, body });
    });
  }
  return { ctx, page, errs };
}
const errsOf = (page) => page.__errs || [];
const view = (page, v, timeout = 120000) => page.waitForSelector('#mg-panel .mg-view[data-view="' + v + '"]', { timeout });
async function connect(page, kind) {
  await view(page, "disconnected", 20000);
  await page.click('#mg-panel [data-act="connect"]');
  await page.click('#cj-connect [data-pick="' + kind + '"]');
}
async function swapFlow(page, amount, opts = {}) {
  await view(page, "form");
  await page.fill("#mg-amt", String(amount));
  await page.click("#mg-go").catch(async (e) => { throw new Error(e.message + " / panel: " + (await page.textContent("#mg-panel")).slice(0, 600)); });
  await page.click('#mg-confirm [data-cf="go"]', { timeout: 10000 }).catch(async (e) => {
    throw new Error("confirm sheet did not open / errors: " + errsOf(page).join(" | ") + " / panel: " + (await page.textContent("#mg-panel")).replace(/\s+/g, " ").slice(0, 900));
  });
  await view(page, "approve", 20000);
  if (opts.rejectFirst) {
    await page.evaluate(() => { window.__cjRejectNext = true; });
    await page.click('#mg-panel [data-act="approve"]');
    await page.waitForSelector("#mg-panel .note-error", { timeout: 20000 });
    log("  rejected approve shows:", (await page.textContent("#mg-panel .note-error p")).trim());
  }
  await page.click('#mg-panel [data-act="approve"]');
  await view(page, "swap");
  log("  approve confirmed, step 2 shown");
  await page.click('#mg-panel [data-act="swap"]');
  await view(page, "locked");
  return (await page.textContent("#mg-panel .mg-lead")).trim();
}

async function scenarioMM(browser) {
  log("MetaMask path (self paid), wallet starts on chain 8217");
  const rec = [];
  const { ctx, page, errs } = await newPage(browser, { kind: "mm", chainId: 8217 }, rec);
  const new0 = await bal(NEW), lots0 = await lotCount(SWAP);
  await page.goto(SITE + "/migrate/?lang=en");
  const notice = await page.textContent("#mg-net");
  assert(/Kairos testnet/.test(notice), "testnet notice shown");
  await connect(page, "mm");
  await view(page, "wrong-network", 30000);
  await page.click('#mg-panel [data-act="network"]');
  const lead = await swapFlow(page, 3, { rejectFirst: true });
  log("  success:", lead);
  const new1 = await bal(NEW), lots1 = await lotCount(SWAP);
  assert.strictEqual(new1 - new0, ethers.parseUnits("0.3", 18), "10% of 3 old CT arrived");
  assert.strictEqual(lots1, lots0 + 1, "one new lot");
  const lot = await lotOf(SWAP, lots1 - 1);
  assert.strictEqual(lot[0], ethers.parseUnits("2.7", 18), "lot holds the 90%");
  await page.click('#mg-panel [data-act="done"]');
  const hist = await page.$$eval("#mg-hist .mg-lot", (els) => els.length);
  assert(hist >= lots1, "history lists every lot (" + hist + ")");
  const links = await page.$$eval("#mg-hist a.mg-tx", (els) => els.map((a) => a.href));
  assert(links.every((h) => h.startsWith("https://kairos.kaiascan.io/tx/0x")), "history links go to Kairos Kaiascan");
  log("  10% arrived (0.3 new CT), lot", lots1 - 1, "holds 2.7, history", hist, "lots");
  // Reload: the remembered, already authorised wallet reconnects without a prompt.
  await page.reload();
  await page.waitForSelector('#mg-panel .mg-view[data-view="form"]', { timeout: 30000 });
  assert(/0x6Fd4/i.test(await page.textContent("#cj-wallet")), "header shows the reconnected wallet");
  log("  reload: reconnected silently, header shows", (await page.textContent("#cj-wallet")).trim());
  rec.filter((r) => r.hash).forEach((r) => log("  tx", r.selector === "0x095ea7b3" ? "approve" : "migrate", r.hash));
  assert(!errs.length, "no page errors: " + errs.join(" | "));
  await ctx.close();
  return rec;
}

async function txInfo(hash) {
  const t = await rp.send("klay_getTransactionByHash", [hash]);
  return { type: t.type, typeInt: t.typeInt, feePayer: t.feePayer, from: t.from };
}

async function scenarioKaia(browser, gasLines) {
  log("Kaia Wallet path (fee delegated through the local gas server)");
  const rec = [];
  const { ctx, page, errs } = await newPage(browser, { kind: "kaia", chainId: 1001 }, rec);
  const new0 = await bal(NEW), lots0 = await lotCount(SWAP);
  await page.goto(SITE + "/migrate/?lang=ko&gasapi=http://localhost:" + GAS_MAIN);
  await connect(page, "kaia");
  const fee = await (await view(page, "form", 30000)).evaluate(() => document.querySelector("#mg-feerow").textContent);
  log("  fee row:", fee.trim());
  const lead = await swapFlow(page, 2);
  log("  success (ko):", lead);
  assert.strictEqual((await bal(NEW)) - new0, ethers.parseUnits("0.2", 18), "10% of 2 old CT arrived");
  assert.strictEqual(await lotCount(SWAP), lots0 + 1, "one new lot");
  const hashes = gasLines.map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter((o) => o && o.txHash).map((o) => o.txHash);
  const sent = [...new Set(hashes)];
  for (const h of sent.slice(-2)) {
    const t = await txInfo(h);
    log("  tx", h, t.type, "feePayer", t.feePayer);
    assert.strictEqual(t.typeInt, 49, "fee delegated type 0x31");
    assert.strictEqual(t.feePayer.toLowerCase(), ADDR.toLowerCase(), "fee payer is the gas wallet");
  }
  assert(rec.filter((r) => r.method === "klay_signTransaction" && r.type === "0x31").length >= 2, "wallet signed two 0x31 transactions");
  assert(!errs.length, "no page errors: " + errs.join(" | "));
  await ctx.close();
  return sent;
}

async function scenarioClaim(browser, gasLines) {
  log("Claim path on the 1 minute lock contract (fee delegated)");
  const rec = [];
  const { ctx, page, errs } = await newPage(browser, { kind: "kaia", chainId: 1001 }, rec, { swap: SHORT, block: SHORT_BLOCK });
  await page.goto(SITE + "/migrate/?lang=en&gasapi=http://localhost:" + GAS_SHORT);
  await connect(page, "kaia");
  // Release anything already matured first, so this run claims only its own lot.
  const ready = await page.waitForSelector('#mg-panel .mg-view[data-view="form"], #mg-panel .mg-view[data-view="claim"]', { timeout: 30000 });
  if ((await ready.getAttribute("data-view")) === "claim") {
    await page.click('#mg-panel [data-act="claim"]');
    await view(page, "claimed");
    await page.click('#mg-panel [data-act="done"]');
  }
  await swapFlow(page, 2);
  const lots = await lotCount(SHORT), next0 = await nextClaim(SHORT);
  log("  lot", lots - 1, "locked for 1 minute; waiting for the unlock");
  const [, unlock] = await lotOf(SHORT, lots - 1);
  await page.click('#mg-panel [data-act="done"]');
  while (Math.floor(Date.now() / 1000) < Number(unlock) + 5) await sleep(2000);
  await page.reload();
  const v = await page.waitForSelector('#mg-panel .mg-view[data-view="claim"], #mg-panel .mg-view[data-view="form"]', { timeout: 30000 });
  if ((await v.getAttribute("data-view")) !== "claim") {
    log("  the lot was already released by a keeper before the page could claim it");
  } else {
    const new0 = await bal(NEW);
    await page.click('#mg-panel [data-act="claim"]');
    await view(page, "claimed");
    const got = (await bal(NEW)) - new0;
    log("  claimed:", (await page.textContent("#mg-panel .mg-lead")).trim(), "(+", ethers.formatUnits(got, 18), "new CT)");
    assert.strictEqual(got, ethers.parseUnits("1.8", 18), "the 90% arrived");
  }
  assert(await nextClaim(SHORT) > next0, "cursor moved: the lot is released");
  const hashes = [...new Set(gasLines.map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter((o) => o && o.txHash).map((o) => o.txHash))];
  hashes.forEach((h) => log("  sponsored tx", h));
  assert(!errs.length, "no page errors: " + errs.join(" | "));
  await ctx.close();
  return hashes;
}

// Error mapping, and the "pay the fee yourself" fallback with Kaia Wallet (TxTypeSmartContractExecution, 0x30).
async function scenarioErrors(browser) {
  log("Error states and the Kaia Wallet self paid fallback (gas server unreachable)");
  const rec = [];
  const { ctx, page, errs } = await newPage(browser, { kind: "kaia", chainId: 1001 }, rec);
  await page.goto(SITE + "/migrate/?lang=en&gasapi=http://localhost:8799");
  await connect(page, "kaia");
  await view(page, "form", 30000);
  // The contract refuses a swap above the reserve before any wallet prompt: InsufficientReserve -> reserve state.
  const big = await page.evaluate(() => CJ.chain.write("migrate", { amount: 10n ** 27n }, { sponsored: true }).then(() => "sent", (e) => CJ.chain.classify(e)));
  assert.strictEqual(big, "reserve", "InsufficientReserve maps to the reserve state");
  const none = await page.evaluate(() => CJ.chain.write("claim", { maxLots: 1 }, { sponsored: true }).then(() => "sent", (e) => CJ.chain.classify(e)));
  assert.strictEqual(none, "nothing", "NothingToClaim maps to already released");
  log("  InsufficientReserve -> reserve, NothingToClaim -> nothing");
  await page.fill("#mg-amt", "1.5");
  await page.click("#mg-go");
  await page.click('#mg-confirm [data-cf="go"]');
  await view(page, "approve", 20000);
  await page.click('#mg-panel [data-act="approve"]');
  await page.waitForSelector('#mg-panel [data-act="pay-own"]', { timeout: 60000 });
  log("  fee payer unreachable shows:", (await page.textContent("#mg-panel .note-error .mg-hh span")).trim());
  await page.click('#mg-panel [data-act="pay-own"]');
  await page.click('#mg-panel [data-act="approve"]');
  await view(page, "swap");
  await page.click('#mg-panel [data-act="swap"]');
  await view(page, "locked");
  const sent = rec.filter((r) => r.method === "klay_sendTransaction");
  assert.strictEqual(sent.length, 2, "approve and swap sent by the wallet itself");
  sent.forEach((r) => log("  self paid tx", r.hash));
  for (const r of sent) assert.strictEqual((await txInfo(r.hash)).typeInt, 48, "type 0x30");
  const real = errs.filter((e) => !/ERR_CONNECTION_REFUSED/.test(e)); // the unreachable gas server, on purpose
  assert(!real.length, "no page errors: " + real.join(" | "));
  await ctx.close();
}

(async () => {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : ["mm", "kaia", "errors", "claim"];
  log("wallet", ADDR, "KAIA", ethers.formatUnits(await rp.getBalance(ADDR), 18), "old CT", ethers.formatUnits(await bal(OLD), 18));
  await startSite();
  const browser = await chromium.launch();
  let ok = true;
  try {
    if (want.includes("mm")) await scenarioMM(browser);
    if (want.includes("kaia")) await scenarioKaia(browser, await startGas(GAS_MAIN, SWAP, DEP.migrationDeployBlock));
    if (want.includes("errors")) await scenarioErrors(browser);
    if (want.includes("claim")) await scenarioClaim(browser, await startGas(GAS_SHORT, SHORT, SHORT_BLOCK));
    log("PASS");
  } catch (e) {
    ok = false; console.error("[e2e] FAIL", e && e.message ? e.message : e);
  } finally {
    await browser.close();
    kids.forEach((k) => { try { k.kill(); } catch (e) {} });
  }
  process.exit(ok ? 0 : 1);
})();
