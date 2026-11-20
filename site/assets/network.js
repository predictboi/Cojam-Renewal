// Which chain the live site talks to, and every on chain address it uses. Load after system.js.
// Switch to mainnet at launch by setting ACTIVE to "kaia" and filling newToken, swap and deployBlock from
// contracts/deployments/kaia.json. Everything that reads or writes the chain takes its values from CJ.net.
(function () {
  var ACTIVE = "kaia"; // live on Kaia mainnet since the launch swap deploy (contracts/deployments/kaia.json)
  var NETS = {
    kairos: {
      key: "kairos", chainId: 1001, chainHex: "0x3e9", name: "Kaia Kairos Testnet", testnet: true,
      rpc: "https://public-en-kairos.node.kaia.io",
      explorer: "https://kairos.kaiascan.io",
      // contracts/deployments/kairos.json (old CT here is the test stand in MockOldCojam)
      oldToken: "0x6E86699DE0182884E5ee627E43764c718832D5e8",
      newToken: "0xa8e540C5b5804D4BF2Dd2110a307a99E76C6Bd9E",
      swap: "0x4948D9DFaafC8CC0ee6464208659350F11931252",
      deployBlock: 233013908,
      gasApi: "https://api.cojam.app",
      master: "0x6Fd4d26d4C1ECc8B9692eD5852f26BF1f16DF5b1", // Kairos rehearsal master (throwaway test wallet)
      nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 }
    },
    kaia: {
      key: "kaia", chainId: 8217, chainHex: "0x2019", name: "Kaia Mainnet", testnet: false,
      rpc: "https://public-en.node.kaia.io",
      explorer: "https://kaiascan.io",
      oldToken: "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b",
      newToken: "0x91cb3B346C80ff965a9667ba6228834dbedD71a2", // live since 2026-11-14 (contracts/deployments/kaia.json)
      swap: "0x7879F0a137Eae8E45EB670e9ac7BB08C5DfADb84", // launch swap, 7 day lock, rate 1/5 (redeployed 2026-11-15)
      deployBlock: 232552030, // launch swap deploy block (tx 0x0085c193…9f6a)
      gasApi: "https://api.cojam.app",
      master: "0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb", // the only wallet that can open the admin page and withdraw
      nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 }
    }
  };
  // Private mainnet test (founder only, not linked anywhere): the real swap code with a 1 minute lock, deployed by the
  // deployer with OPS_TASK=deploy-test-swap, against the live new CT. Opened with ?net=kaia-test. No fee delegation here
  // (the gas API serves Kairos), so the test wallet pays its own small KAIA fee.
  NETS["kaia-test"] = Object.assign({}, NETS.kaia, {
    key: "kaia-test", mainnetTest: true,
    swap: "0x197e08ba085Ee1171AfD2fd7263cF14Db403FBbD",
    deployBlock: 232473494, // the new CT deploy block, just before the test swap
    gasApi: null
  });
  // WalletConnect (Reown) project, allowlisted for https://cojam.app. Public value, not a secret.
  var WC_PROJECT_ID = "a7f7f3dd4438032e51b2202fd5966b5c";
  Object.keys(NETS).forEach(function (k) { NETS[k].wcProjectId = WC_PROJECT_ID; });
  var CJ = window.CJ || (window.CJ = {});
  // ?net=kaia-test is remembered in this browser, so a wallet reopening the page, a language switch or a link inside the
  // site keeps the test. ?net=kairos (or ?net=default) forgets it and returns to the normal network.
  var q = new URLSearchParams(location.search).get("net"), kept = null;
  try {
    if (q === "kairos" || q === "default") localStorage.removeItem("cj.net");
    else if (q && NETS[q]) localStorage.setItem("cj.net", q);
    kept = localStorage.getItem("cj.net");
  } catch (e) {}
  if (q && NETS[q]) ACTIVE = q;
  else if (q !== "kairos" && q !== "default" && kept && NETS[kept]) ACTIVE = kept;
  var net = NETS[ACTIVE];
  CJ.net = net;
  // True when this browser last connected the master wallet (set by chain.js): only then is the Admin link shown.
  CJ.masterOn = function () {
    try { var a = localStorage.getItem("cj.master"); return !!(a && net.master && a.toLowerCase() === net.master.toLowerCase()); } catch (e) { return false; }
  };
  // Every page shows the active network's addresses (landing contracts list, footers), not only the live scripts.
  if (CJ.config) {
    if (CJ.config.oldToken) CJ.config.oldToken.address = net.oldToken;
    if (CJ.config.newToken) CJ.config.newToken.address = net.newToken;
    if (CJ.config.swapContract) CJ.config.swapContract.address = net.swap;
  }
  CJ.nets = NETS;
  // Live means the active network has a deployed swap. ?mock=1 or a ?state= preset keeps the mock ledger for design review.
  var p = new URLSearchParams(location.search);
  CJ.live = !!(net.swap && net.newToken) && p.get("mock") !== "1" && !p.get("state");
})();
