# Cojam Daily: independent UX review

Date: 2026-11-28. Build: mock build served at `http://localhost:4190` (version 1.0.3 shown in Profile).
Method: the product was operated in a mobile Playwright context (isMobile, hasTouch) with real touch drags, taps and typing, at 390x844 and 360x640, in English and Korean. Every route and `?state=` preset listed in `e2e/walk.cjs` was captured at both sizes and in both languages (178 states per size and language, no page errors, no touch target under 40 px). The live flows (login, first run, five picks, Undo, day done, withdraw, convert, stake, stake withdrawal, profile, invite, the ways out of error states) were then driven step by step and read after each step. The install gate was also opened with Android Chrome, Samsung Internet, iPhone Safari, iPhone Chrome, KakaoTalk and desktop user agents.

Owner constraints were respected and are not penalised: little visible text, the 3 second Undo, one closing time for all five questions, results on the next day, English by default, sample data.

Totals: Nielsen 30 / 40. Problems: 1 blocker, 9 major, 19 minor.

---

## 1. Journey accounts

### Journey 1: new player

Steps and taps (happy path, 390x844, EN):

| Step | Taps | What happens |
| --- | --- | --- |
| Install gate | 1 (Android "Install Cojam") or 3 manual steps (iPhone) | Gate adapts correctly to the user agent: Android Chrome and Samsung Internet without an install prompt get the three menu steps, iPhone Safari gets Share steps, iPhone Chrome gets "open in Safari" plus Copy link, KakaoTalk gets "Open in browser", desktop gets a QR code |
| Login, email | 1 (type, Send code) | Empty, typo ("Did you mean gmail.com?") and unsupported provider are all handled inline |
| Login, code | 0 (auto submits on the sixth digit) | Setup steps show, then the first run opens while setup finishes in the footer |
| First run | 3 (Next, Next, Start predicting) or 1 (Skip) | Three slides, language choice and invite code only on slide 1 |
| Five picks | 5 (swipe or tap) | Undo bar for 3 seconds after each pick, then "Saving", "Saved" |
| Day done | 0 to 1 ("Finish now") | +100P, "Paid" stamp, list of today's picks |
| Next | 1 | Primary action "See weekly ranking", link "See results" |

Shortest path from the app icon to the first pick: 6 taps plus typing an email and a code. The whole day takes about 40 seconds. This is very good.

Friction and misreads:

1. Login: the "Terms" and "Privacy Policy" links under "By continuing you agree to" lead nowhere (`#terms`, `#privacy`). Tapping them changes nothing. A person who checks what they agree to before making a wallet stops here.
2. Login headline "Log in to play" is the only headline for a person who has no account. That the same step creates the account and the wallet is only in the collapsed "What is the Cojam wallet?".
3. First run: the invite code is a collapsed link on slide 1 only. The gate told an invited iPhone player "enter it when you start", but "Skip" in the header or two taps on "Next" pass the only place to enter it. (On Android the saved code is prefilled, which is good; on iPhone the installed app does not share storage with Safari.) When the code panel is open there are two "Skip" links on one screen with different meanings. With an unknown code in the field, "Next" does nothing visible (the focus only moves back to the field).
4. First run: slide 3 says "1,000P becomes 1 CT". The 7 day wait before the first conversion and the daily limit are not mentioned on any slide. The first time a new player learns it is on the Convert screen.
5. First run has no way back to an earlier slide (no swipe, the system back leaves the first run).
6. First card: the two second read works. The question, the two answers, "+50P if right. Undo for 3 seconds." and the swipe hint are all on the surface. "Rules" opens the source, the time and the finality rule.
7. Undo: clear and well placed. After the window the bar reads "Saving Q1: Yes" and then "Saved Q1: Yes", which answers "did it count?".
8. Fifth pick: the page changes at once to the day done screen with "Finishing in 3" and a primary button "Finish now" while Undo sits at the bottom right. "Finish now" is not self explaining (finish what?). For about half a second the header shows "0P" with a spinner and an empty avatar box, and the Undo bar reads "Question 5 of 5" before it becomes "Q5: Yes".
9. Day done: the dateline says "Closes in 01:00:00" and then "Next set in 00:59:52", while Home says "Next set in 16:29:29" at the same moment. The day done countdown is wrong (see problem M1).
10. What next: "See weekly ranking" is a reasonable next step. Nothing on the day done screen says when results come, apart from "5 waiting for answers" with a "?". Home after the day ("That is all five. Answers are set within 48 hours. The next set opens at 09:00 KST.") says it well.

