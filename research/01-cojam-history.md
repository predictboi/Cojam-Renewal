# Cojam: history of the original project and the old CT token

Research date: 2026-11-12. Web research plus direct reads of the Kaia mainnet (public RPC `public-en.node.kaia.io`). Anything not confirmed by a source is marked "unconfirmed". The source numbers in brackets point to the list at the end.

## Key facts table

| Item | Finding | Source |
|---|---|---|
| Operator | COJAM Limited (코잼리미티드); Korean press calls it an Ireland based company; GitHub lists Hanover House, 85 to 89 South Main Street, Cork | [3][7][12] |
| Product | Social prediction platform: "Quests" (question plus answer choices), users vote with tokens, correct voters share rewards | [3][4][5] |
| Funding | ICO in 2020 via Korean exchanges Flybit (플라이빗) and Foblgate (포블게이트) | [3] |
| Token name / ticker | "Cojam" / CT (some trackers use COJ because CT collides with other tokens) | on chain, [10] |
| Chain | Klaytn, now Kaia mainnet (same chain after the 2024 hard fork). Earlier version ran on Ethereum ERC-20 | on chain, [3][4] |
| Contract | `0x7f223b1607171b81ebd68d22f1ca79157fd4a44b` | on chain, [1][9] |
| Deployed | 2021-03-16 06:56 UTC, block 54,180,489 | on chain |
| Decimals | 18 | on chain |
| Supply | 5,000,000,000 initial; 4,083,262,533.956 CT on chain today (burns reduced it); 4,633,262,533 reported on 2022-09-29 | on chain, [9] |
| Contract controls | Owner `0xeb1622d0377da1f9815bfc6eff61afe3257a0518`; contract has pause and ownership transfer functions; not paused | on chain |
| Exchanges | Flybit and Foblgate (Korea, 2020/2021); MEXC Innovation Zone CT/USDT from 2023-02-08; Klayswap pool (DEX) | [5][6][8] |
| Trading now | None found. CoinCodex lists CT as "not trading" (search snippet: since 2023-12-30); MEXC's CT ticker now belongs to Concrete | [13][14] |
| Price | TokenInsight snapshot about $0.00002997, ATH $0.015912; CMC shows circulating supply 0 | [1][15] |
| Holders | 22,578 addresses with a non zero balance (22,154 hold at least 1 CT), from a full replay of 1,130,634 Transfer events; top 10 addresses hold about 65.6% | on chain |
| Last on-chain CT transfer | 2026-04-17 (block 214,233,735); 2 transfers in that 5M block window, none since | on chain |
| Claimed usage | 20,000+ active wallets, 1M+ transactions (company claim, 2023) | [6][8] |

## 1. What Cojam was

* **Company and team.** COJAM Limited, described in Korean press as a "global prediction platform company based in Ireland" [3][7]. The only named executive found is CTO Angel Jimenez (Madrid; previously EU CEO, then EU Regional Director and CTO) in a February 2021 interview [3]. Founder and CEO names: unconfirmed. Korean community focus: Korean Telegram chats, Korean exchanges, selection for Busan's blockchain venture facility "B-space" in September 2022 [7].
* **Timeline.**
  * 2020: ICO through Flybit and Foblgate; six month beta in the second half of 2020 on Ethereum [3].
  * Early 2021: moved to Klaytn to cut gas costs; Hatch Labs built the Klaytn contracts [3][4]. CT contract deployed 2021-03-16 (on chain).
  * 2021-05-29: CertiK audit passed; 2021-06-01: new platform opened [4]. Later audits by HAECHI and SlowMist are also claimed [11][5].
  * 2021-08-18: partnership with Hunt / Mint Club to expand to BNB Smart Chain [1][7].
  * 2022: NFT platform (artist NFTs, Klip listing), DAO planned for year end [7].
  * 2023-02-03: decentralized beta with personal wallets (Kaikas, Klip) replacing custodial accounts [5].
  * 2023-02-08: MEXC listing, with airdrop events and a Klayswap pool [6][8].
* **How it worked.** Creators or admins posted Quests in six categories (culture and arts, society, competition, crowd problem solving, economy, science) [3][4]. Users staked/voted CT on an answer; deposits and participant counts were recorded on chain; at the announced result time the correct side was rewarded in CT [3][4][5]. Real examples from the official channel: BTS winning the MAMA Grand Prize, NBA match winners, Korean inflation above 0.3%, Korean box office and Netflix rankings [16]. The open source front end (`decentralized-cojam`) shows the Quest lifecycle: pending, approve, addAnswerKeys, adjourn, finish, success, with Sanity as the database and Kaikas/Klip wallet login [12].
* **Token use.** Voting stake, rewards, Quest creation incentives [4][15]. Allocation: platform rewards 25%, reserve 20%, marketing 15%, R&D 10%, team and advisors 10%, sale 10%, operation 5%, partners 5% [9].

