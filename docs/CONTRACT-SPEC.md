# Cojam token migration: contract specification

Status: draft for developer and auditor review. First written 2026-11-12; revised 2026-11-14 for the founder's issuance model: the whole supply is minted to a master wallet, the master funds the swap by plain transfers, and neither contract has any admin function. The contracts are **not audited**. Code: [`contracts/`](../contracts/). How to build, test and deploy: [`contracts/README.md`](../contracts/README.md).

## 1. Overview

Cojam moves from the old CT token to a new, plain token on the same chain (Kaia mainnet, chain id 8217; testnet Kairos, chain id 1001).

| | Old token | New token |
| --- | --- | --- |
| Name, symbol | Cojam, CT | Cojam Token, CT |
| Address | `0x7f223b1607171b81ebd68d22f1ca79157fd4a44b` | set at deploy (deployed on its own, before the swap contract) |
| Decimals | 18 | 18 |
| Total supply | 4,083,262,533.9560001 CT (`4083262533956000100000000000` base units, read on chain 2026-11-12) | exactly the same number, fixed, minted once to the master wallet |
| Admin | owner `0xeb16…0518` (not controlled by the team) can pause, freeze and lock | none |

The migration rules, all enforced by code:

* **1:1.** One old base unit is credited as one new base unit. Same decimals, so there is no scaling.
* **10% now, 90% after 7 days.** On each `migrate(amount)` the contract credits the old CT that actually arrived. 10% of the credit (rounded down) is sent in new CT in the same transaction. The rest (credit minus the instant part, so no dust is lost) becomes a **lot** locked for 7 days.
* **Release without action from the holder.** After 7 days anyone may release a matured lot (`claimFor`, `claimForMany`); the tokens always go to the lot owner, never to the caller. The team's gas wallet does this as a keeper and pays the gas. Holders can also call `claim` themselves.
* **Window.** The window opens in the swap contract's deploy block (`WINDOW_START = block.timestamp` at deploy) and closes at `WINDOW_END = WINDOW_START + 365 days` (exclusive). Releasing lots works forever.
* **Gasless for holders.** Through Kaia native fee delegation, the Cojam gas wallet co-signs and pays the gas for approve, migrate and claims. The holder still signs every transaction, so `msg.sender` is always the holder (section 3).
* **Same rules for everyone.** No allowlist, no exclusions, no rewards, no bonus, no minimum.
* **Funded by the master wallet.** The whole new supply is minted to the founder's master wallet. The master sends new CT to the swap contract with plain transfers, as much and as often as the plan says. A swap only succeeds while the contract holds enough new CT that no earlier lot is owed (the **reserve**).
* **No admin key anywhere.** Neither contract has an owner, a pause, a setter, a rescue function or an upgrade path. Nobody can move locked user funds or old CT, or change the ratio, the 10% share, the lock or the window.
* **Remainder.** From `WINDOW_END + 30 days` anyone can call `sweep()`, which sends the new CT that no lot is owed to the master wallet fixed at deploy. Tokens owed to locked lots are never touched. Unswapped tokens are therefore never stuck, without anybody holding a key.

**Why the 7 day lock on 90%.** It deters swap abuse, such as swapping a large old balance and flipping the new supply on the market at once, and it favours real holders who intend to keep the token. Everyone gets 10% immediately, so the swap is usable at once, and the full amount always arrives after 7 days. The lock is a speed limit, not a ban: a holder can still sell 10% at once and the rest after a week, and the rule is identical for every address.

A note on the supply figure: the supply is usually quoted as 4,083,262,533.956 CT. The real on chain value carries one more digit, 0.0000001 CT (`100000000000` base units). The new token copies the on chain value to the last base unit. Site copy may keep the rounded figure but should not claim it is exact to the base unit.

## 2. Wallets and addresses

| Role | Address | Holds | Powers |
| --- | --- | --- | --- |
| **Token contract** (`CojamToken`) | set at deploy | nothing of its own | none: no owner, no mint, no pause, no blacklist, no fee, no upgrade |
| **Swap contract** (`CojamMigration`) | set at deploy | the new CT the master sent (the reserve plus what lots are owed) and every old CT received through `migrate` | none: it only follows its code. No function can move old CT out. New CT leaves only as the 10% instant part (to the migrating address), as released lots (to the lot owner), and through `sweep` (to `MASTER`, only the unowed part, only from `WINDOW_END + 30 days`) |
| **Master wallet** | `MASTER_ADDRESS`: the `CojamToken` constructor argument and the immutable `MASTER` of the swap | the whole new supply at deploy; afterwards whatever it has not sent to the swap, plus the swept remainder | none over either contract. It funds the swap by plain transfers and is the fixed destination of `sweep` |
| **Deployer EOA** | any fresh key | gas only (KAIA). Holds no new CT after deploy unless it is itself the master: the deploy script checks this | none after the deploy transactions |
| **Gas wallet** (fee payer and keeper) | one hot EOA run by the team | KAIA only, low balance, topped up from the master or the treasury | none over tokens. As **fee payer** it co-signs holders' fee delegated transactions and pays their gas. As **keeper** it calls `claimForMany` / `claimFor` after unlock, which can only pay lot owners. Anyone else may run the same keeper calls |

* The master wallet is the founder's. Recommended for mainnet: a **new Kaia Safe** created for the relaunch (for example 3 of 5, separate people and devices). It is not any wallet from the old Cojam project. The old owner `0xeb1622d0377da1f9815bfc6eff61afe3257a0518` is unrelated to the relaunch and must never be the master: the swap constructor reverts `OldOwnerNotAllowed` and the deploy script refuses it too.
* The master holds most of the new supply for most of the window. It is the highest value key of the relaunch, which is why a Safe is recommended. It has no power over the contracts, only over the tokens it holds.
* The deployer is a single use key. On testnet it may be the master (so the script can fund the swap in one go). On mainnet it should not be: the master should receive the supply directly.
* The gas wallet is a hot key by necessity (it signs automatically). Keep only a few days of gas in it. If it is stolen, the thief can spend that KAIA and nothing else: it holds no tokens and has no role in either contract. Rotating it needs no contract change, only a new key in the fee payer and keeper services. It is never the deployer or the master.
* **No address can move locked user funds.** Not the master, not the deployer, not the gas wallet, not the team. A lot's new CT can only ever go to the address that created the lot, and `sweep` is capped at the unowed balance.
* The old CT owner keeps its powers over old CT (section 7). It has no power over the new token or the swap contract.