Navigation: the system back from day done goes to Home, which shows the finished panel with "See today's picks". Good.

### Journey 2: returning player

Steps: open app, the Results tab carries a badge "2" (1 tap), each row expands to answer, evidence and time (1 tap), Ranking tab (1 tap), "How prizes work" (1 tap).

What works: the summary row (This week 950P, All time 9,850P, Pending +50P about 21:40) answers "what do I get and when" for points. The legend (Hit, Miss, Waiting, +50P if hit) is on the surface. Corrected and cancelled questions explain themselves in one line. The pinned row on Ranking ("27, You, 100P behind the top 10") and "Around you" are excellent.

Friction and misreads:

1. History rows keep the question text with relative dates: under "Yesterday" the row reads "Will Ethereum be above $3,500 at 21:00 tomorrow?" and under "Thu, Nov 26" "Will it rain in Tokyo tomorrow?". Read two days later, "tomorrow" points at the wrong day.
2. Waiting rows say "Answer at 21:00" with no day. The sports question is answered "after 07:00 in two days" on the card, but Results says "Answer at 07:00".
3. Three point figures appear without a hint how they relate: the header 1,250P (balance), "This week 950P", "All time 9,850P". A first timer cannot tell that the header is the convertible balance.
4. Ranking: who qualifies (3 or more days played in the week, joined more than 7 days ago) and when prizes are sent (Wednesday 21:00 KST) are only behind "How prizes work". A top 10 player sees "Prize 51.36 CT" with no "when". An unranked new player is told "No rank yet. Finish today's 5 to get on the board", which is not enough for an account younger than 7 days.
5. There is no streak. "Day 6, week 48" in the dateline is the calendar, not the player's progress. The only week progress is the 5 squares per day and "11/20 hits". The "3 days to qualify" rule would be a natural week progress marker and is not shown.
6. "Set" as a filter label ("All, Waiting, Set") is not obvious; "Answered" or "Decided" reads faster.

### Journey 3: money

Wallet overview (1 tap from any screen through the tab or the points chip in the header): Available CT with Deposit and Withdraw, address chip that copies, Staked, KAIA with "?", Points with "?", "Convert points" as the one primary action. The primary action is obvious within two seconds.

Deposit (2 taps): QR, the full address in groups of four, "Copy address", "Waiting for deposits", Network and Token rows and one warning ("Send only on Kaia"). Back returns to Wallet. Good. The old CT warning and the exchange tip are only behind "?"; the same sheet also prints the token contract address under the deposit instructions.

Withdraw (Wallet, Withdraw, paste, amount, Withdraw, tick, Send, Done: 6 taps plus typing). This is the best flow in the product. Tested live: a short address, the player's own address, the token contract and a valid address each got a specific message; the valid address is echoed in groups of four; the review sheet repeats the full address, the amount and the fee, and the Send button stays off until "I checked the address. Sends on Kaia cannot be undone." is ticked. Signing, sending and "Sent 250 CT" with "Balance left" follow in about 3 seconds, and Done returns to Wallet. KAIA's role is on the surface here ("Your KAIA 2.4", "Network fee about 0.0021 KAIA", "Fee: you pay").
Friction: with a valid address and an amount error the disabled button still reads "Enter address and amount"; "12.123456" gets "Enter an amount in CT, like 250." and not the decimals rule; in the low KAIA state two identical "Deposit KAIA" buttons show, and at 360x640 the sentence that explains why is under the pinned bar.

