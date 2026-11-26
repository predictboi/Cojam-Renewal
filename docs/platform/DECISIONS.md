# Cojam platform: decisions so far

Founder decisions for the operating platform (recorded 2026-11-26). The development plan from the document session is the scope; this file holds what was decided in chat.

| Topic | Decision |
| --- | --- |
| Scope | Only what the development plan contains. Ignore the concept previews on the landing |
| Where it lives | This repository, a new folder. Served on `app.cojam.app` |
| Play surface | Installed PWA only, mobile first. In an ordinary browser tab (desktop or mobile) the platform shows a PWA install prompt and the existing swap; no play there |
| Swap site | `cojam.app` stays as it is |
| Login | Privy, email login only (one time code to the email address). No social providers, no external wallet connect (changed from social login on 2026-11-26) |
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
| Play key | Adopted: the Privy wallet authorises a local play key once; swipes are signed locally by that key, which can only predict |
| Review defaults | Every proposed default in `REVIEW.md` section B is accepted: 09:00 KST day and Monday week boundary, hit points about 6 hours after the answer, wrong answers compensated and never clawed back, the anti abuse package, qualified players and a 10,000 CT weekly pool cap, staking rules and reserved interest, KRW shown in Korean only, no notifications at launch |
| Owner key | The existing master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb` owns both platform contracts |
| Schedule | Ignore the plan's dates: build as fast as possible with the founder in the loop |
| Deploy | Render; DNS on Cloudflare |
| Still open | Reward funding amounts at launch (conversions, airdrops, staking interest); external audit before mainnet |
| Email allow list | Email only login stays. Sign up is limited to an allow list of major mail providers (for example gmail.com, naver.com, kakao.com, daum.net, hanmail.net, icloud.com, outlook.com, hotmail.com, yahoo.co.jp; editable in the admin); other domains see a clear message. Addresses are normalised before the check (lower case, Gmail dots and plus tags removed, plus tags removed elsewhere) and one normalised address is one player. Enforced by the server before a wallet is registered as a player, whatever Privy itself allows |
| Abuse blocking | Launch with email login and the allow list; no phone verification for now. A recurring job (hourly, and at every sign up) checks new and existing accounts for abuse patterns: many sign ups from one network or device, sign up bursts, look alike addresses, identical answer sequences and timing, accounts that only convert. Accounts above the threshold are blocked automatically (frozen on chain: no predicting, no conversion, no airdrop, no sponsored gas); borderline ones go to a review list in the admin. The admin shows every blocked account with the reason and can unblock it; both blocking and unblocking are done with the operator key (no master wallet signature). Points already earned are not debited |