## 3. Fee delegation (gasless swaps)

Holders swap without owning KAIA. Kaia supports fee delegation natively at the transaction level, so **no contract change is needed** and none was made.

**Transaction types.** Kaia has its own fee delegated transaction types next to the Ethereum ones: `TxTypeFeeDelegatedSmartContractExecution` (type `0x31`, the fee payer pays all of the gas) and `TxTypeFeeDelegatedSmartContractExecutionWithRatio` (type `0x32`, the fee payer pays a set percentage). Approve, migrate and claim are all smart contract executions, so they use `0x31`. They are sent with `kaia_sendRawTransaction` (Kaia SDKs such as `@kaiachain/ethers-ext` build and sign them). Wallets that only know Ethereum transaction types cannot sign them; those users send a normal transaction and pay their own gas, which always works.

**Signing order.**

1. The front end builds the transaction (`from` = holder, `to`, `data`, gas, nonce) and the holder signs it in their wallet. The sender signature covers `to`, `data`, value, nonce and gas.
2. The holder's signed transaction goes to the Cojam fee payer service. The gas wallet adds itself as fee payer and signs.
3. The fully signed transaction is broadcast. The network charges the gas to the fee payer.

**What it changes on chain: nothing that matters to the contracts.** `msg.sender` is the holder, not the fee payer, and so is `tx.origin`. Lots, the 10% payout and releases are keyed to the holder exactly as with a normal transaction. Neither contract reads `tx.origin` or the fee payer: a scan of the compiled bytecode of `CojamMigration` and `CojamToken` (re-checked 2026-11-14), and of the deployed old CT, finds no `ORIGIN` opcode, and the source never mentions it. The fork and unit tests therefore cover fee delegated calls as well.

**What the fee payer can and cannot do.**

* It only pays gas. It cannot change the holder's transaction (the sender signature covers every field), cannot move tokens, cannot redirect a payout, and has no role in either contract.
* It can refuse to sign. That only removes the free gas; the holder can still send the same call as a normal transaction.
* It can be drained of KAIA by abuse, so the fee payer service only co-signs these calls: `approve(swap, amount)` on old CT, and `migrate(amount)`, `claim(maxLots)`, `claimFor(user, maxLots)` and `claimForMany(users, maxLotsEach)` on the swap. It checks the target address, the function selector and the approve spender, caps the gas limit and the batch size, and rate limits per sender address. `sweep` is never sponsored: whoever triggers it pays their own gas. See `docs/FEE-DELEGATION.md` section 3.

**Approve needs its own transaction.** Old CT has no `permit` (EIP-2612), so there is no single signature approve plus migrate. A first time holder signs two fee delegated transactions: `approve` on old CT, then `migrate` on the swap. Holders who already approved enough skip the first one.

**Release after 7 days.** The same gas wallet acts as keeper and calls `claimForMany` for matured lots with its own ordinary transactions. The holder signs nothing for the 90% to arrive. A holder who wants it sooner after unlock can still send `claim`, sponsored or not.

**Contract wallets.** A Safe's transaction is submitted by one of its owner EOAs; that EOA's transaction may itself be fee delegated. The swap still sees the Safe as `msg.sender`.

## 4. Contracts and exact behaviour

Compiler: Solidity 0.8.28, optimizer on (200 runs), EVM target `paris` (no PUSH0, no transient storage, so the bytecode runs on every Kaia hardfork). Libraries: OpenZeppelin Contracts 5.4.0 (`ERC20`, `ERC20Permit`, `SafeERC20`, `SafeCast`, `ReentrancyGuard`).

### 4.1 `CojamToken`

* `ERC20("Cojam Token", "CT")` plus `ERC20Permit("Cojam Token")` (EIP-2612, domain version `"1"`).
* `TOTAL_SUPPLY = 4083262533956000100000000000` (constant).
* Constructor `(address master)`: mints `TOTAL_SUPPLY` to `master`. OpenZeppelin reverts `ERC20InvalidReceiver(address(0))` on the zero address. There is no other mint path.
* Deployed on its own, before the swap contract. It does not know the swap contract.
* Nothing else: no owner, no `burn`, no pause, no blacklist, no hooks, no fee, no proxy.

**KIP-7 compatibility.** Kaia runs the EVM, and Kaia wallets, Kaiascan and Kaia DEXs handle ERC-20 tokens natively, so the token works on Kaia as is. KIP-7 is Kaia's token standard: it is ERC-20 plus `safeTransfer` / `safeTransferFrom` with an `onKIP7Received` receiver callback, plus KIP-13 `supportsInterface`. Recommendation: **do not add KIP-7 extras and do not answer `supportsInterface` for KIP-7.** Answering `supportsInterface(0x65787371)` without the `safeTransfer` functions would be a false claim; adding them brings receiver callbacks (a re-entry surface) to a token whose value is being plain and neutral; and KIP-13 detection is not needed for ERC-20 style listing on Kaia. Pre launch action: confirm with each target exchange that an ERC-20 style token on Kaia is accepted (checklist item).

### 4.2 `CojamMigration`

**Constructor** `(IERC20 oldToken, IERC20 newToken, address master)`, in order:

1. Revert `ZeroAddress` if either token or `master` is zero.
2. Revert `OldOwnerNotAllowed` if `master` is the old CT owner `0xeb1622d0377da1f9815bfc6eff61afe3257a0518` (constant `OLD_CT_OWNER`).
3. Revert `SameToken` if the two token addresses are equal.
4. Revert `DecimalsMismatch` unless both tokens report 18 decimals.
5. Revert `SupplyMismatch` if `newToken.totalSupply() < oldToken.totalSupply()`: the new supply must be able to back every old token that exists. Old CT can only shrink (it has `burn` and no `mint`), so an old CT burn between the token deploy and the swap deploy does not block the swap.
6. Store immutables: `OLD_TOKEN`, `NEW_TOKEN`, `MASTER`, `WINDOW_START = block.timestamp`, `WINDOW_END = WINDOW_START + 365 days`, `SWEEP_OPENS_AT = WINDOW_END + GRACE` with the constant `GRACE = 30 days`.

