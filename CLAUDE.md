# Cojam Renewal: working notes for Claude sessions

Read `docs/HANDOFF.md` once per session for the full method (review loop, migration spec, pitfalls, video pipeline).
This file holds what is specific to Cojam and overrides the handoff where they differ.

## Working agreements

- Talk to the founder in Korean: complete sentences with particles and endings, no noun phrase endings, no em dash, precise Sino Korean vocabulary.
- Every deliverable is in English (UI copy, docs, specs, code comments). The site ships an EN / KO / JA toggle; English is the source text.
- No dash punctuation as a sentence break anywhere (" - " or " — "). Use a colon, a comma, a conjunction or two sentences. List bullets are fine.
- Work fast: run independent work in parallel (at most 5 agents), fix small things without asking, ask only when a wrong guess is expensive.
- Big deliverables: show the structure in one message, get a yes, then build without stopping.

## Brand (confirmed so far)

| Field | Value |
| --- | --- |
| Name | Cojam (capital C, rest lower case) |
| Primary | `#124CC4`, text on it is white (7.35:1) |
| Secondary candidates | `#3E58E3` (app background blue), `#97DBFF` (sky) |
| Logo | `brand/logo/cojam-mark.svg` (centred geometry, confirmed). `cojam-mark-original.svg` is archive only |
| Type | Pretendard Variable for EN and KO, Pretendard JP Variable for JA (switched by `:lang(ja)`), tabular numerals (confirmed) |
| Chain | Kaia mainnet (chain id 8217) for both old and new token |
| Positioning | "The OG prediction market, since 2019." The landing also previews the future Cojam platform as clearly labelled concept mockups: predict with the token, derivatives on outcomes, loans against positions, margin on predictions |
| Migration | Open swap at 0.2 new CT per old CT (5 old CT give 1 new CT, rounded down to the base unit; changed from 0.4 on 2026-11-15), old CT to new CT, no rewards or incentives, every address treated the same (no exclusions; much of the supply sits on exchanges). On each swap 10% of the credited new CT arrives instantly; the other 90% is locked 7 days and then released to the holder (permissionless release: a team keeper bot sends it, the holder can also claim). Purpose of the lock: deter swap abuse and favour real holders. The window is 1 year starting at the swap contract's deploy time; after it no new swaps (locked remainders still release). The whole new supply is minted to the founder's master wallet, which funds the swap contract by plain transfers; a swap only succeeds while the contract holds enough new CT not owed to earlier lots. The master can withdraw that unowed reserve at any time (never tokens owed to locked lots); nothing else is privileged: no owner, no pause. The master is an ordinary wallet (an EOA, by the founder's choice), so its key must be protected |
| New token | Name "Cojam Token", ticker CT (kept). The most basic token: standard ERC-20 functions only (KIP-7 compatible at the ERC-20 level), 18 decimals (decided 2026-11-14 over 9), no permit, no burn, no recall, no pause, no blacklist, no mint, no owner powers, so it stays listing neutral. **Live on Kaia mainnet since 2026-11-14: `0x91cb3B346C80ff965a9667ba6228834dbedD71a2`** (tx `0x6a32eda13a0d46d9df6fd7e7964e9ce5b15373051948f5b9a07ef6f49924a1c0`, block 232473494, Sourcify exact match), the whole 2,000,000,000 CT held by the master. Deployed alone through Render `cojam-ops` (`OPS_TASK=deploy-token`); the swap is not deployed yet, so the window has not started. `contracts/scripts/deploy-mainnet.js` now reuses this token and deploys only the swap (fork dry run passed). Fixed supply of exactly 2,000,000,000 CT (2_000_000_000 x 10^18 base units), minted to the master; at 0.2 it covers the whole current old supply (4,083,262,533.9560001 old CT need about 816,652,506.79 new CT). In UI copy say "old CT" and "new CT" and always show full addresses |
| Gasless | Kaia native fee delegation: a Cojam gas wallet (hot, KAIA only, low balance, topped up from the treasury) pays the network fee for approve, swap and claim; holders need no KAIA with Kaia Wallet. MetaMask cannot sign Kaia fee delegated tx, so MetaMask users pay their own small fee. The same gas wallet is the keeper that releases the 90% after unlock. Backend in `server/` (fee payer API and keeper), spec in `docs/FEE-DELEGATION.md` |
| Old token admin | The team does NOT control the old owner key; the founder accepts this and focuses on the new token. No snapshot fallback planned |
| Reserve after window | No automatic sweep: the master withdraws the unowed reserve with `withdraw(amount)` whenever it decides, during or after the window (locked lots are never touched). Wallet map: token contract (no powers), master wallet (an EOA by the founder's choice; receives the whole supply, funds the swap, the only address that can withdraw the unowed reserve; never the old owner; protect its key), swap contract (holds the funded reserve, the owed lots and the received old CT forever), deployer EOA (gas only, holds nothing) |
| Open decisions | Launch date, domain, master EOA key custody, funding plan (full supply at once or tranches; the master can withdraw the unowed reserve at any time), late migration policy |
| **LAUNCHED** | New CT live 2026-11-14. Launch swap (rate 1/5) `0x7879F0a137Eae8E45EB670e9ac7BB08C5DfADb84` deployed 2026-11-15 15:24:52 UTC (block 232552030, tx `0x0085c193b35706ebfca32e0f1546e331c541c0834b8704e87eac780a52899f6a`, 7 day lock, Sourcify exact match). Window ends 2027-11-15 15:24:52 UTC. The first launch swap `0x8a5356f0207f374D1E04BB03Dedac87A43246060` (rate 0.4) was never funded or used and is retired: never fund it. Site (`network.js` ACTIVE "kaia") and gas API (`render.yaml` CHAIN_ID 8217) run on mainnet. Private 1 minute test swap `0x197e08ba085Ee1171AfD2fd7263cF14Db403FBbD` (old 0.4 code) stays reachable at `?net=kaia-test` |
| Mainnet wallets | Recorded in `contracts/deployments/wallets.mainnet.json` (addresses only): master `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb`, deployer `0xB18149317Bf633F5Dc2a6044a11103D580cA4a33`, fee payer `0xB3CB36B4faE25a0661E2dDD5eca59e18B53152da`, pool `0x487939b5557B995C90f2e943104A31f900f3e0F2`. Keys: master and pool in the founder's wallet apps only; fee payer key only in Render; deployer key only as `DEPLOYER_PRIVATE_KEY` in the Claude cloud environment, removed after the deploy. Mainnet deploy: `contracts/scripts/deploy-mainnet.js` (dry run with `FORK_DRY_RUN=1` passed 2026-11-14). The swap window starts at deploy, so deploy on launch day only, after the audit |
| Pool | DGSwap v3 CT / KAIA (WKLAY) 0.1%: `0x969e56b6c8bdcac45027a71485f528687845e48d`, created 2026-11-14 with about 2,000 KAIA and 400 new CT at 5 KAIA per CT (about 200 KRW). Site price: `CJ.config.pool.link` in `system.js`, GeckoTerminal first, on-chain slot0 times the KAIA USD price as fallback (`price.js`) |
| Domain | `cojam.app` (bought 2026-11-14). Site on `cojam.app` (www redirects to it), gas API on `api.cojam.app`. Setup steps in `docs/RENDER-SETUP.md`. X and Telegram come later |
| Deploy | Render static site from `site/` via `render.yaml` |
| Old token | "Cojam" (CT), Kaia (formerly Klaytn), `0x7f223b1607171b81ebd68d22f1ca79157fd4a44b`, 18 decimals, supply 4,083,262,533.9560001 after burns, owner `0xeb1622d0377da1f9815bfc6eff61afe3257a0518`, pausable, not paused (checked on chain 2026-11-12). Ticker CT is now reused by other tokens on MEXC: always show the full address. Details in `research/01-cojam-history.md` |
| Everything else | TBD: see the Brand sheet in `docs/HANDOFF.md` section 2 and `brand/BRAND.md` |

Colour rules learned so far: `#124CC4` and `#3E58E3` sit at 1.3:1 against each other, so never put one on the other for text or the mark. `#97DBFF` fails as text on white (1.5:1) but works as text on a dark ground (12.6:1). The blue mark on a near black ground is only 2.6:1: give it a light tile or a ring there when it must read at small sizes.

## Repository map

- `site/`: what Render serves (`assets/cojam-mark.svg` is the official mark). `assets/base.css` (tokens), `assets/i18n.js` (EN / KO / JA dictionary and toggle).
- `brand/`: logo files and `BRAND.md`.
- `research/`: market and project research that feeds planning.
- `docs/HANDOFF.md`: method carried over from the previous project.
- `tools/design/`: `shot.js` (captures) and `audit.js` (contrast, targets, overflow, accent use; `AUDIT_ACCENT` defaults to `#124CC4`; extra shell files via `CJ_EXTRA_CSS` and `CJ_EXTRA_JS`).
- `tools/video/`: video pipeline scripts; set `VIDEO_ROOT` to the working folder before use.
- `.claude/skills/`: ui-ux-kit skills (impeccable, hallmark, web-design-guidelines, redesign-existing-projects, animate, motion-design).

## Live site wiring

- `site/assets/network.js`: the active network (`ACTIVE = "kaia"`, mainnet since 2026-11-14) and every address; `?net=kairos` / `?net=kaia-test` switch for testing (remembered in the browser).
- `site/assets/chain.js`: live wallet connect (EIP-6963, Kaia Wallet, MetaMask), reads, approve, migrate, claim, fee delegation through `api.cojam.app`. `site/assets/live-stats.js`: live figures for status and admin.
- `?mock=1` or any `?state=` preset keeps the mock ledger for design review. E2E against Kairos: `node tools/e2e/live-swap.js`.
- Asset URLs carry `?v=YYYYMMDD`; bump it on a release that must reach visitors at once (assets revalidate every 5 minutes anyway).

## Local preview

`python3 -m http.server 8811 -d site` then open `http://localhost:8811/?lang=ko`.

## Design skill order

hallmark or frontend-design for direction, build, impeccable or unslop to polish, web-design-guidelines and design:accessibility-review to check, then the independent reviewer loop from the handoff. Load a skill only after the content is gathered.