Convert (Wallet, Convert points, Convert, Convert, Done: 4 taps). The field is prefilled with the largest convertible amount, "You get 1 CT", "Points left 250P", Rate, Fee "None", "Left today 50 CT". The review sheet states "Points cannot be converted back." Irreversibility is therefore in the review step, as required. The limit is on the surface ("Left today"). Missing: the 7 day wait is not in "Conversion rules" or in the Wallet "?" sheet; it only appears once the player is blocked.

Staking (Staking tab, New stake, amount, period, Stake, Stake: 5 taps). Rates per period are on the tiles, the tier cue updates as the amount changes, "Locked until Feb 26, 2027. No early exit." is on the surface and again in the review sheet ("No early exit: this CT stays locked until Nov 28, 2027."). Two visible steps ("Allow Cojam to use 1,000 CT", "Stake 1,000 CT") and a success sheet with "Unlocks on" and "See my stakes".
Friction: the Staking tab always opens "My stakes", also for a player with no stake (empty state, then one more tap). At 360x640 the lock date line sits under the pinned bar (it is still in the review). In the "full" state with no room left, two warnings and a "Stake 0 CT" button appear.

My stakes: a clear summary (Staked, Earned, Claimable) and one entry per stake with a progress bar between its two dates. Withdrawing an unlocked stake shows Stake, Interest, Total and one confirm. Friction: the unlocked stake that can be withdrawn is listed under the locked ones and its button is below the fold at both sizes; nothing on the tab bar tells the player that CT is ready; "Min. claim 10 CT" on a small stake does not say that the interest is paid together with the stake at unlock.

The role of KAIA: explained only in "?" on Wallet ("Only needed to withdraw CT to another wallet."). That is acceptable under the owner's rule, because Withdraw itself states the fee and who pays.

### Journey 4: profile and invite

Profile is 1 tap (the "M" box in the header). Name: inline rules, tested with "a" (length), "admin" (staff name) and a valid name (toast "Name saved."). Language: a two way switch that applies at once, but it sits near the bottom of Profile (below the fold at both sizes); after login there is no other language control. Device: a row "This device" with "?", the status ("Ready to play on this device until Dec 28, 2026") is only in the sheet and "until" is not explained. Help: a sheet with four entries (How Cojam works, How answers are set, Swap old CT, Cojam website). There is no way to reach support from Help.

Invite (Profile, Invite friends: 2 taps; also from Wallet and Results): "10%" with an example, the code with Copy, "Share invite link", "Copy link", totals and recent friends with masked names. The copied link is `https://app.cojam.app/i/MINJI7Q`. The friend's +100P is only in "?" and in the share text. Entering a code late: Profile shows a row "Invite code 21h" in the first 24 hours, the sheet warns "Once it is linked, it cannot be changed." Good.

"How Cojam works" replays the first run including "Skip", the language switch and "Start predicting", which is odd for a player who is already playing.

### Journey 5: things going wrong

| Situation | What the player sees | Way out |
| --- | --- | --- |
| Offline | Bar "You are offline. Showing what was saved on this device." with "Last updated"; a pick attempt gives "Connect to the internet to pick."; money actions are disabled with a reason | Clear |
| Server error | "We could not load this. Your points and CT are safe on chain." with "Try again" (after a few seconds of "Loading") | Clear; the Home error state still shows a made up "Closes in 00:59" countdown |
| Pick not saved | The card returns to the top with "Not saved. Pick again."; list view adds a toast with "Try again" | Clear, re-pick was saved in the live test |
| Slow save | "1 pick is still being saved" with "Retry now" | Clear |
| Account on hold | Every screen carries "Account on hold" with "What this means"; the detail page lists what still works and what is paused, the fee rule and a support address that copies | Clear and honest; the best error page of the product |
| Another device | "Cojam is now set up on another device. Play here instead?" with one button | Clear (the take over itself could not be judged in the mock) |
| Closed day | "Today's set has closed. A new set is ready." with "Show new set" | Clear |
| Empty states | Results, My stakes, Invite, Convert under 1,000P each say what is missing and offer the next step | Clear |
| Session expired | Sheet "Log in again. Your points and CT are kept. Picks you already made keep saving." with "Log in" | Clear |
| Transaction failed | "That did not go through. Kaia rejected this transaction. Nothing was taken from your balance." with "Try again" and "Close" | Clear, but no route to help if it keeps failing |
| Maintenance, forced update, 404 | One sentence, one button each | Clear |