The contract starts with no new CT. Until the master funds it, `migrate` reverts `InsufficientReserve`.

**The reserve.** `availableReserve() = NEW_TOKEN.balanceOf(this) - totalOwed`, where `totalOwed` is the sum of locked amounts not yet released. It is what `migrate` may still hand out and what `sweep` sends to `MASTER` after the window and the grace period. New CT that lots are owed is never part of it.

**Funding.** The master (or anyone) sends new CT to the contract with a plain ERC-20 `transfer`. There is no deposit function and no event from the swap; the token's `Transfer` event to the swap address is the record. The reserve grows by exactly the amount sent. A transfer cannot be taken back before `SWEEP_OPENS_AT`: there is no withdraw function, so the master should fund in steps it is comfortable leaving in the swap until then.

**`migrate(uint256 amount) returns (uint256 lotId)`**, `nonReentrant`:

1. Revert `ZeroAmount` if `amount == 0`; `WindowClosed` if `now >= WINDOW_END`.
2. Revert `InsufficientReserve(available, amount)` if `availableReserve() < amount`. This runs before any old CT is pulled, so a refused swap moves nothing and costs little gas. Because the credit can never exceed `amount`, a swap can never use new CT owed to earlier lots.
3. Read the swap's old CT balance, call `OLD_TOKEN.safeTransferFrom(msg.sender, this, amount)`, read the balance again.
4. `received = after - before`. Revert `NothingReceived` if nothing arrived; revert `ReceivedMoreThanSent` if `received > amount`.
5. `instant = received * 10 / 100` (rounded down); `locked = received - instant`. `locked` is always at least 1, and `instant + locked == received` exactly.
6. Append lot `{amount: locked, unlockAt: now + 7 days}` to `msg.sender`'s list; `lotId` is its index.
7. `totalMigrated += received; totalInstant += instant; totalOwed += locked`; emit `Migrated`.
8. Last step: if `instant > 0`, transfer `instant` new CT to `msg.sender`.

Rounding examples: 1 wei gives 0 now and 1 locked; 9 wei gives 0 and 9; 10 wei gives 1 and 9; 19 wei gives 1 and 18; 12,500 CT gives 1,250 CT and 11,250 CT. Old CT received stays in the swap contract forever (section 9.1).

**Release of matured lots.** All three entry points share one internal routine and are `nonReentrant`:

* `claim(uint256 maxLots)`: releases the caller's own lots to the caller.
* `claimFor(address user, uint256 maxLots)`: callable by anyone; releases `user`'s lots **to `user`**.
* `claimForMany(address[] users, uint256 maxLotsEach)`: callable by anyone; for each listed user, releases that user's lots **to that user**. Users with nothing matured are skipped; the call reverts `NothingToClaim` only if nothing at all was released.

The routine for one user: start at `nextClaimIndex[user]`, walk at most `maxLots` lots in id order, stop at the first lot with `now < unlockAt`, emit `Claimed(user, lotId, amount, msg.sender)` per lot, move the cursor, `totalOwed -= sum`, `totalClaimed += sum`, then transfer `sum` to `user`. `claim` and `claimFor` revert `NothingToClaim` if the sum is zero (no lots, none matured, or `maxLots == 0`).

No caller can choose the recipient: the recipient is always the lot owner, the address that called `migrate`. A third party can only make a matured payment arrive at its owner, never earlier and never elsewhere.

Why a cursor is correct: `LOCK_PERIOD` is a constant and block time never goes backwards, so a user's lots unlock in id order. A lot is released exactly when its id is below the cursor. The `maxLots` bound means a wallet with any number of lots can always be released in several transactions: no unbounded loop can brick a user. Measured: 25 lots in one call cost 212,492 gas.

**`sweep() returns (uint256 amount)`**, `nonReentrant`, callable by anyone:

1. Revert `SweepNotOpen` if `now < SWEEP_OPENS_AT` (`WINDOW_END + 30 days`).
2. `amount = availableReserve() = NEW_TOKEN.balanceOf(this) - totalOwed`. Revert `NothingToSweep` if zero.
3. `totalSwept += amount`; emit `Swept(amount)`; transfer `amount` to `MASTER`.

It can be called again later, for example if new CT is sent to the contract after a sweep. It can never reduce the balance below `totalOwed`, and because `migrate` is closed after `WINDOW_END`, `totalOwed` can only go down. The caller chooses nothing: the amount is computed and the recipient is fixed.

**Views**: `availableReserve()`, `isOpen()` (true while `now < WINDOW_END`; it does not look at the reserve), `previewSplit(received) → (instant, locked)`, `lotCount(user)`, `lotOf(user, lotId) → (amount, unlockAt, claimed)` (amount is the locked 90% part), `claimable(user, maxLots) → (amount, lots)`, `pendingOf(user)` (all unreleased, matured or not; loops, view only), public counters `totalMigrated`, `totalInstant`, `totalOwed`, `totalClaimed`, `totalSwept`, `nextClaimIndex(user)`, constants `WINDOW`, `GRACE`, `LOCK_PERIOD`, `INSTANT_PERCENT`, `DECIMALS`, `OLD_CT_OWNER`, and the immutables `OLD_TOKEN`, `NEW_TOKEN`, `MASTER`, `WINDOW_START`, `WINDOW_END`, `SWEEP_OPENS_AT`.

**Invariants** (checked after every step of the fuzz tests, where `funded` is all new CT ever transferred into the swap):

