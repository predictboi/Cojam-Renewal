# Cojam migration contracts

Smart contracts for the Cojam token migration on Kaia: old CT (`0x7f223b1607171b81ebd68d22f1ca79157fd4a44b`) to the new Cojam Token, 1:1. On each swap 10% of the new CT arrives at once and 90% is locked for 7 days, then released to the holder (by the holder, or by anyone such as the team's keeper bot, always paid to the holder). The window opens when the swap contract is deployed and lasts 365 days. The whole new supply is minted to the project's master wallet; the owner funds the swap contract by plain transfers and may pause new swaps and withdraw the unowed reserve, but can never touch tokens owed to locked lots, old CT, or the swap rules. The full design, policies and test plan are in [`../docs/CONTRACT-SPEC.md`](../docs/CONTRACT-SPEC.md).

These contracts have **not** been audited.

| File | What it is |
| --- | --- |
| `contracts/CojamToken.sol` | New CT. Plain OpenZeppelin ERC-20 plus EIP-2612 permit. Fixed supply, minted once to the master wallet passed to the constructor. No owner, mint, pause, blacklist, fee or upgrade. |
| `contracts/CojamMigration.sol` | Swap. Takes the old and new token addresses and an owner (`Ownable2Step`), and opens the window at deploy. `migrate` takes old CT, pays 10% at once and opens a 7 day lot for the rest; it reverts with `InsufficientReserve` when the unowed new CT held by the contract is below the amount. `claim` (lot owner), `claimFor` and `claimForMany` (anyone, paid to the lot owner) release matured lots and can never be paused. Owner only: `pauseMigrate` / `unpauseMigrate` (migrate only), `withdrawReserve` (only up to `availableReserve()`), `recoverERC20` (never old CT, never new CT). |
| `contracts/mocks/*` | Test only stand ins: old CT with pause and freeze, fee on transfer token, malicious re-entering token, decimals token, Safe style contract wallet. Never deploy these to mainnet. |
| `test/CojamMigration.test.js` | Unit tests. |
| `test/fuzz.test.js` | Randomized sequences checked against a model, with invariants after every step. |
| `test/fork.kaia.test.js` | Reads the real old CT on Kaia mainnet and runs migrate, pause and freeze against its real bytecode on a local fork. Skips itself when the RPC is unreachable. |
| `scripts/deploy-kairos.js` | Kairos testnet deploy (refuses any other chain). |

## Requirements

Node 18 or later (tested on Node 22) and npm. Everything else comes from npm.

```bash
cd contracts
npm install
```

The Solidity compiler (0.8.28, EVM target `paris`) is downloaded by Hardhat on first compile.

## Build and test

```bash
npm run compile        # hardhat compile
npm test               # unit + fuzz + Kaia mainnet fork tests (fork skips itself if offline)
npm run test:unit      # everything except the fork tests (SKIP_FORK=1)
npm run test:fork      # only the Kaia mainnet fork tests
npm run test:fuzz      # longer fuzz campaign: 24 seeds x 200 steps
npm run gas            # gas report for the unit tests
```

Fuzz knobs: `FUZZ_SEED` (first seed), `FUZZ_RUNS` (number of seeds), `FUZZ_STEPS` (steps per seed). A failing seed is printed in the test title, so a failure can be replayed with `FUZZ_SEED=<seed> FUZZ_RUNS=1`.

Fork knobs: `KAIA_RPC_URL` (default `https://public-en.node.kaia.io`), `SKIP_FORK=1` to skip.

## Deploy to Kairos testnet

1. `cp .env.example .env` and fill it in. Use a throwaway test key only, funded from the Kairos faucet. Never put a real key in this repository.
2. `MASTER_ADDRESS` receives the **whole new CT supply**. `OWNER_ADDRESS` owns the swap contract (defaults to the master). Neither may be the old Cojam owner `0xeb16…0518`, which is unrelated to the relaunch; the script refuses it. On mainnet both should be a new Kaia Safe.
3. Leave `OLD_TOKEN_ADDRESS` empty to deploy a test old CT (`MockOldCojam`) with the exact old supply.
4. Optional: if the deployer key **is** the master, set `FUND_AMOUNT` (in CT, for example `1000000`) and the script transfers that much new CT into the swap right after deploy. Otherwise the master funds the swap later with a plain transfer. Until then `migrate` reverts with `InsufficientReserve`.
5. Run:

```bash
npm run deploy:kairos
```

The script deploys (the mock old CT if needed), then `CojamToken(master)`, then `CojamMigration(old, new, owner)` (which opens the 365 day window in its deploy block), funds the swap if asked, and checks: the supply is the fixed supply, the master holds the full supply minus the funded amount, the swap holds exactly the funded amount, the deployer holds no new CT unless it is the master, and the swap's tokens and owner are the ones requested. It prints every address, the swap's deploy block and the window timestamps as JSON. Verify both contracts on Kaiascan: the `CojamToken` constructor argument is the master; the `CojamMigration` arguments are old token, new token, owner.

`npm run deploy:local` runs the same script against the in-process Hardhat network as a dry run (the deployer is the master and funds 1,000,000 CT).

Mainnet deployment is deliberately not scripted here: because the swap deploy opens the window, it is the launch itself and follows the launch checklist in the spec. Funding is a separate step by the master, so the owner can deploy, verify and fund before announcing; the window still runs from the swap's deploy block.