## 2. The old token today

* Still live and transferable on Kaia at the same address; metadata reads name "Cojam", symbol "CT", 18 decimals (on chain).
* Distribution (full Transfer replay, balances sum exactly to totalSupply): largest address `0x52c1…0e9d` holds 851.7M CT (20.9%); next `0x9dd3…6b96` 9.9%, `0xb006…2b42` 8.3%, `0xe66f…7b4d` 7.0%, `0xaa13…a8ed` 5.2%. Which of these are treasury, team, exchange or Klayswap wallets is unconfirmed (on chain).
* Activity is minimal: a handful of transfers in December 2025 and April 2026, then nothing through 2026-11-12 (on chain).
* Ticker confusion is real. CoinDesk lists it as COJ because "CT" is used by larger assets [10]; MEXC's CT page now describes Concrete, an unrelated Ethereum token [14]. Any new site must show the full contract address, not only the ticker.
* Delisting: no MEXC delisting notice naming CT was found, but CT no longer trades there and the ticker was reassigned [13][14]. Status on Flybit and Foblgate: unconfirmed. Foblgate drew an FIU on site inspection and a listing fee controversy [17].

## 3. Why it went dormant

No official shutdown or pause announcement was found (unconfirmed). Observable factors:

* **Communication stopped in early 2023.** The global Telegram channel's last real post is from February 2023; in August and September 2026 Telegram posted that the owner had been inactive 17 to 18 months and could lose admin rights [16].
* **Liquidity disappeared** after the MEXC Innovation Zone period (no trading by end of 2023 per CoinCodex) [13].
* **Ecosystem changes.** Ground X cut Klip back inside KakaoTalk in 2024 and sold the Klip business to AhnLab Blockchain Company in March 2025 [18]; Klaytn became Kaia in 2024 [18][19]. Cojam's dApp depended on Klip and Kaikas.
* **Korean regulation tightened.** The Virtual Asset User Protection Act took effect 2024-07-19 and DAXA introduced listing and relisting review standards [20][21].
* Team changes, Irish entity status, and Korean regulatory action against Cojam itself: unconfirmed.

## 4. Official channels

| Channel | Status found |
|---|---|
| cojam.io (site), docs.cojam.io (GitBook) | Did not resolve from the research environment; whether the domain lapsed is unconfirmed [1][9] |
| X @OfficialCojam | Exists; about 1,106 followers [22] |
| GitHub cojam-limited | Public; 6 to 7 repos incl. web, mobile, audit, NFT, decentralized front end [12] |
| Telegram | `cojam_official_chat` (113 members), `cojamchat` (82), `cojam_global` channel (18, owner inactive), `cojamkorea` (37 members, **labelled SCAM by Telegram**) [16] |
| Medium medium.com/cojam-official, Discord, Facebook cojam.limited | Listed by trackers; content not verified [9] |

## 5. Precedents and the Kaia swap

* **Klaytn and Finschia into Kaia (2024).** KLAY became KAIA automatically with no holder action; Kaia is a hard fork of Klaytn and the chain ID is unchanged [19]. Klaytn tokens such as CT kept their addresses (CT still answers at the same address on Kaia). Only FNSA needed a swap: rate 1 FNSA to 148.079656 KAIA, via the Kaia Portal from 2024-08-29, open for one year [23][24]. CEX handling was left to each exchange; holders were told to use only the official portal [25]. **CT therefore needs no chain level swap.**
* **Polygon MATIC to POL (2024-09-04).** 1:1; automatic on Polygon PoS; Ethereum holders used the official portal; most CEXs converted for users [26].
* **Fantom FTM to Sonic S (from 2024-12-18).** 1:1; two way swap for 90 days, then one way only; wallet and exchange guidance conflicted on deadlines, causing confusion [27].
* **Lessons from Aave, Mantle, Aevo, Beam** [28]: open ended windows strand supply (about 2.5% of LEND never migrated); long overlap of old and new tokens caused price gaps (RBN/AEVO); holder exclusions need a vote and a clear process (BitDAO paused and redeployed to exclude Alameda); a rebrand with a credible new purpose helped (Merit Circle to Beam).
* **Common holder concerns.** Tokens stuck on CEXs or dead exchanges; ratio fairness versus team and treasury allocation; hard deadlines; fake "migration" sites and Telegram DMs. Recent examples: fake LEASH V2 migration phishing (2025) and fake Cardano "token upgrade" emails using 30 day urgency [29].

## Open questions for the founder