* `NEW_TOKEN.balanceOf(swap) >= totalOwed` (the swap always holds at least the sum of unreleased locked amounts)
* `totalOwed == sum of unreleased lot amounts`
* `NEW_TOKEN.balanceOf(swap) + totalInstant + totalClaimed + totalSwept == funded`
* `NEW_TOKEN.balanceOf(MASTER) == TOTAL_SUPPLY - funded + totalSwept`
* `totalMigrated == totalInstant + totalOwed + totalClaimed`
* `OLD_TOKEN.balanceOf(swap) >= totalMigrated` (equal unless someone sent old CT directly)
* every address holds exactly its instant parts plus its released lots; a keeper or any third party caller never receives anything

### 4.3 Function table

These five are the only functions that change state. There is no admin function of any kind.

| Function | Caller | When | Moves |
| --- | --- | --- | --- |
| `migrate(amount)` | any holder | inside the window, reserve at least `amount` | old CT in from the caller; 10% new CT out to the caller |
| `claim(maxLots)` | lot owner | any time after a lot's unlock, forever | new CT to the caller (its own matured lots) |
| `claimFor(user, maxLots)` | anyone | same | new CT to `user` |
| `claimForMany(users, maxLotsEach)` | anyone | same | new CT to each listed user |
| `sweep()` | anyone | from `WINDOW_END + 30 days`, repeatable | unowed new CT to `MASTER` |
| views (section 4.2) | anyone | any time | nothing |

## 5. Parameters

| Parameter | Value | Where set | Changeable |
| --- | --- | --- | --- |
| Ratio | 1:1 (base unit for base unit) | code | no |
| Instant share | 10%, rounded down | `INSTANT_PERCENT` constant | no |
| Lock on the rest | 7 days (604,800 s) | `LOCK_PERIOD` constant | no |
| Decimals | 18 and 18 | code, checked at deploy | no |
| New supply | 4,083,262,533.9560001 CT, all minted to the master | `CojamToken.TOTAL_SUPPLY`, constructor argument `master` | no |
| Window start | the swap's deploy block timestamp | constructor (`block.timestamp`) | no |
| Window length | 365 days | `WINDOW` constant | no |
| Grace before sweep | 30 days | `GRACE` constant | no |
| `MASTER` | the master wallet (new relaunch Safe recommended) | constructor | no |
| Old token, new token | `0x7f22…a44b`, the deployed `CojamToken` | constructor | no |
| Reserve | whatever the master has sent, minus what lots are owed and what was swept | plain transfers in; `sweep` out after the grace period | grows with every transfer; shrinks only through swaps and `sweep` |

## 6. Lot state diagram

```mermaid
stateDiagram-v2
    [*] --> Locked: migrate(amount) inside window, reserve >= amount\n10% paid at once, 90% locked\nMigrated(user, lotId, old, instant, locked, unlockAt)
    Locked --> Matured: block.timestamp >= unlockAt\n(no transaction)
    Matured --> Released: claim by the owner, or claimFor / claimForMany by anyone\npaid to the owner only\nClaimed(user, lotId, amount, caller)
    Released --> [*]
    note right of Matured
        Stays releasable forever,
        through WINDOW_END, grace and sweep.
        sweep() never touches it.
    end note
```

Contract phases: window `[WINDOW_START, WINDOW_END)` (migrate when funded, release), `[WINDOW_END, SWEEP_OPENS_AT)` (release only), from `SWEEP_OPENS_AT` (release and sweep).

## 7. What the old token can do (read from chain)

The old contract's source is not verified by us. A scan of its deployed bytecode on 2026-11-12 found these owner functions: `pause()`, `unPause()`, `freeze(address)`, `unFreeze(address)`, lock functions (`unlock(address,uint256)`, `unlockAll(address)`, `releaseLock(address)`, `lockInfo(address,uint256)`, `totalLocked(address)`, plus three selectors we could not name), `transferOwnership`, `renounceOwnership`. It has `burn` and `burnFrom`. It has **no** `mint`, no `permit`, no KIP-7 `safeTransfer`, no `supportsInterface`. On chain: owner `0xeb1622d0377da1f9815bfc6eff61afe3257a0518`, `paused() == false`, balances mapping at storage slot 1 (all re-read by the fork tests on 2026-11-14).

Fork tests against the real bytecode confirmed: `pause()` blocks `transferFrom` (so `migrate` reverts) but releases of existing lots keep paying; `freeze(holder)` blocks that holder from migrating; `freeze(swapContract)` does **not** block migrate or release, because the swap never sends old CT.

## 8. Events and errors

**Events**

| Event | When |
| --- | --- |
| `Migrated(address indexed user, uint256 indexed lotId, uint256 oldAmount, uint256 instantAmount, uint256 lockedAmount, uint256 unlockAt)` | each successful `migrate`. `oldAmount` is what actually arrived; `instantAmount + lockedAmount == oldAmount` |
| `Claimed(address indexed user, uint256 indexed lotId, uint256 amount, address indexed caller)` | once per lot released. `user` received the tokens; `caller` sent the transaction (the owner, the keeper or anyone) |
| `Swept(uint256 amount)` | each successful `sweep`; the recipient is always `MASTER` |

Plus the standard ERC-20 `Transfer` and `Approval` on both tokens; funding shows up only as a new CT `Transfer` to the swap. A front end can rebuild a wallet's full history from `Migrated` and `Claimed` filtered by `user`. The keeper finds due lots from `Migrated.unlockAt` and the user's `nextClaimIndex`.

**Custom errors**

| Error | Raised by | Meaning |
| --- | --- | --- |
| `ZeroAddress` | constructor | old token, new token or master is zero |
| `OldOwnerNotAllowed` | constructor | master is the old CT owner |
| `SameToken` | constructor | old and new token are the same address |
| `DecimalsMismatch` | constructor | old or new token is not 18 decimals |
| `SupplyMismatch` | constructor | new supply is below the old `totalSupply()` |
| `ZeroAmount` | migrate | amount is zero |
| `WindowClosed` | migrate | at or after `WINDOW_END` |
| `InsufficientReserve(available, needed)` | migrate | the unowed new CT in the swap is below the amount |
| `NothingReceived` | migrate | the transfer moved no old CT into the swap |
| `ReceivedMoreThanSent` | migrate | more arrived than `amount` (non standard token) |
| `NothingToClaim` | claim, claimFor, claimForMany | no matured unreleased lot within `maxLots` (for the batch: for every listed user) |
| `SweepNotOpen` | sweep | before `SWEEP_OPENS_AT` |
| `NothingToSweep` | sweep | every new CT in the swap is owed to lots |
| `ReentrancyGuardReentrantCall` (OpenZeppelin) | every state changing function | re-entry attempt |

