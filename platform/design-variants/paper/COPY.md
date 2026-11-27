# Copy: what is on the surface and where the rest went

Founder feedback: too much text and explanation; screens could not be taken in at a glance. This pass applies one rule to every screen and state except home (which stays as it is).

## The rule

1. A screen answers one question with one figure or one action.
2. Labels are 1 to 3 words.
3. At most one short supporting line per section, and only if the player cannot act without it.
4. Sentences that restate the obvious, repeat a label, describe how the product works or reassure are not on the surface.
5. Explanations are one tap away behind a small "?" (`C.q(id)` in `assets/app.js`) that opens a short sheet (`App.info[id]`). Nothing was deleted from the product: every removed fact is in a sheet or in a closed disclosure.
6. Short labelled facts before sentences, and never a bare symbol: a value always carries a plain word label of 1 to 3 words ("Lock 90 days", "13% a year", "Day 22 of 90", "Min. claim 10 CT", "1,000P = 1 CT", "+50P at 22:10", "Answer at 21:00"). Facts are set in the text face without a frame; a frame means a control.
7. Critical facts stay prominent, in ink and bold, not as chips: "Locked until Feb 25, 2027. No early exit." on staking and in its review sheet, that rates are yearly ("Rate a year" over the options), who pays the fee ("No fee: Cojam pays" under the action, "Fee: you pay" on hold and on withdraw), and on a finished withdrawal the destination address and the balance left.
8. Errors and blocked states keep one plain line that says what to do. Empty states keep one line and one action.

The shared dictionary `assets/i18n.js` is unchanged. Short labels added for this pass are in `assets/paper-i18n.js` (`pp.*`), written in EN, KO and JA.

## Visible words per screen (before and after)

Counted by `node tools/word-count.js` with `Intl.Segmenter` (word-like segments) in the content area and any pinned bar; the masthead, the dateline and the tab bar are not counted. "Before" is the state of the folder before this pass (`captures/words-before.json`), "after" is `captures/words-after.json`.

| Screen | EN before | EN after | EN cut | KO before | KO after | KO cut | JA before | JA after | JA cut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Wallet | 63 | 33 | 48% | 66 | 39 | 41% | 77 | 37 | 52% |
| Convert | 50 | 27 | 46% | 48 | 27 | 44% | 61 | 27 | 56% |
| Profile | 93 | 41 | 56% | 87 | 43 | 51% | 112 | 43 | 62% |
| Invite | 170 | 68 | 60% | 148 | 63 | 57% | 225 | 76 | 66% |
| Staking, new stake | 59 | 39 | 34% | 65 | 53 | 18% | 74 | 48 | 35% |
| Staking, my stakes | 92 | 61 | 34% | 107 | 78 | 27% | 111 | 81 | 27% |
| Results | 405 | 281 | 31% | 410 | 264 | 36% | 506 | 345 | 32% |
| Ranking | 116 | 104 | 10% | 116 | 103 | 11% | 125 | 109 | 13% |
| Day done | 130 | 110 | 15% | 130 | 113 | 13% | 156 | 129 | 17% |
| Log in | 72 | 30 | 58% | 62 | 23 | 63% | 88 | 36 | 59% |
| First run, page 1 | 40 | 31 | 22% | 34 | 29 | 15% | 50 | 40 | 20% |
| First run, page 2 | 39 | 28 | 28% | 37 | 24 | 35% | 50 | 37 | 26% |
| First run, page 3 | 40 | 17 | 58% | 34 | 18 | 47% | 47 | 24 | 49% |
| Wallet, on hold | 97 | 60 | 38% | 96 | 64 | 33% | 113 | 69 | 39% |
| Staking, on hold | 72 | 62 | 14% | 69 | 66 | 4% | 91 | 79 | 13% |
| My stakes, on hold | 174 | 124 | 29% | 192 | 146 | 24% | 208 | 160 | 23% |
| Convert, on hold | 63 | 45 | 29% | 58 | 40 | 31% | 74 | 48 | 35% |
| Invite, on hold | 164 | 101 | 38% | 131 | 81 | 38% | 202 | 112 | 45% |
| Home, card view (unchanged) | 51 | 52 | | 56 | 58 | | 78 | 81 | |
| Home, list view (unchanged) | 90 | 91 | | 94 | 96 | | 128 | 131 | |

