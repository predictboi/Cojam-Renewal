# Cojam Daily Prediction: phase 0 spike

A minimal installable PWA that proves the signing and gas sponsorship path of `docs/platform/DEV-PLAN.md` section 1.4 on Kaia's Kairos testnet (chain 1001) with a Privy embedded wallet. Testnet only: nothing here touches mainnet, `site/`, `server/` or `render.yaml`.

| Folder | What it is |
| --- | --- |
| `contract/` | `SpikePredict.sol` (play key, predict, soulbound ERC-20 shaped point stub "CJPX"), compile, deploy and Sourcify scripts |
| `api/` | Spike fee payer for Kairos: `POST /sponsor`, `GET /health`. Decoding, co-signing and the pipeline are copied from `server/src/` |
| `web/` | Vite + React + TypeScript PWA: one screen, steps a to g, copy report |
| `e2e-result.kairos.json` | Node end to end run on Kairos (steps c to f, local key in place of Privy) |
| `browser-check.result.json`, `browser-check.report.json` | Headless Chromium run of the built PWA in `?devkey=1` mode, and the report it copied |

## 1. What the spike proves, and what only a phone can prove

**Proven here (2026-11-26), on Kairos, with a locally generated key standing in for the Privy wallet:**

* The PWA builds a 0x31 `TxTypeFeeDelegatedSmartContractExecution`, computes the Kaia SigHash, takes a plain 65 byte secp256k1 signature over that hash, converts `v` (27/28 or 0/1) to `chainId * 2 + 35 + yParity` (2037 or 2038 on Kairos), assembles `senderTxHashRLP`, and the fee payer decodes it, recovers the right sender, co-signs and broadcasts. The assembled bytes are identical to what `@kaiachain/ethers-ext` `Wallet.signTransaction` produces for the same fields (unit test).
* `setPlayKey` signed by the "player" wallet, which never held KAIA, is sponsored and mined.
* The play key (an account that never held KAIA) sends 5 `predict` transactions with nonces 0 to 4 back to back, without waiting for receipts. All 5 were mined in nonce order within about 1.4 s after the last was sent, and the contract credited the player, not the key (player 5 points, key 0).
* A duplicate predict is refused by simulation before broadcast (`ALREADY_DONE`), so it costs no gas.
* A direct `predict` signed by the player wallet is sponsored and mined.
* A user paid plain transfer from the player wallet (type 2 transaction, KAIA paid by the sender) is mined.
* `CJPX` transfers revert with `Soulbound()`. Kaiascan lists the contract as an ERC-20 token "Cojam Points Spike (CJPX)" with holders, total supply and transfers, and the holder's Token Balance tab shows the balance (for example "6.0 CJPX").
* The built PWA is installable in Chromium: manifest parsed without errors, service worker active and controlling, no installability errors, all icons served; it loads with no console warnings or errors, Privy initialises with the app id on `localhost`, and its email login window opens (email only).
* The play key is stored in IndexedDB (AES-GCM wrapped) and is found again after a reload.

**Only a real phone can prove** (spike items 1, 4, 5, 6, 7 with Privy, 9): that Privy's `secp256k1_sign` runs with no prompt inside the installed PWA on iOS Safari and Android Chrome, the format Privy returns, its latency, email login inside the installed app (leaving for Mail, coming back, a reload), whether the session and the play key survive closing the app and days without use, and Privy's `eth_sendTransaction` on Kairos.

## 2. Kairos addresses and transactions