The way out is always present. What is missing is a second line of help: only the on hold page offers a support contact.

### The five tabs

| Tab | Scent | Primary action within two seconds |
| --- | --- | --- |
| Home | Strong. Badge dot while picks remain | Yes: the card with two answers |
| Results | Strong. Badge with the count of new answers | Yes: the summary row, then rows |
| Ranking | Strong | Yes: the pinned "You" row; "when is the prize paid" is not on the surface |
| Staking | Medium. A lock icon and a word that a newcomer may not know; the tab opens "My stakes", not the offer | No for a newcomer (empty list first); yes on "New stake" |
| Wallet | Strong | Yes: "Convert points"; Deposit and Withdraw are equal secondary buttons |

Invite and Convert have no tab. Convert is reached through Wallet or the points chip, which works. Invite is reached through Profile, Wallet or Results, which a player has to discover.

---

## 2. Nielsen heuristics

| # | Heuristic | Score | Evidence |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | Pick bar "Saving, Saved", transaction steps and "Waiting for deposits" are exemplary; the day done countdown is wrong and the header flashes "0P" |
| 2 | Match with the real world | 3 | Plain words and a newspaper frame; "tomorrow" in old questions, "Answer at 07:00" without a day, "Extra", "Set", "Allow Cojam to use" |
| 3 | User control and freedom | 3 | Undo, Cancel on every sheet, sane back targets; the first run has no way back and "Next" is silently blocked by a bad code |
| 4 | Consistency and standards | 2 | Staking tab opens "My stakes"; Home and day done disagree on the countdown; amount errors differ between Stake and Withdraw; labelled KST times next to unlabelled times |
| 5 | Error prevention | 4 | Address checks (format, checksum, own wallet, contract), ticked review before sending, "cannot be converted back", lock date in the review, email typo suggestion |
| 6 | Recognition rather than recall | 3 | Lock date, fee and limits stay on screen; the invited iPhone player has to remember a code across install and login; prize timing must be remembered from a sheet |
| 7 | Flexibility and efficiency | 3 | Swipe or tap, Cards or List, Max, one tap fixes ("Use 1,000P"), prefilled amounts; the unlocked stake needs a scroll |
| 8 | Aesthetic and minimalist design | 4 | One primary action per screen, numbers lead, nothing decorative competes with the task |
| 9 | Recognise, diagnose, recover from errors | 3 | Messages say what happened, what is safe and what to do; "Stake 0 CT", the stale button label on Withdraw, no escalation after repeated failure |
| 10 | Help and documentation | 2 | "?" sheets are short and useful; Terms and Privacy links are dead, no support contact outside the on hold page, the 7 day rule is missing from the rules sheets |
| | Total | 30 / 40 | |

---

## 3. Problems by severity

### Blocker

**B1. Terms and Privacy Policy links do nothing.**
Route `/login` (default state), both viewports, EN and KO.
Reproduce: open `/login`, tap "Terms" or "Privacy Policy" in "By continuing you agree to the Terms and the Privacy Policy." The address becomes `/login#terms` and nothing else changes.
Why it matters: the product creates a wallet and handles a token. Consent text that links to nothing stops careful people and is a launch risk.
Fix: link both to real pages (on `cojam.app`, opened in the in-app sheet or a new tab) before launch, or remove the sentence until the documents exist.

### Major