Errors coming from old CT itself (allowance, balance, paused, frozen) bubble up unchanged through `SafeERC20`. The front end should map them to the states in HANDOFF 4.4 (approval needed, insufficient balance, old token paused), and add one swap state: "swap temporarily unavailable, reserve being topped up" (`availableReserve()` below the amount).

## 9. Design decisions and reasons

### 9.1 Received old CT stays in the swap contract (not `0x…dEaD`, not `burnFrom`)

* **Freeze risk decides it.** The old owner can `freeze` any address, and a frozen address cannot send. A design that forwards old CT to `0x…dEaD` inside `migrate` would be bricked for everyone by one `freeze(swap)` call. Holding in place cannot be blocked that way (proved on the fork).
* **`burnFrom` is unwise here.** Its behaviour inside unverified code (allowance handling, interaction with pause, freeze and locks, events) is not something we control, and it still needs the same approval. It would also make the received amount harder to measure and shrink the old `totalSupply`, which removes a clean cross check.
* **It is as good as burned.** The swap has no function that can move old CT and no admin or upgrade path. `OLD_TOKEN.balanceOf(swap)` is a public, exact ledger of everything migrated. Supply trackers can treat that address as locked forever.
* **Cheaper.** One old CT transfer per migrate instead of two.

### 9.2 No admin key

The founder decided that the swap contract must be a completely basic contract with no admin functions. Neither contract has an owner, a pause, a setter, a rescue function or an upgrade path. The only privileged outcome, the remainder going to the master wallet, is time gated, permissionless to trigger, fixed in its recipient and limited to unowed tokens. This removes the most common migration failure modes (key theft, insider moves, ratio changes) and keeps both contracts listing neutral.

The supply is still managed centrally, but outside the contracts: the master wallet holds whatever it has not sent to the swap and decides how much to send and when. Holders trust the master for availability (enough reserve to swap) and nothing else.

Costs of having no admin, accepted by the founder:

* **Nothing can be stopped after launch.** If a bug appears, new swaps cannot be paused. Mitigations: external audit, full testnet run, a small mainnet dry run with team wallets, a contract small enough to review line by line, and funding in tranches (the worst case of a swap bug is bounded by what the swap holds: old CT already migrated plus new CT not yet released or swapped).
* **Funding cannot be taken back early.** New CT sent to the swap stays there until it is swapped or swept after `WINDOW_END + 30 days`.
* **Tokens sent by mistake are stuck.** Old CT sent with a plain transfer is not credited and cannot be recovered. Any other token except new CT is stuck forever. New CT sent by mistake simply joins the reserve and is swept to the master later.

### 9.3 Token deployed on its own, supply to the master, swap funded by transfers

`CojamToken(master)` mints the whole supply to the master wallet. The master then sends new CT to the swap whenever it wants to open or extend capacity. Consequences:

* The window still opens in the swap's deploy block, so the swap deploy is the launch. Funding can happen in the same hour, but until it does every `migrate` reverts `InsufficientReserve`. Recommended order: deploy token, deploy swap, verify both on Kaiascan, fund, then announce.
* The swap only ever hands out what it holds unowed. A holder who swaps is fully backed at that moment and stays backed: nothing can take new CT out except releases to lot owners and a sweep capped at the unowed part.
* If the master funds less than the old supply, swaps beyond the reserve wait until the next top up. The site must show this state honestly (section 8).

### 9.4 Permissionless release for the keeper

The founder wants the 90% to arrive without the holder doing anything. `claimFor` and `claimForMany` make release a public service with one hard rule: the payee is always the lot owner. Consequences:

* The team's keeper bot needs no privileges, holds only gas, and its key being stolen changes nothing (an attacker could only pay holders on time).
* If the keeper stops, any holder can `claim`, and anyone (an exchange, a community member) can run the same keeper.
* A third party cannot release early (the unlock check is the same), cannot redirect (no recipient parameter), and cannot skip or reorder lots (the cursor only moves over matured lots).

### 9.5 Permissionless sweep to a fixed master

`sweep` follows the same idea as the releases: anyone may trigger it, nobody may choose anything. It opens 30 days after the window closes (time for late announcements and for the keeper to finish), it sends only `availableReserve()`, and the recipient is the immutable `MASTER`. It is repeatable, so new CT that arrives after a sweep is not stuck either.

### 9.6 Measured credit

The credit is the swap's balance change, not the requested amount, and the 10/90 split is applied to that credit. Fee on transfer or other non standard behaviour can never over credit (tested with a 1% fee mock and in fuzz runs with a 0.37% fee). The real CT has no fee (fork test: credit equals amount). The reserve check uses `amount`, which is never below the credit, so it is conservative.

### 9.7 Checks, effects, interactions

Releases and `sweep` follow checks, effects, interactions strictly (state first, transfer last). `migrate` checks the reserve first, then must call old CT before writing state, because the credit is the measured balance change; after that it writes all state and emits, and the instant new CT transfer is the last step. This is the standard pattern for measured transfers; `nonReentrant` on every state changing function closes the gap, and the old token is a fixed, known contract, not user input. Tests show a malicious token that re-enters `migrate`, `claim`, `claimFor`, `claimForMany` or `sweep` from inside `transferFrom` is rejected, and a swallowed re-entry gains nothing.

### 9.8 No permit based migrate

Old CT has no `permit` (EIP-2612), so a one signature migrate is impossible. Holders send two transactions: approve, then migrate. Contract wallets such as Safe can batch both atomically (MultiSend), which is tested. The front end should approve the exact amount, not an unlimited allowance. The new token does support `permit`, for later DEX and app use.

