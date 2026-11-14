// Which chain the live site talks to, and every on chain address it uses. Load after system.js.
// Switch to mainnet at launch by setting ACTIVE to "kaia" and filling newToken, swap and deployBlock from
// contracts/deployments/kaia.json. Everything that reads or writes the chain takes its values from CJ.net.
(function () {
  var ACTIVE = "kairos";
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
      nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 }
    },
    kaia: {
      key: "kaia", chainId: 8217, chainHex: "0x2019", name: "Kaia Mainnet", testnet: false,
      rpc: "https://public-en.node.kaia.io",
      explorer: "https://kaiascan.io",
      oldToken: "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b",
      newToken: null, // set at launch
      swap: null, // set at launch
      deployBlock: null, // set at launch
      gasApi: "https://api.cojam.app",
      nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 }
    }
  };
  var CJ = window.CJ || (window.CJ = {});
  var net = NETS[ACTIVE];
  CJ.net = net;
  CJ.nets = NETS;
  // Live means the active network has a deployed swap. ?mock=1 or a ?state= preset keeps the mock ledger for design review.
  var p = new URLSearchParams(location.search);
  CJ.live = !!(net.swap && net.newToken) && p.get("mock") !== "1" && !p.get("state");
})();