| What | Value |
| --- | --- |
| SpikePredict | [`0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58`](https://kairos.kaiascan.io/address/0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58), Sourcify exact match |
| Deploy tx | [`0x952726923d02a7a6cde86b1bc54c698161ba8aec64d2db708721957649306d73`](https://kairos.kaiascan.io/tx/0x952726923d02a7a6cde86b1bc54c698161ba8aec64d2db708721957649306d73), block 234064610 |
| Deployer and local fee payer | `0x6Fd4d26d4C1ECc8B9692eD5852f26BF1f16DF5b1` (the Kairos test key of `contracts/.env`) |

Node end to end run (`web/test/e2e-kairos.ts`, player `0xb448d21f71785DC8319f769AAfc4F69EA4Aa1BBf`, play key `0xd06Ebd0182F790e1679AbbB4dc656e161dFcc7cC`):

| Step | Tx | Notes |
| --- | --- | --- |
| c setPlayKey (player signed, sponsored) | [`0xf993444ecea32288e6fc5d06bcb5af0a6be3b1099473a34e155673bf3dc34e3e`](https://kairos.kaiascan.io/tx/0xf993444ecea32288e6fc5d06bcb5af0a6be3b1099473a34e155673bf3dc34e3e) | gas 81,614; v 28 to 2038 |
| d predict, key nonce 0 | [`0xbb0ac2ce0fec20243cf47ee108e40e707ad4315c6159a766e4e154d324a2c841`](https://kairos.kaiascan.io/tx/0xbb0ac2ce0fec20243cf47ee108e40e707ad4315c6159a766e4e154d324a2c841) | block 234065184; gas 129,535 (the player's first prediction) |
| d predict, nonce 1 | [`0xa4125878999971c5a6afab974b0c02daf463a7196a9e5ffa267629571f5f18dd`](https://kairos.kaiascan.io/tx/0xa4125878999971c5a6afab974b0c02daf463a7196a9e5ffa267629571f5f18dd) | block 234065185; gas 78,267 |
| d predict, nonce 2 | [`0x7bc05b683f397eefe0cc536739d3f6ddd11e9848608556e756384902c2066569`](https://kairos.kaiascan.io/tx/0x7bc05b683f397eefe0cc536739d3f6ddd11e9848608556e756384902c2066569) | block 234065186 |
| d predict, nonce 3 | [`0xd3ee26d0c728f4fc9c1a01a8d39f31c8e408a24470a86ecb0ee0d5aeb327f857`](https://kairos.kaiascan.io/tx/0xd3ee26d0c728f4fc9c1a01a8d39f31c8e408a24470a86ecb0ee0d5aeb327f857) | block 234065186 |
| d predict, nonce 4 | [`0x078d01d092cb4a95d482d804dd4e00df8dce3d1700b558844284dfaa1b05215a`](https://kairos.kaiascan.io/tx/0x078d01d092cb4a95d482d804dd4e00df8dce3d1700b558844284dfaa1b05215a) | block 234065187; all 5 in nonce order, sent in 3.1 s, all mined 4.5 s after the first sign |
| e direct predict (player signed) | [`0x63213d26ff64a88d11a68fc1539d5ce8e18c4bd9edf30e44512606a1b7590fcc`](https://kairos.kaiascan.io/tx/0x63213d26ff64a88d11a68fc1539d5ce8e18c4bd9edf30e44512606a1b7590fcc) | gas 75,981 |
| f funding of the player (0.01 test KAIA) | [`0xb8c9f31601795e788039762574ec2e4ca4e81971cac96edb58e7851d4512c315`](https://kairos.kaiascan.io/tx/0xb8c9f31601795e788039762574ec2e4ca4e81971cac96edb58e7851d4512c315) | |
| f user paid transfer (type 2) | [`0x67cedb63bda8f8c4a452ec9ed0ddf4ff2ee4988e0dfa0b6c8c3f76cf4da08000`](https://kairos.kaiascan.io/tx/0x67cedb63bda8f8c4a452ec9ed0ddf4ff2ee4988e0dfa0b6c8c3f76cf4da08000) | |

Headless Chromium run of the built PWA (`?devkey=1`, player `0x1f8cF2562Ed7be99BBFd2F0C4A9eA93020b5d928`, play key `0x05C2a6c94C2498E4c7cD326e90841a07611801e8`): c [`0xf53ad6be…2179c`](https://kairos.kaiascan.io/tx/0xf53ad6be05cac9b6f57fec35c33b2a84534bfb02507acf5cd0fc0cda37e2179c); d [`0x96190a86…12882`](https://kairos.kaiascan.io/tx/0x96190a86bfc66e04e43160e4be991975dcbb7f5364701a66c8e36130dbe12882), [`0xdf5fd1b6…f65e0`](https://kairos.kaiascan.io/tx/0xdf5fd1b68388e521c2884fd959e59c0a3905409bd3c0e77d8debeac8dbdf65e0), [`0x6d6ad91d…373b1`](https://kairos.kaiascan.io/tx/0x6d6ad91d5a8a74caf35ae6fc95ddb6eac429ab47ad875063c71fc1f60f4373b1), [`0x7cd84f96…714bc`](https://kairos.kaiascan.io/tx/0x7cd84f960f7081f5150cb79f9f3e5ee3d7adda81e6f9916254ac0650ed7714bc), [`0x765133de…f5dec`](https://kairos.kaiascan.io/tx/0x765133def9b23e89669d8441c5122f2675f72b8ea4403c0d27697191170f5dec); e [`0x5e878f40…6ca2`](https://kairos.kaiascan.io/tx/0x5e878f40aac3616af7ca80cb5d624c6618e58408d9d4efb08ad5929e3e506ca2); f [`0xf3a40fc0…fb935`](https://kairos.kaiascan.io/tx/0xf3a40fc03218a8d02d01928a3af8a1d43b02c059c2b549eeabe73eda320fb935). Full hashes and timings are in `browser-check.report.json`.

Measured timings (container to the public Kairos node, so the phone numbers will differ): local key signing 0.5 to 5 ms; `/sponsor` answer 560 to 650 ms (three public RPC round trips: balance, `eth_estimateGas`, `kaia_sendRawTransaction`); mined 0.8 to 2 s after the answer.

## 3. How the signing works (and the Privy calls)

`web/src/lib/kaiaTx.ts`:

1. `KlaytnTxFactory.fromObject({ type: 0x31, chainId, nonce, gasPrice, gasLimit, to, value: 0, from, data })` from `@kaiachain/js-ext-core` (the core library `@kaiachain/ethers-ext` is built on, the same one `server/` decodes with).
2. `sigHash = keccak256(tx.sigRLP())`.
3. The signer signs `sigHash`:
   * Privy: `const provider = await wallet.getEthereumProvider(); await provider.request({ method: 'secp256k1_sign', params: [sigHash] })` where `wallet` is the `useWallets()` entry with `walletClientType === 'privy'`.
   * Play key and dev key: `ethersWallet.signingKey.sign(sigHash).serialized`.
4. `toKaiaSignature`: accepts 65 bytes with `v` 27/28 or 0/1, or 64 byte compact; checks that it recovers to the wallet address; sets `v = chainId * 2 + 35 + yParity`.
5. `tx.addSenderSig([v, r, s])`, `raw = tx.senderTxHashRLP()`, `POST /sponsor { rawTransaction: raw }`.

Why not `@kaiachain/ethers-ext` directly: its signers need a private key or a Kaia aware injected wallet (`klay_signTransaction`); a Privy embedded wallet only exposes a hash signing method, so the transaction object is assembled by hand around it. The unit test shows the result is byte identical to `ethers-ext`.

Confirmation UI:

* `PrivyProvider config.embeddedWallets.showWalletUIs: false` (overrides the Dashboard setting) and, per call, `uiOptions: { showWalletUIs: false }` on `sendTransaction` (step f). Privy documents this switch for `signMessage`, `signTransaction`, `signTypedData` and `sendTransaction` [3].
* `secp256k1_sign` has no UI option at all. In `@privy-io/react-auth` 3.51.4 the embedded EIP-1193 provider routes `secp256k1_sign` straight to the wallet (`walletProxy.rpc`, or the wallet API for server wallets) and never through the UI handlers that `personal_sign`, `eth_signTypedData_v4` and `eth_signTransaction` use (read in `node_modules/@privy-io/react-auth/dist/esm/index-*.mjs`). So no prompt is expected; the phone test confirms it.
* Any failure inside that call is logged by Privy with `console.error` and rethrown as a generic `Disconnected` (code 4900). The PWA therefore captures console errors on screen and in the report.

## 4. Running it locally

```bash
# contract (already deployed; only to redeploy or verify)
cd platform/spike/contract && npm install && node deploy.js && node verify-sourcify.js

# fee payer with the Kairos test key of contracts/.env (read from the file, never printed)
cd platform/spike/api && npm install && npm test
node scripts/local-with-test-key.js            # http://localhost:8787
# or, with your own values: cp .env.example .env, fill it, then npm run dev

# web
cd platform/spike/web && npm install && npm test
FUND_FROM_CONTRACTS_ENV=1 node test/e2e-kairos.ts            # steps c to f on Kairos, writes ../e2e-result.kairos.json
npm run build && npm run preview                               # http://localhost:4173
NODE_PATH=$(npm root -g) FUND_FROM_CONTRACTS_ENV=1 node test/browser-check.cjs   # headless check, writes ../browser-check.*.json
```

`?devkey=1` (localhost only) replaces the Privy wallet with a throwaway local key so steps c to f run without an email code. `?api=http://localhost:PORT` (localhost only) points at another fee payer.

## 5. Founder steps

### (i) Privy Dashboard

1. **Login methods**: email on; every other method off (wallets, SMS, social, passkey) [4].
2. **Allowed origins / domains** (App settings, Domains): add the spike's static site URL from step (ii), for example `https://cojam-spike-web.onrender.com`. Keep `http://localhost:5173` and `http://localhost:4173` for local work if you use allowed origins at all [7].
3. **Embedded wallets** (Wallets, Embedded wallets): EVM wallet creation "Create on login" for users without wallets. Note: Privy creates the wallet automatically only for logins through the Privy window; the spike's own email form (headless `useLoginWithEmail`) calls `useCreateWallet().createWallet()` itself after login, so the setting is not critical [5].
4. **Confirmation modals** (Configuration, Authentication, Advanced): turn on "Disable confirmation modals" [3]. The app also sets `showWalletUIs: false` in code.
5. **Kairos**: no Dashboard step. The chain is configured in code (`supportedChains` and `defaultChain` with viem's `kairos`, chain 1001, RPC `https://public-en-kairos.node.kaia.io`) [6].
6. **Ask Privy in writing** (spike item 6): "Does a client side `secp256k1_sign` request from a React embedded wallet count as a billed signature? Does an email login (code sent and verified) count as one?"

The Privy App Secret is not used by the spike.

### (ii) Hosting for the phone test on Render (without touching `render.yaml`)

Create two services by hand in the Render Dashboard (New, from this repository and branch). Do not add them to `render.yaml`.

**Web service `cojam-spike-api`** (Node):

| Setting | Value |
| --- | --- |
| Root directory | `platform/spike/api` |
| Build command | `npm ci` |
| Start command | `node index.js` |
| Health check path | `/health` |
| Environment | `FEE_PAYER_PRIVATE_KEY` (a **testnet only** key holding a few test KAIA, typed into Render only, never into chat), `SPIKE_CONTRACT_ADDRESS=0x5064CD6b484d3A1B9a2f3A27c364370ffAa39f58`, `ALLOWED_ORIGINS=https://<the static site URL>`. Optional: `KAIA_RPC_URL`, `MAX_GAS_PRICE_GKEI` (50), `MAX_GAS_LIMIT` (250000), `SENDER_DAILY_TX_LIMIT` (60), `SENDER_PER_MINUTE_LIMIT` (20), `IP_DAILY_TX_LIMIT` (300), `DAILY_BUDGET_KAIA` (5), `MIN_FEE_PAYER_BALANCE_KAIA` (0.5) |

Fund the fee payer address shown by `GET /health` from the Kairos faucet (`https://www.kaia.io/faucet`). It refuses to start on any chain other than 1001.

**Static site `cojam-spike-web`**:

| Setting | Value |
| --- | --- |
| Root directory | `platform/spike/web` |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Environment | `VITE_SPONSOR_API=https://<the api service URL>`; optional `VITE_RELEASE=spike-1` |
| Redirects and rewrites | Rewrite `/*` to `/index.html` |
| Headers | `/sw.js`: `Cache-Control: no-cache` |

Create the API first, then the static site with the API URL, then set the API's `ALLOWED_ORIGINS` to the static site URL and add that URL to Privy's allowed origins.

### (iii) Phone test script

Run the same script on an iPhone (iOS 17 or later) and an Android phone (Chrome). Get a few test KAIA for step f: copy the wallet address shown in step f and send test KAIA to it from the faucet. Before each step, answer the "Did a Privy window or prompt appear?" question right after the step.

**Part 1: browser tab** (Safari on iPhone, Chrome on Android)

1. Open the static site URL. Step a shows "browser tab".
2. b: type your email, "Send code", open Mail, copy the code, return, "Log in with code". Note whether the code field offered the code (autofill) and the code length.
3. "Copy report" and send it.

**Part 2: installed app**

1. iPhone: Share, Add to Home Screen. Android: menu, Install app (or the install banner). Open it from the home screen. Step a must show "installed app".
2. a: press "Check again and request persistent storage".
3. b: log in again with email (iPhone keeps a separate login for home screen apps). While waiting for the code, leave the app for Mail, then come back. Once, close the app completely after "Send code" and reopen it before typing the code: note whether the code still works.
4. c: "Authorise play key". Then "Measure 5 raw signatures".
5. d: "Send 5 predicts".
6. e: "Predict directly".
7. f: "Send 0.001 KAIA" (first without test KAIA to see the "no KAIA" message, then after funding).
8. "Copy report", send it.
9. Close the app completely (swipe it away). Reopen it. Check that b shows "Session on this launch: restored" and d shows "On launch: found". Run c2 and d again. "Copy report", send it.
10. The next day, and again after 7 days without opening it: open the app, run c2, d and e, "Copy report", send it.

**Send back**: each copied JSON report (they contain addresses, hashes, timings and errors, no keys); for each step whether a Privy window or prompt appeared (also recorded in the report); a short screen recording of steps b to e on each phone if possible; Privy's written answer to item 6.

**Optional limits for item 5**: request a code and wait 10, 20 and 30 minutes before using it to find the lifetime; enter a wrong code 5 times (Privy's SDK documents a maximum of 5 attempts per code); press "Send code" several times in a row to see the resend limit.

## 6. Spike items of DEV-PLAN 1.4

| # | Item | Covered by | Status |
| --- | --- | --- | --- |
| 1 | `secp256k1_sign` with no modal in the installed PWA on iOS and Android, after login and after a cold restart a day later | c, c2, e with the prompt answer; Part 2 steps 4, 9, 10 | Phone. SDK source shows no UI path for this method |
| 2 | `v` conversion and fee payer decoding recovers the Privy wallet | c result: `signatureReturned`, `vReturned`, `conversion` | Proven for 27/28, 0/1 and 64 byte inputs locally; Privy's actual format on the phone |
| 3 | `setPlayKey` by the Privy wallet mined; 5 play key predicts with nonces 0 to 4, mined in order, credited to the player | c, d (`inNonceOrder`, `creditedToPlayerNotKey`) | Proven with the stand in key; repeat with Privy on the phone |
| 4 | Latency: play key signing under 50 ms p95, `secp256k1_sign` under 1.5 s p95 | d `signMs`, c2 samples, c and e `signMs` | Local key 0.5 to 5 ms; Privy on the phone |
| 5 | Email login in the installed PWA, code delivered, `one-time-code` autofill, leaving for Mail and a reload, code length, lifetime and limits | b; Part 2 steps 3, 9; optional limits | Phone |
| 6 | Privy's written answer on billing | Founder asks Privy (5 i, point 6) | Open |
| 7 | User paid transfer through Privy `eth_sendTransaction` on Kaia | f | Kairos accepts the user paid type 2 transfer (stand in); Privy path on the phone |
| 8 | Kaiascan shows the soulbound point balance as a token holding | SpikePredict on Kaiascan | Proven: token page "Cojam Points Spike (CJPX)", ERC-20, holders and supply; holder Token Balance tab shows the balance |
| 9 | Play key survives in IndexedDB across a cold restart and 7 days; `navigator.storage.persist()` result | a (`storagePersistRequest`), d "On launch: found", report `launch.playKeyOnLaunch` | Reload proven in Chromium; phone for restart and 7 days |
| 10 | Direct path: a predict signed by the Privy wallet is co-signed and mined | e | Proven with the stand in; Privy on the phone |

## 7. Findings that matter for the plan

1. **Headless email login does not create the embedded wallet.** Privy's automatic creation applies only to the Privy login window, not to whitelabel login methods [5]. The A1 flow must call `useCreateWallet().createWallet()` after `loginWithCode` when the user has no embedded wallet (the spike does, after a short wait, and records which path happened).
2. **`secp256k1_sign` has no confirmation UI path** in the current SDK, and the documented `showWalletUIs` switch does not list it [3]. Its errors arrive as a generic `Disconnected` (4900) with the real cause only in `console.error`: the production PWA needs its own error capture for this call.
3. **Bundling**: `@privy-io/react-auth` imports optional Solana packages; Vite fails unless they are installed or Rollup's `shimMissingExports` is on (used here). The main chunk is about 670 kB gzip, mostly Privy and WalletConnect code that email only login never uses: worth trimming in phase 3.
4. **Gas**: `setPlayKey` 81,614 and a player's first `predict` 129,535 (four new storage slots), later predicts about 76,000 to 78,000. The spike contract is simpler than `CojamPredict`, so the phase 1 gas table still needs its own measurement, but the first predict of a player costs well above the 74,000 estimated in 4.9.
5. **Fee payer latency** on the public Kairos node was about 560 ms per request (three RPC round trips), above the plan's "under 500 ms": a dedicated RPC provider (already planned in 4.8) or skipping the balance read per request brings it down.

## 8. Notes and limits

* The spike contract has no market close, no completion reward and no freezing; it only exercises the play key binding, the player resolution, one choice per player and market, and the soulbound ledger.
* The fee payer keeps limits in memory; restart resets them. Policy: only SpikePredict, only `setPlayKey` (key not zero, not the sender, expiry within 90 days) and `predict` (choice 1 or 2), value 0, gas limit at most 250,000, gas price at most 50 gkei, simulation before signing, per sender 20 per minute and 60 per UTC day, per network 300 per day, daily budget 5 KAIA, balance floor 0.5 KAIA, CORS to `ALLOWED_ORIGINS` only.
* No strict Content Security Policy in the spike (Privy needs its iframe origins); the production PWA adds one (DEV-PLAN 4.1).
* `@privy-io/react-auth` is pinned to 3.51.4 (released 2026-11-12).

## 9. Sources

1. Privy, Sign a raw hash (`secp256k1_sign` through `wallet.getEthereumProvider()`): https://docs.privy.io/wallets/using-wallets/ethereum/sign-a-raw-hash
2. Privy API reference, secp256k1 sign: https://docs.privy.io/api-reference/wallets/ethereum/secp256k1-sign
3. Privy, Manage wallet UIs (Dashboard "Disable confirmation modals", `embeddedWallets.showWalletUIs`, per call `uiOptions.showWalletUIs`, methods covered): https://docs.privy.io/recipes/react/manage-wallet-UIs
4. Privy, Email login (`useLoginWithEmail`: `sendCode`, `loginWithCode`, `state`; enable email in the Dashboard): https://docs.privy.io/authentication/user-authentication/login-methods/email
5. Privy, Automatic wallet creation (`embeddedWallets.ethereum.createOnLogin`; not for whitelabel login methods): https://docs.privy.io/basics/react/advanced/automatic-wallet-creation
6. Privy, Configuring EVM networks (`defineChain`, `supportedChains`, `defaultChain`): https://docs.privy.io/basics/react/advanced/configuring-evm-networks
7. Privy, Allowed domains: https://docs.privy.io/recipes/dashboard/allowed-domains
8. Privy, Chain support: https://docs.privy.io/wallets/overview/chains
9. Kaia docs, Fee delegation (SigRLP, SenderTxHashRLP, signature `v`): https://docs.kaia.io/build/transactions/fee-delegation/
10. In repository: `server/src/policy.js`, `server/src/feePayer.js`, `docs/FEE-DELEGATION.md`, `docs/platform/DEV-PLAN.md` sections 1.1 to 1.4, 4 and 9.4.
