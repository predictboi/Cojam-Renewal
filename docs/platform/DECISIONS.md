# Cojam platform: decisions so far

Founder decisions for the operating platform (recorded 2026-11-26). The development plan from the document session is the scope; this file holds what was decided in chat.

| Topic | Decision |
| --- | --- |
| Scope | Only what the development plan contains. Ignore the concept previews on the landing |
| Where it lives | This repository, a new folder. Served on `app.cojam.app` |
| Play surface | Installed PWA only, mobile first. In an ordinary browser tab (desktop or mobile) the platform shows a PWA install prompt and the existing swap; no play there |
| Swap site | `cojam.app` stays as it is |
| Login | Privy, social login only (no external wallet connect in the PWA) |
| Settlement | On chain contracts on Kaia |
| Gas | Cojam pays for staking, predicting and point to token conversion. Withdrawal (moving assets to another wallet) is paid by the user |
| Market operations | Admin automation: AI drafts and posts markets and sets the answers |
| Languages | English source, Korean and Japanese, each reviewed for native voice |
| Legal | Deferred by the founder |
| Process | Screen spec and development plan drafted by Opus agents, reviewed by Fable; design by Fable in the landing's colours; match needed UI components |
| Sponsored gas with Privy | Verify first whether Privy embedded wallets can sign Kaia fee delegated transactions. If not, users sign a message and a Cojam relayer sends the transaction (contracts designed for that). Same experience either way |
| Deposits | Existing holders send new CT from their own wallet (Kaia Wallet and others) to their Privy wallet address; the PWA needs a deposit screen |
| Answer setting | Fully automatic by AI, no human approval step. Markets are point markets, so the risk is small; a wrong answer is checked afterwards and compensated |
| Points | On chain and non transferable: no transfer, no approve, no transferFrom between holders. Balances change only through the platform contracts (earning, predicting, payouts, point to token conversion) |
| Prediction transactions | One transaction per swipe, sent in the background. The next card shows at once without waiting for confirmation (optimistic). Failed sends retry quietly and surface only if they keep failing |