### 9.9 Lots and cursor releases

Each `migrate` call is its own lot with its own 7 day timer. A cursor per user plus a `maxLots` bound gives constant cost per lot, no unbounded loops, and no per lot flag to store. Only the caller can create lots for itself, so lot spam only affects the spammer, and even then it is just more release transactions (which the keeper or the spammer pays for).

### 9.10 Kaia specifics

* Kaia fee delegated transactions work: `msg.sender` is the sender, not the fee payer, so a sponsored gas flow does not change who owns a lot (section 3).
* Kaia account key changes (role based keys) do not affect ownership: lots are keyed by address, and `MASTER` is an address.
* Hardhat needs a hardfork history entry to fork chain 8217 (`hardhat.config.js`).

## 10. Edge case policies

| Case | Policy |
| --- | --- |
| **Tokens on exchanges** (MEXC, any Korean exchange still holding CT) | The holder of record is the exchange. The exchange migrates its own balance through the same contract (it is a normal caller): it receives 10% at once and the rest after 7 days, released by the keeper. It credits its users by its own process. Publish the list of supporting exchanges and their dates. Make sure the reserve covers a large exchange swap before its date. No special contract path. |
| **Klayswap LP** | LP tokens are not old CT. Holders remove liquidity first, then migrate the returned CT. Show an inline hint on the migrate page. |
| **Vesting or locked contracts** | A contract holding old CT can migrate only if it can call `approve` and `migrate` on arbitrary targets. Release needs nothing from it (the keeper or anyone calls `claimFor`). If it cannot call `migrate`, its beneficiaries must get the CT out first, or the team compensates from the master wallet off chain. There is no admin path, by design. Ask known vesting holders before launch. |
| **Contract wallets (Safe, multisig)** | Fully supported. No `tx.origin`, no EOA checks; lots belong to `msg.sender`. Approve and migrate can be one batched Safe transaction, and the 90% arrives without another Safe transaction. Tested with a contract wallet mock; test a real Safe on Kairos before launch. |
| **Reserve runs short** | `migrate` reverts `InsufficientReserve(available, needed)` before pulling any old CT. The holder loses nothing (the approval stays). The site shows "temporarily unavailable" and the master tops up. Alert on `availableReserve()` falling below a threshold. |
| **Lost keys** | Old CT in a lost wallet cannot be migrated by anyone. Its matching new CT simply stays with the master, or in the swap reserve until the sweep returns it to the master. Any compensation is an off chain policy. |
| **Lost keys after migrating** | The lot is still released, but only to that address. Nobody can redirect it. |
| **Late migrators** | `migrate` reverts from `WINDOW_END`; nobody can reopen it. The late policy (if any) is paid from the master wallet, off chain. Show the deadline everywhere. Open decision. |
| **Tiny balances** | No minimum. Any amount from 1 base unit migrates exactly. Below 10 base units the instant part rounds to 0 and the whole amount is locked; nothing is lost. The "Max" button should send the whole balance. |
| **Old CT paused by the unknown owner** | `migrate` reverts for everyone while paused; existing lots keep unlocking and being released. Fallback: take a snapshot of old CT balances at the pause block (balances cannot change while paused, so anyone can verify it) and publish a Merkle root. Funding: the new CT still held by the master can fund a Merkle claim contract at once; new CT already sent to the swap only comes back with the sweep after `WINDOW_END + 30 days`. Funding the swap in tranches keeps more supply available for such a fallback. Mitigation before launch: find the old owner and ask for `renounceOwnership()` (removes pause and freeze for good), or accept the risk explicitly. |
| **Holder frozen or locked by the old owner** | That holder (or that locked part) cannot migrate. Same fallback as a pause: evidence on chain, a claim funded from the master. |
| **Old CT still transferable and trading** | Old CT keeps trading after launch and after `WINDOW_END`. Warn on the site against buying old CT late; show the deadline and the full old and new addresses everywhere (the ticker CT is reused by other tokens on MEXC). |
| **Old CT sent directly to the swap** (plain `transfer`, not `migrate`) | Not credited and cannot be recovered: no function moves old CT. The transfer is visible on chain (a `Transfer` to the swap without a `Migrated`), so the team may compensate off chain from the master. FAQ warns: never send CT to the contract, always use the migrate page. |
| **New CT sent to the swap** | It joins the reserve (this is how funding works) and is swept to the master after `WINDOW_END + 30 days` if nobody swaps against it. |
| **Other tokens sent to the swap** | Stuck forever. There is no rescue function, by design. |
| **Keeper down or late** | Nothing is lost. Holders see a "Release now" button that calls `claim`; anyone can call `claimFor`. |
| **Unidentified large wallets** (top 10 hold about 65.6%) | Treated like everyone else. The contract has no exclusion list. The 7 day lock on 90% limits how fast a large migrated balance can reach the market. |

## 11. Security considerations

