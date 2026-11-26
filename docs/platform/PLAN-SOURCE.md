# Cojam Daily Prediction: source plan (transcribed)

Transcribed from the founder's development plan (Korean, 15 pages, dated 2026-11-26). Budget, schedule and outsourcing pages are left out on purpose. Where this plan and `DECISIONS.md` differ, `DECISIONS.md` wins (see the last section).

## Product
A web app (PWA) where a user answers 5 easy prediction questions every day by swiping, earns points, converts points to CT, competes in a weekly ranking for a CT airdrop, and stakes CT for interest.

## User flow
1. Open and log in.
2. Today's 5 predictions: swipe the card left or right to pick one of two choices. Only the remaining ones are shown again.
3. Completion reward 100P when all 5 are done; a countdown to the next set starts. A new set of 5 opens every 24 hours.
4. Hit reward +50P per correct prediction once the answer is set.
5. Convert 1,000P to 1 CT (minimum conversion 1,000P). Weekly Top 10 get an airdrop.
6. Staking: deposit CT, earn interest by amount and period.

## Screens in the plan (mockups)
- **Home, card view**: header (logo, point balance pill "1,250P"), title "Today's predictions", sub "5 new predictions every 24 hours", view switch (Card view / Terminal view), progress "2/5" with 5 segments, one card per prediction (category chip such as Crypto or Sports, question, note on who sets the answer, two buttons e.g. "Down" / "Up"), hint "swipe left or right to choose".
- **Home, terminal view**: the 5 of today as a list: number, question, category chip, state per row ("chose Up", "Join" button on the current one, "Remaining").
- **Done + countdown**: progress 5/5, check mark, "Today's 5 predictions done", "+100P paid", countdown to the next set (hours : minutes : seconds), note "when answers are set you get +50P per hit", button "See weekly ranking".
- **Weekly ranking**: prize pool card ("This week's pool 1,000 CT"), rows 1 to 10 with masked name or short address, points, CT prize; own rank pinned at the bottom ("27, 1,350P, 750P to Top 10").
- **Staking**: holdings ("1,240 CT"), amount input, lock period selector (30 / 90 / 180 / 365 days), summary (tier, annual rate, expected interest, KRW value), rules line, button "Stake", note "fee sponsored, no gas".
- **Admin (desktop)**: tabs Dashboard, Reward settings, Prediction questions, Answer setting, Ranking. Reward settings form: completion points (100), points per hit (50), conversion rate (1,000P = 1 CT), minimum conversion (1,000P), reward wallet address, weekly pool (number of signed up users x 1 CT), Top 10 split. Question list: publish day, question, choices, state (live, answer set, scheduled); buttons "Assign 5 per day", "Add question".

## Screen principles
- Home shows predictions only.
- Card view or terminal view, user's choice.
- Partly done: show only the remaining predictions.
- All 5 done: show the countdown to the next set.
- New 5 every 24 hours.
- Fee delegation: users pay no gas.

## Feature list
| Area | Feature | Detail |
| --- | --- | --- |
| Account | Login | (plan: email login and wallet connect; replaced, see below) |
| Home | Card view | swipe left or right to pick one of two choices |
| Home | Terminal view | today's 5 as a list |
| Home | Remaining | partly done shows only the rest |
| Home | Countdown | after 5, time to the next set; new 5 every 24 hours |
| Points | Completion reward | 100P for all 5 of a day |
| Points | Hit reward | +50P per correct prediction after the answer is set |
| Points | Token conversion | 1,000P to 1 CT, minimum 1,000P |
| Ranking | Weekly ranking | rank by points earned during the week |
| Ranking | Airdrop | Top 10 get CT by a set split |
| Staking | CT staking | interest accrues per second by amount and period; interest withdrawal and principal withdrawal |
| Admin | Questions | register ahead, assign 5 per day, auto publish at the set time |
| Admin | Answer setting | setting the answer pays the hit points |
| Admin | Reward settings | points, point to token rate, reward wallet, ranking rewards |
| Chain | Fee delegation | Kaia fee delegation, users pay no gas |
| Chain | Contracts | prediction contract and staking contract on Kaia mainnet |
| Platform | UI/UX design | web app and admin in the Cojam brand |
| Platform | PWA | installable like an app |
| Platform | Infra | server, deploy environment, domain |

## Contracts
- **A. Prediction market contract**: points (completion reward, hit reward, conversion record), daily markets (create, join, set answer), payouts (point conversions and the weekly ranking airdrop).
- **B. Basic staking contract**: rate by lock period and amount tier, per second accrual, unlock and payout settings, minimum amount, interest withdrawal, principal withdrawal.
- Architecture: user PWA, then server and admin (question registration and auto publish, answer setting, point and ranking aggregation, fee delegation), then on chain (prediction contract, staking contract, reward wallet funded by Cojam).
- Token: Cojam Token (CT), Kaia mainnet, `0x91cb3B346C80ff965a9667ba6228834dbedD71a2`, 2,000,000,000 supply. Reference price 1 CT = 200 KRW for reward maths.

## Points and rewards (initial values, editable in admin)
- 100P for completing a day's 5; +50P per hit; daily maximum 350P (0.35 CT); 30 perfect days 10,500P (10.5 CT).
- Conversion 1,000P = 1 CT, minimum unit 1,000P.
- Weekly pool = number of signed up users x 1 CT. Top 10 split: 30, 20, 15, 10, 7, 5, 4, 3, 3, 3 percent. Example with 1,000 users: 300, 200, 150, 100, 70, 50, 40, 30, 30, 30 CT.
- Staking annual rates:

| Lock | under 1,000 CT | 1,000 to 9,999 CT | 10,000 CT and more |
| --- | --- | --- | --- |
| 30 days | 8% | 9% | 10% |
| 90 days | 12% | 13% | 14% |
| 180 days | 18% | 19% | 20% |
| 365 days | 25% | 26% | 27% |

- Minimum stake 100 CT. Minimum interest withdrawal 10 CT. Principal withdraws after the lock ends. Example: 1,000 CT for 90 days earns about 32 CT.
- Reward tokens, staking interest funds and gas are deposited by Cojam into the reward wallet.

## Where DECISIONS.md replaces the plan
- Login is Privy social login only: no login form of our own and no external wallet connect.
- Play happens only in the installed PWA. A browser tab (desktop or mobile) shows the install prompt and a link to the swap; the plan's "desktop and mobile web app" no longer applies. The admin stays a desktop web page.
- Answers are set by AI automatically, not by an operations team; question drafting and scheduling are AI driven too.
- Points are on chain and non transferable.
- Gas: sponsored for predicting, staking and point to token conversion; withdrawing assets to another wallet is paid by the user.
- Languages: English source, Korean, Japanese.