**M1. The countdown on the day done screen is wrong.**
Route `/done` after the fifth pick (live flow) and every `/done?state=` preset; also `/?state=error`. Both viewports, both languages.
Reproduce: make five picks. The dateline reads "Closes in 01:00:00", then "Next set in 00:59:52". Go to Home: "Next set in 16:29:29".
Cause seen in the code: `Done.tsx` builds the dateline once with `useState` and falls back to "now plus one hour" when today's data is not yet there; it is never rebuilt. The same fallback shows a made up "Closes in 00:59" on the Home error state. When the wrong countdown reaches zero the screen also navigates Home by itself.
Fix: render the countdown from live data, show a neutral placeholder until the time is known, and never start the zero timer from a fallback value.

**M2. The Staking tab opens "My stakes" for everyone.**
Tab bar, every screen; `/stakes?state=empty`. Both viewports, both languages.
Reproduce: as a player with no stake, tap Staking. The screen is "No stakes yet" with "Start a stake". The offer (rates, lock periods) is one more tap away.
Fix: open "New stake" when the player has no open stake, and "My stakes" when they have one.

**M3. CT that is ready to take out is not signalled.**
`/stakes` (default state), both viewports, both languages.
Reproduce: open Staking with one locked and one unlocked stake. The unlocked stake is listed second, and "Withdraw 503.2877 CT" is below the fold at 390x844 and 360x640. The Staking tab has no badge, although the string "interest or CT ready" exists (the badge is never set in `useBadges`).
Fix: sort stakes with an available action first, and set the tab badge when a stake is unlocked or interest reaches the claim minimum.

**M4. "Staking is full" with no room shows two warnings and a "Stake 0 CT" button.**
`/staking?state=fullnone`, both viewports, both languages.
Reproduce: open the state. "Staking is full for now. New stakes open again when Cojam adds interest funds." is followed by "Staking is full for now. Right now you can stake up to 0 CT for 90 days." and a button "Stake 0 CT".
Fix: when the room is zero show only the first notice and no fix button (the second notice is for room greater than zero).

**M5. The 7 day wait before the first conversion is not told in advance.**
`/welcome` slide 3, Wallet "?" ("How points become CT"), Convert "?" ("Conversion rules"). Both viewports, both languages.
Reproduce: read slide 3 ("1,000P becomes 1 CT."), the two sheets and the Convert form. None mentions the wait. Only `/convert?state=wait` does, after the player has earned 1,000P and tried.
Why it matters: this is the "when do I get it" fact for the main reward. Learning it late reads as a broken promise.
Fix: add "from 7 days after you join" to slide 3 (the longer string `o.3.b` already has it) and a "First conversion" row to both sheets. Also add the daily limit to the Wallet sheet.

**M6. Prize timing and eligibility are hidden on Ranking.**
`/ranking` (default, `top10`, `unranked`), both viewports, both languages.
Reproduce: as a top 10 player the pinned row reads "You are in the top 10. Prize 51.36 CT". When and under which condition is only in "How prizes work". As an unranked player the text is "No rank yet. Finish today's 5 to get on the board.", although the rule is 3 days played and an account older than 7 days.
Fix: put "Sent Wed 21:00 KST" under the pool figure or in the pinned row, and make the unranked line state what is still missing ("Play 2 more days this week to qualify", "Prizes from your second week").

**M7. No route to support or help outside the on hold page.**
Profile, Help sheet; failure sheets on `/staking?state=failed`, `/convert?state=failed`, `/withdraw?state=failed`; `/login?state=walletfail`, `refused-many`. Both viewports, both languages.
Reproduce: open Profile, Help. The four entries have no contact. Fail a transaction twice: "Try again" and "Close" only.
Fix: add "Contact support" (the address that already copies on the on hold page) to the Help sheet and as a quiet link on failure sheets and on the refused registration screens.