New in this round, so there is no "before": Deposit 36 / 37 / 52, Withdraw 30 / 29 / 36, Gate (Android) 81 / 72 / 110, Account on hold explanation 118 / 108 / 155 (EN / KO / JA).

Target check: the aim was a cut of at least 40% on the money, profile and invite screens. Wallet, convert, profile and invite reach it in all three languages. **Staking (34%, 18%, 35%) and my stakes (34%, 27%, 27%) do not.** After review A the cut is deliberately smaller there: shorthand such as "90d" or "≥ 10 CT" was replaced by labelled facts, and the lock sentence is back in full. What is left is the required facts: the amount, the four periods with their yearly rates, the lock date and "No early exit", who pays the fee, and per stake the amount, lock, rate, state, the two dates, the day count and the interest. The Korean count is higher because the segmenter counts particles and counters as separate words. Results is long because it lists four days of five questions; the question texts are most of the words. Home went up by one word: the source line now ends with the word "Rules".

## Where each explanation went

| Screen | Removed from the surface | Now |
| --- | --- | --- |
| Wallet | "Only needed to withdraw CT to another wallet." under KAIA | "?" beside KAIA: sheet `kaia` ("Why KAIA") |
| Wallet | "1,000P = 1 CT. You can convert 1 CT now." | The labelled fact "1,000P = 1 CT"; the minimum and the fee are in "?" beside Points: sheet `points` |
| Wallet | "On the way" tag and "+50P, lands about 22:10" | The labelled fact "+50P at 22:10" |
| Wallet | "Get 10% of the points they earn" under the invite row | The invite screen |
| Wallet | "Your wallet address (Kaia)" | Label "Address" |
| Wallet | "Updated 6s ago" on the dateline | Removed (shown only when the balance could not be refreshed) |
| Wallet, on hold | "Converting is paused while your account is on hold." under the button; the KAIA sentence | The hold notice says it once; "Fee: you pay" on the KAIA row |
| Staking | The "How staking works" disclosure with the rate table | "?" beside the title: sheet `staking` |
| Staking | "Locked until Feb 25, 2027. No early exit." | Kept, as its own line in ink and bold with the lock icon (it is the one condition that cannot be undone) |
| Staking | "No fee: Cojam pays the network fee." under the button | "No fee: Cojam pays" under the button (the full sentence is in sheet `staking`) |
| Staking | Nothing said the rates are yearly | "Rate a year" over the four options |
| Staking | "1,000 CT or more earns +1%" | "+1% from 1,000 CT" |
| My stakes | "Interest so far (CT)", "Claimable now (CT)" | "Earned", "Claimable" |
| My stakes | "90 days at 13%" | "Lock 90 days" and "13% a year" |
| My stakes | "Started Nov 6", "Unlocks Feb 4" | The two dates at the ends of the bar, "Day 22 of 90" between them (the sentence stays in the bar's `aria-label`) |
| My stakes | "You can claim from 10 CT. 2.52 CT to go." | "Min. claim 10 CT" |
| My stakes | "500 CT stake + 3.2877 CT interest" under Withdraw | The button names the total; the two parts are in the review |
| My stakes, on hold | "You pay the network fee in KAIA (about 0.0021 KAIA)" | "Fee: you pay" and "about 0.0021 KAIA" under each action |
| Convert | The four rule rows (rate, minimum, daily limit, fee) | Three labelled facts (Rate, Fee, Left today), "Points left" under the figure, and "?" beside "You get": sheet `convert` |
| Convert | "Converting does not change your weekly rank." | Sheet `convert` |
| Convert | "Points to convert" | "Points" |
| Deposit | "Send new CT or KAIA to this address on the Kaia network." | The Network and Token rows; the sentence is in "?" beside Address: sheet `deposit` |
| Deposit | The warnings about old CT and exchanges, the token contract | Sheet `deposit`. One warning stays: "Send only on Kaia. Tokens sent on another network can be lost." |
| Withdraw | "Withdrawals are not sponsored. You pay a small network fee in KAIA." | "Fee: you pay" on the fee row and "?" beside "Your KAIA": sheet `withdraw`. The success sheet now shows the destination address and the balance left |
| Profile | "Logged in as" | The email with a mail icon |
| Profile | "Get 10% of the points they earn" | The invite screen; the row now says "4 friends joined" instead of a bare count |
| Profile | "Ready to play on this device" and "until Dec 27, 2026" | "This device" with a check; the sentence and the date are in "?": sheet `device` |
| Profile | "Shown to everyone on the weekly ranking. Leave empty to show your short address." | "?" beside the field label: sheet `name`. A line appears under the field only when the name has an error |
| Profile | The Help section with four links | One row "Help" that opens a sheet with the four links |
| Profile | "Check for update" | The version line is the control |
| Invite | "Paid the moment they earn it. Nothing is taken from your friend." | "?" beside the headline: sheet `invite` |
| Invite | "How it works" (three steps) and "Good to know" (four rules) | Sheet `invite` |
| Results | "All 5 answered: +100P, +50P pending" under each day | The total and the five marks |
| Results | "Markets" and "You: Yes" | The pick with its colour block |
| Results | "Waiting, 09:00" | "Answer at 21:00" with the dashed waiting mark (the same mark as in the legend and beside the day), and "+50P if hit"; how hits are paid is in "?" beside the title: sheet `hits` |
| Results | "0P" under a miss | The stamp |
| Results | "10% of your friends' points. Not counted in the ranking." | The invite sheet |
| Ranking | "Same points: whoever got there first ranks higher." | The "How prizes work" sheet (it was already repeated there) |
| Ranking | "Ranks 26 to 28" beside "Around you" | The rows show their ranks |
| Day done | "+100P added to your points" | The figure and the "Paid" stamp (the sentence stays for screen readers) |
| Day done | "Answers are set within 48 hours." and "Each right pick pays +50P about 6 hours later." | "?" beside "5 waiting for answers": sheet `hits` |
| Log in | "Cojam makes your Kaia wallet for you." | "?" beside Email and the "What is the Cojam wallet?" disclosure |
| Log in | "Works with Gmail, Naver, ..." | "?" beside Email: sheet `email` (it also appears with the error when an address is not supported) |
| Log in | "No code? Check your spam folder." | Removed from the code step (resend is the action) |
| Log in | (the three facts stay under the form: they say what the app is) | |
| First run | Two sentences per page | One line per page (`pp.o1` to `pp.o3`) |
| First run | The help line under the invite code field | Shown only as an error or a confirmation |
| Empty states | The second sentence (my stakes) | The title and one action |
| Gate | "Swap old CT for new CT first, at cojam.app." | The heading "Holding old CT?" and the button |

## The sheets behind "?"

| Id | Title | Holds |
| --- | --- | --- |
| `kaia` | Why KAIA | What KAIA is needed for; withdrawals are not sponsored |
| `points` | How points become CT | Rate, minimum, fee; converting does not change the weekly rank |
| `convert` | Conversion rules | Rate, minimum, daily limit, fee, steps of 1,000P, the rank rule |
| `staking` | How staking works | How rates are set, the fee, the rate table, the 10 CT claim minimum |
| `deposit` | Before you send | What to send, the three warnings, the token contract (do not send to it) |
| `withdraw` | About the fee | Who pays and in what |
| `hits` | How answers are set | When answers are set, when hit points are paid, the three steps |
| `invite` | How it works | The three steps, when the bonus is paid, the four rules |
| `email` | Which emails work | The providers, and that Cojam makes the wallet |
| `name` | Name in the ranking | Where the name shows and what an empty name does |
| `device` | This device | That this device is ready to play, and until when |
| `prizes` | How prizes work | The pool, the tie rule, who qualifies, the split (opened from the ranking) |
