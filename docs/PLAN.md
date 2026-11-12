# Cojam relaunch: prototype plan

Approved structure (2026-11-12). Every page is plain HTML, CSS and JS against mock state; no chain calls yet.

## Facts the copy relies on

- Cojam: the OG prediction market, since 2019 (founder's claim; keep the wording exactly).
- Old token: Cojam (CT) on Kaia, `0x7f223b1607171b81ebd68d22f1ca79157fd4a44b`, 18 decimals.
- New token: Cojam Token (CT) on Kaia, fixed supply 4,083,262,533.956 CT, plain token with no admin powers. Address: not deployed yet, show "To be announced".
- Swap: 1:1, open to every holder, no rewards. Each swap locks the new CT for 7 days; after that the holder claims it. The window is 1 year from launch; after it no new swaps, but locked swaps can still be claimed.
- Gas is paid in KAIA. Wallets: Kaia Wallet, MetaMask (Kaia network added), WalletConnect.
- CT held on an exchange: the exchange handles it (list "to be announced"). CT in a Klayswap pool: remove liquidity first.
- Never invent numbers, partners, audits or quotes. The audit status is "Audit in progress" until a report exists. Dashboard figures in the prototype are labelled "Sample data".

## Site map

| Path | File | Purpose |
| --- | --- | --- |
| `/` | `site/index.html` | Landing: hero, how the swap works (swap, 7 day lock, claim), timeline, contract addresses, future platform concept previews, FAQ |
| `/migrate/` | `site/migrate/index.html` | The swap app: every state below |
| `/status/` | `site/status/index.html` | Public dashboard: swapped, locked, claimed, holders swapped, reserve left, time left, recent swaps |
| `/docs/` | `site/docs/index.html` | Help: step by step guide, wallets, exchange and pool cases, lock rules, safety, contracts and audit |

## Shared foundation (do not fork it)

- `site/assets/tokens.css`: every colour, font, size, radius. No literal colour or font outside it.
- `site/assets/base.css`: shared components (buttons, fields, panels, tables, chips, help popovers, toasts, skeletons, the swap track, address rows).
- `site/assets/system.js`: `CJ` global: config, mock ledger in localStorage (`?reset=1`), mock clock (`?days=8` moves time forward), formatters, amount parser, i18n engine (`CJ.t`, `data-i18n`).
- `site/assets/shell.js`: safety banner, header (nav, language toggle, wallet chip on `/migrate/`), footer. Injected on every page.
- `site/assets/i18n/<page>.js`: one dictionary file per page (`shell`, `landing`, `migrate`, `status`, `docs`), each `CJ.dict({en:{...},ko:{...},ja:{...}})`. English is the source.

## Signature element: the swap track

One horizontal track with three stops: Swap old CT, 7 day lock (seven ticks that fill day by day), Claim new CT. It carries the amount and the dates. It appears in the landing hero, on every lot in the app, on the success state and on the dashboard (aggregate). Build it once in `base.css` and `system.js` (`CJ.track(el, lot)`).

## Swap app states (all reachable by use and by `?state=`)

1. `disconnected`: explainer, ratio, lock, window, addresses, Connect wallet.
2. `wrong-network`: one button to switch to Kaia.
3. `empty`: connected, no old CT; links to exchange, pool and FAQ cases.
4. `ready`: amount field (default full balance, Max), "You will receive" (same amount, 1:1), unlock date, gas estimate in KAIA, balance next to the field.
5. `approve`: steps "1 Approve, 2 Swap", one line on why approval exists.
6. `wallet`: waiting for the wallet, Cancel.
7. `pending`: tx link, elapsed time, safe to close note.
8. `locked`: success; the lot is locked, unlock date and countdown on the swap track, Add new CT to wallet.
9. `claimable`: lock ended, Claim button; `claimed`: done with tx link.
10. Errors inline with the fix as a button: `rejected` (nothing was sent), `no-gas`, `closed` (window ended; claims still work), `reserve` (reserve empty), `rpc` (Retry), `partial` (approved but not swapped: resume at step 2).
11. History: every lot for this wallet with status (locked, claimable, claimed).

## Copy rules

Say what happens ("Swap 12,500 old CT", "Claim 12,500 new CT"). Units on every figure. Human dates ("Unlocks Dec 8, in 7 days"). Help popover on ratio, approval, gas, lock, reserve. Sentence case, no tracked capitals, no middle dot separators, no dash as a sentence break.

## Design floor

Light ground, white panels, one accent (`--brand`) for the primary action and the current selection only. Sky (`--sky`) is the data colour for new CT. Green and red only for gain and loss; amber only for time pressure and warnings. One primary button per view. Text at 4.5:1 or more. Visible focus. Touch targets 44 px. `prefers-reduced-motion` respected. Never `transition: all`. `overflow-x: clip` on html and body. No card inside a card. The future platform section uses the dark tokens (`--night-*`) to set the concept apart from the live swap, and every mockup carries "Concept preview, not live".
