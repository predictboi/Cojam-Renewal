# Cojam migration contracts

Smart contracts for the Cojam token migration on Kaia: old CT (`0x7f223b1607171b81ebd68d22f1ca79157fd4a44b`) to the new Cojam Token, 1:1, each swap locked for 7 days. The full design, policies and test plan are in [`../docs/CONTRACT-SPEC.md`](../docs/CONTRACT-SPEC.md).

These contracts have **not** been audited.

| File | What it is |
| --- | --- |
| `contracts/CojamToken.sol` | New CT. Plain OpenZeppelin ERC-20 plus EIP-2612 permit. Fixed supply, minted once to the migration contract. No owner, mint, pause, blacklist, fee or upgrade. |
| `contracts/CojamMigration.sol` | Swap. Deploys `CojamToken` in its constructor, takes old CT through `migrate`, pays matured lots through `claim`, sends the unowed remainder to the treasury through `sweep` after the window plus grace. No admin key. |
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
2. `TREASURY_ADDRESS` must be the **new relaunch multisig** (a Kaia Safe). It must not be the deployer and must not be the old Cojam owner `0xeb16…0518`, which is unrelated to the relaunch. The script refuses both.
3. Leave `OLD_TOKEN_ADDRESS` empty to deploy a test old CT (`MockOldCojam`) with the exact old supply.
4. Run:

```bash
npm run deploy:kairos
```

The script deploys `CojamMigration` (which deploys `CojamToken` and mints the whole supply to itself), then checks that the reserve equals the total supply and that the deployer holds no new CT, and prints every address and timestamp as JSON. Verify both contracts on Kaiascan; the `CojamToken` constructor argument is the migration contract address.

`npm run deploy:local` runs the same script against the in-process Hardhat network as a dry run.

Mainnet deployment is deliberately not scripted here. It follows the launch checklist in the spec.
