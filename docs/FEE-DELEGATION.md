# Gasless swap: Kaia fee delegation and the claim keeper

Status: built and unit tested (59 tests passing on 2026-11-14, against the swap contract whose only privileged call is the master's `withdraw`). Not yet run end to end against a deployed swap on Kairos. Code: `server/`. Deploy: the `cojam-gas-api` service in `render.yaml`.

Holders should be able to swap old CT for new CT without owning KAIA. Kaia supports this natively: a transaction can carry two signatures, one from the sender (the holder) and one from a fee payer (our gas wallet), and the fee payer's balance pays the gas. The holder still signs every action in their own wallet, and `msg.sender` in the swap contract is the holder, so lots always belong to the holder (see `docs/CONTRACT-SPEC.md` section 3 and 9.9).

The server has two parts in one Node process:

1. **Fee payer API** (`POST /api/fee-delegate`): checks a holder signed transaction against a strict allowlist, adds the fee payer signature and broadcasts it.
2. **Keeper**: after each 7 day lock ends, it releases the locked 90% to the owner with `claimForMany` / `claimFor`, paid by the same gas wallet. Holders never need to come back to claim.

## 1. How it works

```
Holder (Kaia Wallet)         Site (/migrate/)                 Gas server                        Kaia node
       |                           |                               |                                |
       |  1. sign 0x31 tx          |                               |                                |
       |<--------------------------|  build approve / migrate /    |                                |
       |  senderTxHashRLP -------->|  claim, gasPrice, gasLimit    |                                |
       |                           |  2. POST {rawTransaction} --->|                                |
       |                           |                               |  3. decode, policy, limits,    |
       |                           |                               |     balance floor, simulate -->|
       |                           |                               |  4. sign as fee payer          |
       |                           |                               |  5. kaia_sendRawTransaction -->|
       |                           |<------------ {txHash} --------|                                |
       |                           |  6. poll the receipt ------------------------------------------>|
```

1. **The holder signs.** The site asks Kaia Wallet to sign a `TxTypeFeeDelegatedSmartContractExecution` (type `0x31`) transaction. The wallet returns the sender signed RLP (`senderTxHashRLP`) and does not broadcast it. Kaia's cookbook is explicit that the wallet signs as sender only and must not broadcast [3].
2. **The site posts it.** `POST /api/fee-delegate` with `{"rawTransaction": "0x31..."}`.
3. **The server checks it.** Decode, recover the sender from its signature, apply the allowlist and the caps (section 3), check the per wallet and per client limits and the daily budget, check the gas wallet balance, and simulate the call on the node with `eth_estimateGas` from the holder's address. A call that would revert is refused before we sign, because a reverted transaction still costs the fee payer gas.
4. **The fee payer signs.** `Wallet.signTransactionAsFeePayer` from `@kaiachain/ethers-ext/v6` adds our address and signature [2].
5. **Broadcast.** `kaia_sendRawTransaction`. The response is `{"txHash": "0x...", "action": "migrate"}`. The site polls the receipt like any other transaction.
6. **Settle.** When the receipt arrives the server replaces the reserved worst case cost with the real fee (`gasUsed x effectiveGasPrice`).

The two signature hashes are defined by Kaia [1]: the sender signs `SigRLP = encode([encode([type, nonce, gasPrice, gas, to, value, from, input]), chainid, 0, 0])` and the fee payer signs `SigFeePayerRLP = encode([encode([type, nonce, gasPrice, gas, to, value, from, input]), feePayer, chainid, 0, 0])`. The final transaction hash is `keccak256` of the fully signed RLP, so the server knows it before the node answers.

**Checked against the live network (2026-11-12).** A transaction built by this code from two fresh, empty random accounts was sent to a Kaia mainnet public node. The node decoded both signatures and refused it only with `insufficient funds of the fee payer for gas * price`. With one byte of the fee payer signature changed it refused with `invalid fee payer: invalid account key`. So the RLP and both signatures are in the format the node expects. Nothing was mined and no funds were involved.

### What the site sends (contract for the `/migrate/` page)

```js
import { Web3Provider, TxType } from "@kaiachain/ethers-ext/v6";

const provider = new Web3Provider(window.klaytn);          // Kaia Wallet
const signer = await provider.getSigner(account);
const senderTxHashRLP = await signer.signTransaction({
  type: TxType.FeeDelegatedSmartContractExecution,          // 0x31
  from: account,
  to: SWAP_ADDRESS,                                         // or OLD_CT for approve
  data: swap.interface.encodeFunctionData("migrate", [amount]),
  value: 0,
  gasLimit,                                                 // see below
});
const r = await fetch(`${API}/api/fee-delegate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ rawTransaction: senderTxHashRLP }),
});
```

This follows Kaia's own frontend example for the managed Fee Delegation Service (`new Web3Provider(window.klaytn)`, `signer.signTransaction(tx)`, post the raw string to a backend) [4]. Notes for the page:

* **Order:** send `approve`, wait for its receipt, then ask for the `migrate` signature. The server simulates `migrate` and refuses it while the approval is not yet mined.
* **Gas limit:** estimate, then add a margin, and stay under the caps (120,000 for approve, 600,000 for swap calls). Kaia charges 10,000 more intrinsic gas for fee delegated types and 100 gas per calldata byte [6], which an Ethereum style estimate may not include. A safe rule: `estimate x 1.3 + 15,000`.
* **Gas price:** leave it to the wallet or use the node's `eth_gasPrice` (27.5 gkei on 2026-11-12). Above 50 gkei the server refuses.
* **Fallback:** on any error code, or for wallets that cannot sign `0x31`, offer the normal path where the holder pays gas in KAIA. The swap works the same either way.
* **Claims:** the keeper releases every lot automatically, so the page only needs a sponsored `claim` button as a manual "release now".

## 2. Wallet support

| Wallet | Signs fee delegated (0x31) as sender | Source | Status |
| --- | --- | --- | --- |
| Kaia Wallet | Yes | Kaia lists it as supported for frontend fee delegation [4]; the cookbook describes the wallet side flow [3] | Verify on Kairos |
| OKX Wallet, Bitget Wallet | Listed as supported by Kaia's Fee Delegation Service page [4] | Kaia's Gas Fee Delegation Program form says OKX Wallet "couldn't be delegated" and only Kaia Wallet is supported, which conflicts | Treat as unsupported until tested |
| MetaMask | No | MetaMask signs Ethereum transaction types and broadcasts them itself through `eth_sendTransaction`; it has no dapp method that returns a sender signed Kaia `0x31` transaction. Kaia's fee delegation pages do not list it [4]. Kaia accepts Ethereum format transactions from MetaMask, but those are paid by the sender [7] | MetaMask users pay their own gas |
| WalletConnect | Depends on the wallet behind it | | Treat as self paid unless the wallet is Kaia Wallet |

So the page detects the wallet: Kaia Wallet gets the gasless path; MetaMask and others see the gas estimate in KAIA and pay it. This is a product decision to confirm, together with the Kairos test in section 9.

Accounts whose Kaia account key was changed (role based or multisig keys) are not sponsored: the server requires exactly one sender signature that recovers to `from`. Almost every holder uses the default legacy key.

## 3. Policy and abuse limits

The server signs only what is on this list. Everything else is refused with a code and logged.

| Allowed call | Target | Extra checks |
| --- | --- | --- |
| `approve(spender, amount)` | old CT (`OLD_CT_ADDRESS`) | `spender` must equal `SWAP_CONTRACT_ADDRESS`; any amount; the holder must hold at least `MIN_SPONSORED_OLD_CT` old CT |
| `migrate(amount)` | swap | `amount >= MIN_SPONSORED_OLD_CT` (default 1 CT) |
| `claim(maxLots)` | swap | `1 <= maxLots <= MAX_CLAIM_LOTS` (50) |
| `claimFor(user, maxLots)` | swap | `user` not zero, same `maxLots` bound |
| `claimForMany(users, maxLotsEach)` | swap | 1 to `MAX_CLAIM_USERS` (10) users, none zero, same `maxLots` bound on `maxLotsEach` |

Calldata must be the exact canonical ABI encoding (no extra bytes). The master's `withdraw(amount)` is never sponsored: the master pays its own gas. A test checks it is refused with `SELECTOR_NOT_ALLOWED`, together with admin style selectors the swap does not have (sweep, pause, recover, ownership). Calls to the new CT token are not sponsored either.

| Check | Default | Error code (HTTP) |
| --- | --- | --- |
| Type must be `0x31` (no value transfer types, no partial fee delegation `0x32`, no Ethereum types) | | `TX_TYPE_NOT_ALLOWED` (400) |
| `value` must be 0 | | `VALUE_NOT_ZERO` (400) |
| Target and selector on the list above | | `TARGET_NOT_ALLOWED`, `SELECTOR_NOT_ALLOWED`, `SPENDER_NOT_ALLOWED`, `CALLDATA_INVALID`, `AMOUNT_TOO_SMALL` (400) |
| Chain id from the sender signature equals `CHAIN_ID` | 8217 or 1001 | `CHAIN_ID_MISMATCH` (400) |
| One sender signature that recovers to `from`; no other fee payer named | | `SENDER_SIGNATURE_INVALID`, `FEE_PAYER_MISMATCH` (400) |
| Gas limit cap | approve 120,000; swap calls 600,000 | `GAS_LIMIT_TOO_HIGH` (400) |
| Gas price cap | 50 gkei | `GAS_PRICE_TOO_HIGH` (400) |
| Sponsored tx per wallet per UTC day | 10 | `RATE_LIMITED_SENDER` (429) |
| Sponsored tx per client network per UTC day (IP kept only as a salted hash) | 40 | `RATE_LIMITED_IP` (429) |
| Global daily budget (sponsored plus keeper gas) | 50 KAIA | `DAILY_BUDGET_EXHAUSTED` (503) |
| Gas wallet balance floor | 5 KAIA | `FEE_PAYER_BALANCE_LOW` (503) |
| Approve only from a wallet holding old CT | 1 CT | `NO_OLD_CT_BALANCE` (400) |
| Simulation on the node must succeed and fit the gas limit | on | `SIMULATION_FAILED`, `GAS_LIMIT_TOO_LOW` (400) |
| Node or RPC problems | | `BROADCAST_REJECTED` (400), `BROADCAST_UNCERTAIN` (502, with the tx hash), `RPC_UNAVAILABLE` (503) |
| Request hygiene | JSON, 16 KB body, allowed origins | `BAD_REQUEST`, `BODY_TOO_LARGE`, `ORIGIN_NOT_ALLOWED` |

Why these limits hold:

* **Worst case per transaction is bounded.** Kaia charges the full `gasPrice` for this transaction type (the effective gas price equals `gasPrice`) [5], so the most one transaction can cost us is `gasLimit x gasPrice`: 0.03 KAIA for a swap call at the caps, 0.006 KAIA for an approve. The server reserves that worst case against the budget before signing and corrects it when the receipt arrives.
* **The daily budget caps the loss from any attack** at 50 KAIA a day, whatever the number of wallets.
* **Fresh wallets cannot farm us.** A wallet without old CT cannot get an approve sponsored, and `migrate` only passes simulation with real old CT and a mined approval. Splitting dust over many wallets is blocked by the 1 CT minimum.
* **Rate limits are atomic.** The slot and the budget are taken in one step, so parallel requests cannot pass the last slot twice. A request that fails before broadcast gives its slot back. The same signed transaction posted twice is broadcast once.
* **10 per day is enough for honest use:** a swap is two sponsored transactions (approve, migrate), and releases are done by the keeper.
* **Nothing else is ever signed.** The fee payer signature is only produced after every check, for exactly the decoded fields.

The limits live in an in memory store behind an interface (`server/src/store.js`). It is correct for one instance. Before running more than one instance, or to keep counters across deploys, swap in Redis (Render Key Value) with the same methods; the file documents the keys.

## 4. Cost per holder (estimate)

**This is an estimate.** Gas figures are the Hardhat measurements in `docs/CONTRACT-SPEC.md` section 12 (re-measured 2026-11-14), adjusted for Kaia's intrinsic gas: plus 10,000 for fee delegated types and 100 gas per calldata byte instead of Ethereum's 4 or 16 [6]. Gas price is the node's `eth_gasPrice` on 2026-11-12: **27.5 gkei** (base fee 25 gkei). Confirm with real receipts on Kairos.

`fee in KAIA = gas x 27.5 / 1,000,000,000`

| Step | Who pays | Hardhat gas | Kaia adjustment | Estimated gas | KAIA |
| --- | --- | --- | --- | --- | --- |
| Approve old CT | gas wallet (sponsored) | about 46,000 | +10,000 fee delegation, +6,100 calldata (68 bytes) | about 62,100 | 0.00171 |
| Migrate, average | gas wallet (sponsored) | 142,299 | +10,000, +3,300 (36 bytes) | about 155,600 | 0.00428 |
| Migrate, a wallet's first lot | gas wallet (sponsored) | up to 219,874 | +13,300 | about 233,200 | 0.00641 |
| Release by the keeper, per holder inside a `claimForMany` batch | gas wallet (keeper) | about 41,600 per user in a 25 user batch (1,039,577 in total) | +2,800 calldata (32 bytes per user) | about 44,400 | 0.00122 |
| Release by the keeper, alone (`claimFor`, one lot) | gas wallet (keeper) | 70,413 to 97,125 | +2,800 | up to about 99,900 | up to 0.00275 |

Per holder who swaps once:

* Typical: 0.00171 + 0.00428 + 0.00122 = **about 0.0072 KAIA**
* Upper: 0.00171 + 0.00641 + 0.00275 = **about 0.0109 KAIA**

At scale: 1,000 holders cost about 7.2 to 10.9 KAIA. If every one of the 22,578 holder addresses (`research/01-cojam-history.md`) swapped once with sponsorship, about 163 to 245 KAIA. Each extra swap by the same holder adds about 0.0043 to 0.0064 KAIA (approve again only if the allowance ran out). To convert to money, multiply by the KAIA price on the day.

## 5. Monitoring and top up

**Endpoints** (CORS limited to `ALLOWED_ORIGINS`):

* `GET /api/gas-wallet`: address, KAIA balance, floor, sponsorship on or off, daily budget left, today and total sponsored transactions and KAIA spent (sponsored and keeper separately), average daily spend, **runway days** (balance divided by the average daily spend over the last 7 days with spend), and the time the counters started. Counters live in memory and restart from zero on deploy; the balance always comes from the chain. The admin page reads this.
* `GET /api/health`: always 200 while the process runs (Render's health check), with RPC state, latest block, gas wallet balance against the floor, and the keeper state (last run, last error, consecutive errors, pending and due lots, oldest due unlock). `GET /api/health?strict=1` answers 503 when degraded: point an external uptime monitor at it.

**Alerts to set** (from the endpoints and the JSON logs on Render):

* Runway under 14 days, or balance under 2 x the floor: top up.
* `keeper.dueLots > 0` with `oldestDueUnlockAt` more than 1 hour ago: the keeper is stuck; announce "Release now" on the site while fixing it.
* `keeper.consecutiveErrors >= 3` or `rpc.ok == false`: RPC problem; switch `KAIA_RPC_URL` to another provider.
* Log lines `sponsored tx reverted on chain` or a rising rate of `SIMULATION_FAILED`: investigate (it may be old CT being paused or frozen by its owner, the window having closed, or a swap reserve too small for the amount, for example after the master withdrew it; simulation refuses all of these before we pay any gas).

**Top up procedure:**

1. Read the address and runway from `GET /api/gas-wallet` (or the admin page). Check the address against the one recorded at setup.
2. From the treasury Safe, send KAIA for about 30 days of runway (at launch: 30 x the expected daily spend, at least the floor plus 20 KAIA). Do not keep much more than that in a hot key.
3. Confirm the balance on Kaiascan and in `/api/gas-wallet`. Sponsorship resumes by itself once the balance is above the floor; nothing to restart.

When the balance falls under `MIN_FEE_PAYER_BALANCE_KAIA` (5) the API stops sponsoring and the site falls back to self paid gas. The keeper keeps working down to `KEEPER_MIN_BALANCE_KAIA` (1), so releases of locked tokens have priority over new sponsorship.

## 6. Key handling

* **A dedicated gas wallet.** A fresh EOA used only for gas. It holds KAIA only, never CT, and has no role in any contract: the gas wallet is never the master wallet (the only address that can withdraw from the swap), and `claimFor` always pays the lot owner. If the key leaks, the loss is the KAIA in it, nothing else.
* **Now: Render secret environment variable.** `FEE_PAYER_PRIVATE_KEY` is declared with `sync: false` in `render.yaml`, so its value is entered in the Render dashboard and never stored in the repository. `server/.env.example` has placeholders only. The key is validated at start but never logged, returned or printed (the logger also masks any field that looks like a key).
* **Limit what a leak can cost:** keep about 30 days of runway in the wallet, no more.
* **Rotation:** create a new EOA, move the KAIA, update `FEE_PAYER_PRIVATE_KEY` on Render, redeploy, record the new address for the admin page and the alerts.
* **Later: a KMS.** Move signing into a cloud KMS that supports secp256k1 (for example AWS KMS `ECC_SECG_P256K1` or Google Cloud KMS `EC_SIGN_SECP256K1_SHA256`) so the key never exists in process memory. The signing call sits in one place (`signTransactionAsFeePayer` in `server/src/feePayer.js`, `signTransaction` in `server/src/keeper.js`) and can be replaced by a KMS signer.

## 7. The keeper

* **What it does:** finds lots whose 7 day lock has ended and releases them to their owners with `claimForMany(users, maxLotsEach)` (or `claimFor` for one owner), paid by the gas wallet. Tokens always go to the lot owner, never to the keeper.
* **How it finds lots:** it scans `Migrated` and `Claimed` events from `SWAP_DEPLOY_BLOCK` in block ranges (5,000 by default, shrinking automatically if the node refuses a range), keeps the open lots in memory, and treats a lot as due when `unlockAt + 120 s` is before the latest block time.
* **Safe to restart and idempotent:** the chain is the only source of truth. On start it rescans the events. Before sending it re-reads `claimable(user)` and drops owners with nothing matured (for example an owner who claimed by hand), estimates gas (a revert costs nothing), and does not send while one of its own transactions is still pending. After a release it re-reads `nextClaimIndex(user)`.
* **Bounded work:** at most 40 owners per transaction and 20 lots per owner per round (`KEEPER_BATCH_SIZE`, `KEEPER_MAX_LOTS_EACH`); an owner with more lots is finished over the next rounds.
* **Timing and backoff:** one round every 60 s. On an RPC error it waits 2, 4, 8 ... times the interval (with jitter, at most 5 minutes) and logs each failure; it resets after the first good round.
* **Gas:** plain legacy transactions at the node's gas price, refused above the 50 gkei cap. Spend is recorded with the sponsored spend in the daily budget and in `/api/gas-wallet`.
* **Where it runs:** inside the same Render web service as the API (`RUN_MODE=all`), one instance, no preview environments, on a paid instance (a free web service sleeps when idle). `render.yaml` has a commented worker block for a later split (`RUN_MODE=keeper`), which needs the Redis store first so the admin page still sees both counters.

## 8. Configuration and running

All configuration comes from environment variables (`server/.env.example`). Start up stops with a list of every problem if a required value is missing or malformed, if `KAIA_RPC_URL` serves another chain than `CHAIN_ID`, if the swap address has no code, or if the swap's `OLD_TOKEN()` differs from `OLD_CT_ADDRESS`.

```
cd server
npm ci
npm test                       # 59 tests, offline, random throwaway keys, mocked RPC
cp .env.example .env           # fill in Kairos values
npm run dev                    # node --env-file=.env src/index.js
```

The SDK is `@kaiachain/ethers-ext` 2.1.0 [8] with `ethers` 6.15.0, pinned. `npm audit` reports the `elliptic` advisory through the SDK's ethers v5 dependencies; the server only uses the v6 entry point, whose signing goes through ethers v6 `SigningKey` (noble curves), not `elliptic`.

## 9. Open items

1. **Kairos end to end:** deploy the token and the swap with `contracts/scripts/deploy-kairos.js` and fund the swap from the master, run this server against it, and sign approve, migrate and claim from Kaia Wallet (extension and mobile) through the site. Record real gas for section 4.
2. **Wallet matrix:** confirm Kaia Wallet signs `0x31` through `window.klaytn` without broadcasting; test OKX and Bitget; confirm MetaMask has no path. Decide what the page offers each wallet.
3. **Admin page access:** `/api/gas-wallet` shows only public chain data and counters, so it is open to the allowed origins. If the admin page moves behind a login, add the same login here.
4. **Redis store** before running more than one instance or to keep counters across deploys.
5. **RPC provider:** the public endpoint is fine for Kairos; use a dedicated provider on mainnet.
6. **Budget numbers:** confirm the daily budget (50 KAIA), the floor (5 KAIA) and the per wallet limit (10 a day) with the founder.

## Sources

1. Kaia docs, Fee Delegation (transaction type `0x31`, `SigRLP`, `SigFeePayerRLP`, hashes): https://docs.kaia.io/build/transactions/fee-delegation/
2. Kaia docs, ethers-ext v6, fee delegated smart contract execution (`TxType.FeeDelegatedSmartContractExecution`, `signTransaction`, `sendTransactionAsFeePayer`): https://docs.kaia.io/references/sdk/ethers-ext/v6/fee-delegated-transaction/smart-contract-execution/
3. Kaia docs, Integrate fee delegation cookbook (wallet signs as sender, returns `senderTxHashRLP`, does not broadcast; backend signs as fee payer): https://docs.kaia.io/build/cookbooks/integrate-fee-delegation-cookbook/
4. Kaia docs, Integrate Fee Delegation Service (supported wallets for frontend integration: Kaia Wallet, OKX Wallet, Bitget Wallet; `Web3Provider(window.klaytn)` example): https://docs.kaia.io/build/tutorials/integrate-fee-delegation-service/
5. Kaia docs, Transaction fees (effective gas price equals `gasPrice` for types with only a gas price field): https://docs.kaia.io/learn/transaction-fees/
6. Kaia docs, Intrinsic gas (`TxGasFeeDelegated` 10,000, payload gas per byte): https://docs.kaia.io/learn/transaction-fees/intrinsic-gas/
7. Kaia docs, Ethereum compatibility (Ethereum format transactions on Kaia): https://docs.kaia.io/build/transactions/ethereum/
8. `@kaiachain/ethers-ext` on npm (2.1.0, published 2025-09-06) and source: https://www.npmjs.com/package/@kaiachain/ethers-ext and https://github.com/kaiachain/kaia-sdk/tree/dev/ethers-ext
9. Live checks on 2026-11-12 against `https://public-en.node.kaia.io`: `eth_gasPrice` 27.5 gkei, latest block base fee 25 gkei, a mainnet fee delegated execution receipt with `effectiveGasPrice` equal to its `gasPrice`, and the format check in section 1.