**M8. Results rows can be misread in time.**
`/results` (default), both viewports, both languages.
Reproduce: look at "Yesterday" and "Thu, Nov 26": the question texts still say "tomorrow". Look at today's waiting rows: "Answer at 07:00" for a question that is answered in two days.
Fix: write questions with the absolute date, or have the row show the date the question is about; always give the day with the answer time ("Answer Sun 07:00").

**M9. The invite code step is easy to pass by.**
`/welcome` slide 1 (default), `/gate?state=invited-ios`. Both viewports, both languages.
Reproduce: follow the iPhone invite path: the gate says "Copy the code, install the app, then enter it when you start." After login, slide 1 shows a small link "Have an invite code?" above the language switch; "Skip" in the header or "Next" leaves the slide and the offer is gone. With the panel open there are two "Skip" links, and "Next" with an unknown code does nothing visible.
Fix: open the code field by default when the player comes from an invite (and try the clipboard for a matching code), rename the inner link to "No code", make "Next" either proceed without the code or show why it will not, and show the "Invite code 21h" reminder once on the day done screen.

### Minor

| # | Problem | Route and state | Viewport, language | Fix |
| --- | --- | --- | --- | --- |
| m1 | Header shows "0P" with a spinner and an empty avatar box for about half a second, and the Undo bar reads "Question 5 of 5" before "Q5: Yes" | `/done` right after the fifth pick | Both, both | Keep the last known points and the pick label through the transition |
| m2 | "Finishing in 3" and "Finish now" do not say what finishes | `/done` during the Undo window | Both, both | "Last pick locks in 3" and "Lock it now", or keep Undo as the only control |
| m3 | "Log in to play" for a person without an account | `/login` | Both, both | "Log in or sign up", lede "We email you a code. No password." |
| m4 | First run has no way back between slides | `/welcome` | Both, both | Allow a swipe back or a back arrow on slides 2 and 3 |
| m5 | "How Cojam works" replays the first run with "Skip", the language switch and "Start predicting" | Profile, Help, `/welcome?from=profile` | Both, both | Label the exit "Close", hide the language switch and the code link |
| m6 | With a valid address and an amount error the button still reads "Enter address and amount" | `/withdraw` live | Both, both | Mirror the error in the button as Stake does ("More than your balance") |
| m7 | Decimals error differs: Withdraw says "Enter an amount in CT, like 250.", Stake says "CT has up to 4 decimals here." | `/withdraw`, `/staking` | Both, both | One rule and one sentence for both |
| m8 | Two identical "Deposit KAIA" buttons; at 360x640 the explaining sentence is under the pinned bar | `/withdraw?state=nokaia` | 360x640 mostly, both | Keep one button and put the reason next to "Your KAIA" |
| m9 | The lock date line is under the pinned bar | `/staking` | 360x640, both | Move the line into the pinned bar above the button |
| m10 | "Min. claim 10 CT" does not say that interest is paid with the stake at unlock | `/stakes` | Both, both | "Paid with your stake at unlock, or claim from 10 CT" |
| m11 | Device status hidden behind "?"; "until Dec 28, 2026" is unexplained | `/profile` | Both, both | Show "Ready on this device" in the row; explain the renewal in the sheet |
| m12 | Language switch is near the bottom of Profile and nowhere else after login | `/profile` | Both, both | Move Preferences above Account, or add the globe to the Profile header |
| m13 | Times: "09:00 KST" is labelled, other times are not ("+50P at 21:40", "Expected back: Nov 28, 08:25", "Last updated") | Wallet, Results, system pages | Both, EN | Label every clock time with its zone, or use one rule throughout |
| m14 | Jargon: "Extra" banner, filter "Set", step "Allow Cojam to use 1,000 CT" | `/done`, `/results`, staking steps | Both, EN | "Done", "Answered", "Approve 1,000 CT" |
| m15 | Convert on hold shows "Fee: you pay" although converting is off | `/convert?state=hold` | Both, both | Show "None" or hide the row |
| m16 | Old CT warning and exchange tip only behind "?"; the sheet also prints the token contract address under deposit advice | `/deposit` | Both, both | Put "Old CT does not work here" on the surface; move the contract address out of this sheet (it is in Wallet, Token info) |
| m17 | The friend's +100P is not on the Invite surface | `/invite` | Both, both | Add "Your friend gets +100P" under the 10% line |
| m18 | Three point figures with no hint how they relate (header balance, This week, All time) | `/results`, `/profile` | Both, both | Label the header chip "Balance" for screen readers and in the Results "?" sheet |
| m19 | No week progress toward the "3 days to qualify" rule; "Day 6, week 48" reads like a streak but is the calendar | Dateline, `/ranking` | Both, both | Show "3 of 3 days this week" in the Ranking pinned row |