* **Trust model.** No key controls the new token or the swap contract. The remaining trust points are: the deployed bytecode (audit and verify on Kaiascan), the master wallet (holds most of the new supply, funds the swap, receives the swept remainder; it has no power over the contracts, so holders trust it only for enough reserve to swap), the gas wallet (no power over tokens; it only pays gas and keeps releases on time) and the old CT owner (can pause, freeze or lock old CT; cannot touch new CT or lots).
* **Master key compromise.** An attacker with the master key can take the new CT the master still holds and would receive a future sweep. They cannot touch the swap's reserve before `SWEEP_OPENS_AT`, locked lots, or old CT, and cannot change any rule. This is the main reason to make the master a Safe.
* **Backing.** Locked lots are always fully backed (first invariant). `migrate` and `sweep` are both bounded by `balance - totalOwed`, so neither can reach owed tokens, in any order and at any time (fuzz tested with random funding and sweeps).
* **No redirection.** No function takes a recipient. The 10% goes to `msg.sender` of `migrate`; released lots go to the lot owner; the remainder goes to the immutable `MASTER`.
* **Re-entrancy.** `nonReentrant` on `migrate`, `claim`, `claimFor`, `claimForMany`, `sweep`. The new token has no hooks. The old token is fixed.
* **Integer bounds.** Lot amounts are stored as `uint128` and unlock times as `uint64`, both through `SafeCast`. The supply is below 2^92, so `received * 10` cannot overflow.
* **Time.** Only `block.timestamp` comparisons with day scale margins; a validator's few seconds of drift do not matter.
* **Front running.** No price and no shared queue, but the reserve is a shared, finite pool when the master funds less than the full supply: if two holders race for the last reserve, one swap reverts cleanly (nothing pulled) and succeeds after the next top up. Front running a keeper's release only pays the same owner the same amount. Front running a sweep only sends the same amount to the same master.
* **Phishing.** The main real world risk. Publish one official URL and the three addresses (old CT, new CT, swap) everywhere; never ask users to send tokens anywhere; the site never holds funds.
* **Approvals.** Encourage exact approvals. A leftover allowance to the swap is harmless (the swap only pulls on the owner's own `migrate` call), but exact is better hygiene.
* **Not audited.** Never describe these contracts as audited until an external report is published and linked.

## 12. Gas notes

Measured on the Hardhat network on 2026-11-14 (`npm run gas` plus the gas lines the unit tests print; solc 0.8.28, optimizer 200 runs):

| Action | Gas |
| --- | --- |
| Deploy `CojamToken` | 1,006,768 |
| Deploy `CojamMigration` | about 1,166,860 |
| Deploy both (the whole launch, excluding funding) | about 2,173,630 |
| Fund the swap (new CT `transfer` from the master) | 34,438 to 51,610 (the first transfer into an empty swap is the upper value) |
| `migrate` (includes the instant transfer; a wallet's first lot, and the first swap in the contract, cost more) | 97,949 to 219,962, average 141,771 |
| `claim`, 1 lot | about 57,650 |
| `claim`, 25 lots | 212,492 |
| `claimFor`, 1 lot | 70,413 to 92,325 |
| `claimForMany`, 1 user with 25 lots | 179,534 |
| `claimForMany`, 25 users with 1 lot each | 1,039,623 (about 41,600 per user) |
| `sweep` | 48,993 to 83,193 |
| Old CT `approve` | about 46,000 |

`claim(25)` in the measurement is the first release in its test, so it pays the one time cost of the release counters leaving zero; `claimForMany` with 25 lots came after it, which is why it is lower. Each extra lot in one release costs about 6,500 gas (one cold storage read plus one event). The keeper should batch users with `claimForMany` and keep each transaction to a few hundred lots; the front end can read `claimable(user, 100)` first. Costs in KAIA depend on the base fee at the time.

## 13. Test plan and results

Command: `cd contracts && npm install && npm test`. Run on 2026-11-14, Node 22, Hardhat 2.28.6, OpenZeppelin 5.4.0, with the Kaia mainnet RPC reachable. Result: **51 passing, 0 failing** (40 unit, 5 fork against Kaia mainnet, 6 fuzz). Long fuzz campaign `npm run test:fuzz` (24 seeds by 200 steps): **24 passing, 0 failing**. With `SKIP_FORK=1`: 46 passing, 5 pending (the fork tests skip cleanly). The fee payer server (`cd server && npm test`): 59 passing.

| # | Test | Status |
| --- | --- | --- |
| 1 | New supply equals the old on chain supply exactly (4,083,262,533.9560001 CT) | Pass |
| 2 | Whole supply minted to the master wallet; deployer and swap hold none | Pass |
| 3 | Zero address master rejected by the token | Pass |
| 4 | Token metadata; no owner, mint, pause, blacklist, freeze, upgrade, burn | Pass |
| 5 | EIP-2612 permit works | Pass |
| 6 | Window opens at the swap deploy; tokens, `MASTER`, `SWEEP_OPENS_AT = END + 30 days`, constants | Pass |
| 7 | Swap has no admin surface: no owner, pause, withdraw, recover or setter | Pass |
| 8 | Constructor guards: zero tokens, zero master, old owner as master, same token, wrong decimals (old and new), new supply below old; an old CT burn before the swap deploy does not block it | Pass |
| 9 | Migrate fails before funding; works after the master transfers new CT; reverts `InsufficientReserve(available, needed)` when short even though the contract holds owed tokens; top up reopens exactly up to the reserve; all lots pay in full | Pass |
| 10 | A refused swap for a short reserve pulls nothing and creates no lot | Pass |
| 11 | 1:1 swap: 10% lands in the same transaction, 90% becomes a 7 day lot, old CT kept, `Migrated` event | Pass |
| 12 | 10% math and rounding: 1, 9, 10, 11, 19, 99, 100 wei, an odd 21 digit amount, the full balance; `instant + locked == credit`; `previewSplit` | Pass |
| 13 | Zero amount reverts | Pass |
| 14 | No approval and over balance revert | Pass |
| 15 | Window edges: open in the blocks right after deploy, end minus 1 works, end reverts | Pass |
| 16 | Old token paused: migrate reverts with no state change and no payout; works after unpause | Pass |
| 17 | Frozen holder cannot migrate; freezing the swap changes nothing | Pass |
| 18 | Fee on transfer old token: credit and split use only what arrived | Pass |
| 19 | Inflating or lying token rejected | Pass |
| 20 | Lock edges: unlock minus 1 reverts, unlock pays the 90%, total equals the credit | Pass |
| 21 | `claimFor` by a stranger pays the owner, caller gets nothing, `Claimed` names the caller | Pass |
| 22 | Nobody can redirect or take another user's lots (claim, claimFor, claimForMany with duplicates) | Pass |
| 23 | `claimForMany` pays several owners and skips locked ones; reverts only if nothing at all | Pass |
| 24 | Multiple lots, partial releases, `maxLots` bound, views | Pass |
| 25 | 60 lots released in bounded chunks (gas recorded) | Pass |
| 26 | `claimForMany` over 25 users with one lot each (keeper batch, gas recorded) | Pass |
| 27 | The only state changing functions are `migrate`, `claim`, `claimFor`, `claimForMany` and `sweep` (no path for old CT) | Pass |
| 28 | Old CT and another token sent by mistake stay in the contract, even through a sweep | Pass |
| 29 | Migrate is closed after the window even with a full reserve; `isOpen` false | Pass |
| 30 | Sweep closed until `END + 30 days`; then anyone can call it, it sends only the unowed part to `MASTER` (caller gets nothing); locked remainders stay whole and pay after the sweep | Pass |
| 31 | Sweep is repeatable: new CT sent later is swept too, never below what is owed | Pass |
| 32 | Nothing to sweep when every remaining token is owed | Pass |
| 33 | Partial funding: the sweep returns exactly the unswapped funded part to `MASTER`; lots migrated in the last second of the window pay five years later | Pass |
| 34 to 38 | Re-entry into migrate, claim, sweep, claimFor, claimForMany from a malicious token is rejected | Pass |
| 39 | Swallowed re-entry gains nothing, accounting exact | Pass |
| 40 | Contract wallet: batched approve plus migrate, 10% at once, keeper releases 90%; lots keyed by `msg.sender` | Pass |
| 41 | Fork: live old CT name, symbol, decimals, exact supply, owner, not paused | Pass |
| 42 | Fork: deploy against real old CT (guards pass); migrate refused before funding; master funds the swap | Pass |
| 43 | Fork: real old CT migrates 1:1 with no fee; 10% at once; keeper releases 90% after 7 days | Pass |
| 44 | Fork: real `pause()` blocks migrate, existing lots still release, `unPause()` restores | Pass |
| 45 | Fork: real `freeze()` blocks a holder; freezing the swap blocks nothing | Pass |
| 46 to 51 | Fuzz: 6 seeds by 160 steps (2 with a fee token). Random partial funding and top ups by the master (inside and after the window), sweep attempts by anyone (before and after `SWEEP_OPENS_AT`); random amounts (0, 1 wei, 9 wei, full, over balance, random) and timing (exact unlock and unlock minus 1 included); releases by the owner, by a keeper, by other users and in batches with duplicates; checked against a model; every invariant of section 4.2 after every step; final drain (a keeper sweeps, then releases everything) leaves the swap at zero, the keeper with nothing, the master with exactly `supply - migrated`, and users holding exactly what they migrated | Pass |

Still to do before mainnet: external audit; Kairos end to end with the real front end, the keeper bot, a real Safe as master and as a holder; a small mainnet dry run with team wallets right after the launch deploy.

## 14. Launch checklist (HANDOFF 4.7 adapted)

1. External audit report published and linked on the site. Audit status stated honestly until then.
2. Master wallet: a new Kaia Safe created for the relaunch, signers and threshold documented, address published. Not any old Cojam wallet.
3. Old token: try to reach the old owner `0xeb16…0518`; ask for `renounceOwnership()`. If not possible, publish the pause and freeze risk and the fallback policy.
4. Re-read the old `totalSupply()` right before deploy; it must not exceed `CojamToken.TOTAL_SUPPLY` (the swap deploy reverts otherwise).
5. Kairos rehearsal: deploy with the script, fund, migrate from an EOA (with and without fee delegation) and a Safe, run the keeper against it, run through every front end state in HANDOFF 4.4 plus "reserve short".
6. Gas wallet ready before mainnet deploy: fee payer service live with its allowlist of targets, selectors and spender (`sweep` not sponsored), gas cap and per address rate limit; keeper watches `Migrated` and calls `claimForMany` after each `unlockAt`; alerts when its KAIA balance is low; top up procedure written down.
7. Funding plan written down: how much new CT goes into the swap at launch, the reserve threshold that triggers a top up, and who signs top ups. Remember that funded CT cannot be taken back before the sweep.
8. Mainnet: deploy `CojamToken(master)` and `CojamMigration(old, new, master)` from a fresh EOA that is **not** the master; record `WINDOW_START`, `WINDOW_END`, `SWEEP_OPENS_AT` and show them as human dates; verify both contracts on Kaiascan; confirm on chain that the master holds the whole supply, the deployer holds none, and `MASTER()` is right.
9. Fund the swap from the master; confirm `availableReserve()`. Only then announce (the window is already running from the swap deploy).
10. Small mainnet dry run with team wallets inside the live window (migrate, check the 10%, keeper releases the 90% after 7 days).
11. Exchanges contacted (ERC-20 style token on Kaia accepted, swap support and dates, reserve sized for their balances); list published.
12. Announcement with the three full addresses on every official channel, plus the official URL and the "we never ask you to send tokens" banner.
13. Public dashboard from chain data: `totalMigrated`, `totalInstant`, `totalOwed`, `totalClaimed`, `totalSwept`, `availableReserve`, old CT held by the swap, days left, upcoming unlocks.
14. Monitoring and alerts on `Migrated`, `Claimed`, `Swept`, on new CT transfers into the swap, on the reserve falling below the threshold, on overdue matured lots (keeper health), and on old CT `paused()` and freeze activity.
15. Incident runbook: there is no pause to press. The runbook covers a found bug (announce, stop promoting the page, stop funding, plan a replacement), old CT being paused or frozen (snapshot block, announcement, Merkle claim funded from the master), a keeper outage (announce "Release now", restart), a suspected master key compromise (move the remaining supply), and phishing sites.
16. After `SWEEP_OPENS_AT`: anyone (the keeper is fine) calls `sweep()`; confirm the master received exactly `availableReserve()`.
17. Support FAQ live: exchanges, Klayswap LP, vesting and contract wallets, lost keys, why 10% now and 90% after 7 days, never send CT directly to the contract.

## 15. Open decisions

* **Launch date**, which is the swap deploy date (the window opens in the swap's deploy block).
* **Master wallet**: Safe signers and threshold.
* **Funding plan**: fund the full supply at once, or in tranches with a top up threshold. Tranches keep more supply in the master (useful for fallbacks) but can make swaps briefly unavailable.
* **Late migration policy** after `WINDOW_END`, and how a pause or freeze fallback is paid from the master.
* **Exchange support** list and dates.