1. Who controls owner `0xeb16…0518`? Can it pause CT to freeze the old token at the snapshot?
2. Who holds the treasury, reserve, team and reward allocations, and will those be excluded or burned before the swap?
3. Do you control cojam.io, the X account, GitHub, and the Telegram channels (one owner is about to lose admin rights; one group is flagged SCAM)?
4. What is the legal relationship to COJAM Limited (Ireland) and its trademarks?
5. Do Flybit, Foblgate or MEXC still hold user CT? Will they convert on behalf of users?
6. New token chain (stay on Kaia or move), ratio, snapshot block, claim window and what happens to unclaimed tokens?
7. Will Klayswap LP positions and Cojam NFTs be honored?
8. Does the relaunch need Korean legal review under the 2024 User Protection Act and DAXA rules?

## Sources

1. CoinMarketCap, Cojam: https://coinmarketcap.com/currencies/cojam
2. Kaia public RPC reads (name, symbol, decimals, totalSupply, owner, paused, getCode, Transfer logs): https://public-en.node.kaia.io
3. 대한경제, CTO interview, 2021-02-15: https://www.dnews.co.kr/uhtml/view.jsp?idxno=202102151459587110121
4. Bloomingbit, new platform, 2021-06-06: https://bloomingbit.io/feed/news/9911
5. 파이낸셜포스트, decentralized beta, 2023-02-02: http://www.financialpost.co.kr/news/articleView.html?idxno=164606
6. TheBigData, MEXC listing, 2023-02-07: https://www.thebigdata.co.kr/view.php?ud=2023020710100724839aeda69934_23
7. Discovery News, B-space, 2022-09-15: https://www.discoverynews.kr/news/articleView.html?idxno=876535
8. MEXC listing notice: https://www.mexc.com/support/articles/15239060327193 and M-Day notice https://www.mexc.com/support/articles/15190989388569
9. CoinCarp project info: https://www.coincarp.com/currencies/cojam/project-info/ ; Cojam docs token page (indexed, not reachable): https://docs.cojam.io/cojam/tokenomics/token-information
10. CoinDesk, Cojam (COJ): https://www.coindesk.com/price/coj
11. MEXC Blog, What is Cojam, 2023-02-06: https://blog.mexc.com/what-is-cojam-ct-creator-wilbur
12. GitHub cojam-limited: https://github.com/cojam-limited and https://github.com/cojam-limited/decentralized-cojam
13. CoinCodex, Cojam: https://coincodex.com/crypto/cojam
14. MEXC token page for ticker CT (now Concrete): https://www.mexc.com/tokens/CT
15. TokenInsight, Cojam: https://tokeninsight.com/en/coins/cojam/overview
16. Telegram: https://t.me/s/cojam_global , https://t.me/cojam_official_chat , https://t.me/cojamchat , https://t.me/cojamkorea
17. Foblgate inspection / listing fee reports: https://www.blockmedia.co.kr/archives/307567 , https://www.wikileaks-kr.org/news/articleView.html?idxno=116077
18. Byline Network, AhnLab Blockchain Company acquires Klip, 2025-03-31: https://byline.network/2025/03/31-236/
19. Kaia transition FAQ: https://docs.kaia.io/misc/kaia-transition/faq-chain-transition/
20. FSC, User Protection Act effective 2024-07-19: https://fsc.go.kr/eng/pr010101/82683
21. crypto.news, DAXA listing and relisting guidelines: https://crypto.news/korean-daxa-releases-guidelines-for-listing-and-relisting-crypto-assets/
22. AlphaGrowth, Cojam community stats: https://alphagrowth.io/communitytoken/community
23. Kaia docs, Finschia to Kaia: https://docs.kaia.io/misc/kaia-transition/finschia/
24. Kaia blog, FNSA to KAIA swap guide, 2024-08-28: https://blog.kaia.io/fnsa-kaia-swap-and-fnsa-on-chain-contribution-reward-guide/
25. Kaia blog, swap preparations, 2024-07-15: https://blog.kaia.io/preparations-for-the-upcoming-kaia-chain-token-swap/
26. The Block, MATIC to POL: https://www.theblock.co/post/314595/polygon-developers-transition-matic-token-to-pol ; Polygon docs: https://docs.polygon.technology/pos/concepts/tokens/
27. Sonic migration docs: https://docs.soniclabs.com/migration/overview ; Exodus: https://www.exodus.com/support/en/articles/9880651-fantom-ftm-migration-to-sonic-s
28. Decentralised.co, On Token Migrations, 2024-07-01: https://www.decentralised.co/p/on-token-migrations
29. U.Today, LEASH scam warning: https://u.today/shiba-inu-team-issues-urgent-warning-on-leash-ecosystem-token-scams ; PCrisk fake migrate.fun: https://www.pcrisk.com/removal-guides/34737-fake-migrate-fun-website-scam