---

## 4. Korean wording fixes

The Korean is generally natural and consistent in the polite informal style. The items below are the places that read as translated, are ambiguous, or break the style.

| Key | Current | Proposed | Why |
| --- | --- | --- | --- |
| `pp.answerat` | {time} 정답 확정 | {time} 확정 예정 | Reads as already confirmed; the row is still waiting |
| `h.end.in` | {n}초 뒤에 마무리해요 (renders "3 초") | {n}초 뒤에 확정돼요 | The number is set apart by a space on screen; "마무리" is vague |
| `pp.finishnow` | 지금 완료 | 바로 확정하기 | Says what the button does |
| `h.qn.sr` (shown in the Undo bar on day done) | {n}번 문제 (모두 5개) | 5문제 중 {n}번 | Matches the card label "5문제 중 1번" |
| `a.fine` | 계속하면 {terms}과 {privacy}에 동의한 것으로 봐요. | 계속하면 {terms} 및 {privacy}에 동의하게 돼요. | "동의한 것으로 봐요" is stiff |
| `p.login` | {email} 계정으로 로그인됨 | {email}로 로그인했어요 | Noun ending in a sentence position |
| `inv.linkcopied` | 링크 복사됨 | 링크를 복사했어요 | Used as a spoken message; match "g.copied" |
| `o.1.h` | 하루 다섯 번의 예측 | 하루 다섯 문제 | "번의" is a literal rendering |
| `e.load` | 불러오지 못했어요. 포인트와 CT는 체인에 안전하게 있어요. | 불러오지 못했어요. 포인트와 CT는 블록체인에 안전하게 보관돼 있어요. | "체인에 안전하게 있어요" is not idiomatic |
| `sys.maint.b` | …포인트와 스테이킹, CT는 체인에 안전하게 있어요. 곧 돌아올게요. | …포인트와 스테이킹, CT는 블록체인에 안전하게 보관돼 있어요. 곧 돌아올게요. | Same |
| `x.gas` | 출금 수수료는 지원되지 않아요. 소액의 네트워크 수수료를 KAIA로 직접 내요. | 출금할 때는 Cojam이 수수료를 대신 내지 않아요. 네트워크 수수료를 KAIA로 직접 내야 해요. | "지원되지 않아요" reads as "withdrawal fees are not supported" |
| `c.wait.b` | 새 계정은 가입 7일 뒤부터 전환할 수 있어요. {date}부터 전환할 수 있어요. | 새 계정은 가입 7일 뒤부터 전환할 수 있어요. 이 계정은 {date}부터예요. | The same ending twice in a row |
| `tx.review.h` | 확인하고 진행하세요 | 내용을 확인해 주세요 | More natural for a review sheet |
| `tx.step1` | Cojam이 {a} CT를 쓰도록 허용 | {a} CT 사용 승인 | Shorter and the usual wallet wording |
| `tx.fail.reverted` | Kaia에서 거래가 거절됐어요. 잔액에서 빠져나간 것은 없어요. | Kaia 네트워크에서 거래가 처리되지 않았어요. 잔액은 그대로예요. | Simpler, same reassurance |
| `k.gap` | 상위 10명까지 {gap}P | 상위 10명까지 {gap}P 남았어요 | A full sentence in the pinned row |
| `k.last` | 지난주 {rank}위를 했어요. {amount} CT가 지갑으로 들어왔어요. | 지난주에 {rank}위를 했어요. 상금 {amount} CT가 지갑에 들어왔어요. | Says that the CT is the prize |
| `k.pool.line` | 참여 자격을 갖춘 사람 한 명마다 1 CT가 쌓여요. 지금 {n}명이고, 최대 10,000 CT까지예요. | 자격을 갖춘 참가자 한 명당 1 CT씩 쌓여요. 지금 {n}명이고, 최대 10,000 CT까지 쌓여요. | "한 명마다", "까지예요" are awkward |
| `dp.lead` | Kaia 네트워크에서 이 주소로 새 CT 또는 KAIA를 보내세요. | 이 주소로 새 CT나 KAIA를 보내 주세요. 반드시 Kaia 네트워크를 선택하세요. | Word order follows the English |
| `sys.404.b` | 오래된 링크일 수 있어요. 오늘의 예측은 바로 볼 수 있어요. | 오래된 링크일 수 있어요. 홈에서 오늘의 예측을 볼 수 있어요. | "one tap away" does not carry over |
| `pp.x.dec` | 250처럼 CT 수량을 입력하세요. | CT 수량을 숫자로 입력해 주세요. 예: 250 | Match `s.e.nan` |
| `a.setup.s3` | 이 기기 플레이 준비 | 이 기기에서 플레이할 준비 | Three nouns in a row |
| `s.period` | 예치 기간 | 잠금 기간 | The rest of the screen says "잠금 해제일", "잠금 중"; "예치", "맡기다", "스테이킹" are mixed for one idea |
| `sys.blocked.h`, `hold.t`, `hold.tag` | 이 계정은 보류 중이에요, 계정 보류 중, 보류 중 | 이 계정은 이용이 일시 제한됐어요, 계정 이용 제한 중, 이용 제한 | "보류" does not say what is held; "이용 제한" is the term Korean services use |
| Time format | 오전 9시 next to 21:40쯤, 17:16부터, 21:00 | 오전 9시, 오후 9시 40분쯤, 오후 5시 16분부터 | Two clock styles on one screen |

English notes: "Extra" (use "Done" or drop the label), "Set" as a filter ("Answered"), "Finishing in 3" ("Last pick locks in 3"), "Sends on Kaia cannot be undone" ("Transfers on Kaia cannot be undone").

---

## 5. What works well

1. The core loop is fast and legible: one question, two answers, the reward and the Undo rule on the card, about 40 seconds for a day.
2. Undo is honest: a visible fuse, then "Saving" and "Saved" with the pick named, and "Final" announced for assistive technology.
3. Withdraw is a model flow: four kinds of address error told apart, the address echoed in groups of four, a ticked confirmation, fee and payer stated, success with the balance left, return to Wallet.
4. Critical facts are where they must be: the lock date and "No early exit" on the stake form and in its review, "Points cannot be converted back." in the convert review, "Fee: you pay" on Withdraw, the daily limit on Convert.
5. Inline fixes instead of bare errors: "Did you mean gmail.com?", "Use 1,000P", "Stake 100 CT", "Use 1,840.5 CT".
6. Every failure says what is safe: "Your points and CT are safe on chain", "Nothing was taken from your balance", "Picks you already made keep saving".
7. The on hold experience is transparent: a banner on every affected screen and one page that lists what works, what is paused and how to appeal.
8. The install gate adapts to the browser, including in-app browsers and desktop, and carries the invite code through on Android.
9. Ranking makes the distance concrete ("100P behind the top 10", "50P ahead", "50P behind") and keeps the player's row pinned.
10. Results explains corrections and cancellations in one line each and shows evidence and the time for every answer.
11. Touch targets are all at least 40 px, there is no horizontal overflow and no page error in 712 captured states.
12. The Korean text reads naturally in almost every place and keeps one voice.
