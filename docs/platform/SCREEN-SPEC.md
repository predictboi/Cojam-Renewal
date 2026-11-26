# Cojam Daily Prediction: screen specification

Status: draft 2 (2026-11-26). Folds in `REVIEW.md` (sections A and B) and every row of `DECISIONS.md`: Privy email login only with an email provider allow list, the play key ("Setting up your game"), per market settle with the 48 hour rule, one retry policy, the new registration, pending, conversion and staking states, admin sign in with Privy email on an allow list, and the accepted defaults. Agrees with `DEV-PLAN.md` draft 2 on names, numbers and states.
Scope: only `PLAN-SOURCE.md` as changed by `DECISIONS.md`. Where the two disagree, `DECISIONS.md` wins. What is still open is listed in section 9 and is not designed as a feature here.

Conventions used below:

- **Data source tags**: `[chain]` read from a Kaia contract (prediction, staking, CT token) through the server's RPC or the client; `[api]` Cojam platform API on `app-api.cojam.app` (the swap's gas API on `api.cojam.app` is separate); `[privy]` Privy SDK (session, user, embedded wallet); `[local]` device only (localStorage, IndexedDB, service worker cache).
- **Copy**: text in quotes is the English source string. `{name}` is a variable. Every string goes into the EN / KO / JA dictionary; no string is hard coded in markup.
- **Numbers**: points are whole numbers with thousands separators and a `P` suffix with no space ("1,250P"). CT shows up to 4 decimals with trailing zeros trimmed ("12.5 CT", "0.35 CT"); the full value is in the accessible label. KAIA shows up to 4 decimals. All figures use tabular numerals. Dates use the device locale; times show the device time zone abbreviation the first time they appear on a screen.
- **Ticker rule**: in the PWA, "CT" always means new CT (`0x91cb3B346C80ff965a9667ba6228834dbedD71a2`). Where old CT can be confused (W3, W4, G1), the copy says "new CT" and shows the full address.
- **Never show a result before it is confirmed** on chain (points paid, CT received, stake opened). Pending values are labelled as pending.

---

## 1. Overview

### 1.1 Surfaces

| Surface | Where | Who | Device | Purpose |
| --- | --- | --- | --- | --- |
| (a) PWA | `app.cojam.app`, display mode standalone | Players | Phone first (360 to 430 px), works on tablets | All play: predict, results, ranking, staking, wallet, profile |
| (b) Gate | `app.cojam.app` in any ordinary browser tab | Visitors | Any | Install the app, or go to the swap at `https://cojam.app/migrate/`. No play, no login |
| (c) Admin | `admin.cojam.app`, desktop web page | Cojam operators on the admin allow list | Desktop, 1280 px and up | Watch the AI pipeline, change reward numbers, correct and compensate, run the airdrop, watch wallets and jobs |

### 1.2 Install gate logic

Runs before anything else on `app.cojam.app`, synchronously in the document head so the wrong surface never flashes.

```
standalone = matchMedia('(display-mode: standalone)').matches
          || matchMedia('(display-mode: fullscreen)').matches
          || navigator.standalone === true            // iOS home screen
(the admin lives on admin.cojam.app and never reaches this logic)
if standalone                             -> PWA (A1 if no Privy session; A1 setup panel if the account is not registered or this device has no valid play key; else A2 if first run not done; else H1/H2/H3)
else                                      -> G1 Gate, variant chosen below
```

G1 variant, first match wins:

| # | Condition | Variant | Main action |
| --- | --- | --- | --- |
| 1 | In app browser: user agent contains `KAKAOTALK`, `Instagram`, `FBAN`/`FBAV`, `Line/`, `NAVER(inapp`, `DaumApps`, `Telegram` (Android webview), or a webview marker | `inapp` | "Open in your browser". Android KakaoTalk: try `kakaotalk://web/openExternal?url=` first; Android others: `intent://` to Chrome; iOS: copy link plus steps |
| 2 | Android and a `beforeinstallprompt` event arrived | `android-prompt` | "Install Cojam" (calls `prompt()`) |
| 3 | Android, no prompt event within 3 s (Samsung Internet, Firefox, prompt already dismissed) | `android-manual` | Steps: browser menu, then "Add to Home screen" or "Install app" |
| 4 | iOS or iPadOS, Safari | `ios-safari` | Steps: Share, "Add to Home Screen", Add |
| 5 | iOS or iPadOS, other browser (Chrome, Edge, Firefox on iOS 16.4 and later) | `ios-other` | Same steps through that browser's share menu; fallback line "Or open this page in Safari" |
| 6 | Desktop (no touch primary pointer, width 900 px and up) | `desktop` | QR code to `https://app.cojam.app/?src=qr`, plus "Swap old CT" link |
| 7 | Anything else | `generic` | QR code and the manual steps for both platforms |

After `appinstalled` fires (Android), G1 switches to "Installed. Open Cojam from your home screen." There is no reliable way to open the installed app from the tab, so the copy says where to find it.

### 1.3 Navigation map

```
G1 Gate ──install──> (home screen icon) ──> A1 Login (email, code) ──> A2 First run (setup finishes behind it) ──> Home
A1 ──returning user, no valid play key on this device──> A1 setup panel "Setting up your game" ──> Home
G1 ──"Swap old CT"──> https://cojam.app/migrate/ (new tab)

Home = H1 Card view | H2 Terminal view  (switch; choice remembered [local])
   H1/H2 ──5th pick committed (optimistic)──> H3 Day done ──"See weekly ranking"──> K1
   H3 ──countdown hits 0──> H1/H2 with the new set
Tab bar: Home (H1/H2/H3) · Results (R1) · Ranking (K1) · Staking (S1 ⇄ S2) · Wallet (W1)
   S1 <──segmented switch──> S2
   W1 ──"Convert points"──> W2 ;  W1 ──"Deposit"──> W3 ;  W1 ──"Withdraw"──> W4
   W1 "Staked" row ──> S2
Header: point pill ──> W1 ;  profile button ──> P1
P1 ──"Log out"──> A1 ;  P1 ──"Swap old CT"──> cojam.app/migrate/ (external)
Global layers on any PWA screen: transaction sheet, toasts, offline bar, error screens, maintenance screen, update toast, session expired sheet

Admin: AD0 ──> AD1 ; side nav: AD1 Dashboard · AD2 Reward settings · AD3 Questions · AD4 Answers · AD5 Ranking and airdrop · AD6 System
   AD3 question row ──"Open answer"──> AD4 detail ;  AD1 alert ──> the screen it names
```

Sub screens (W2, W3, W4, P1) open as pushed pages with a back button in the header; the tab bar stays visible and the Wallet tab stays selected (Profile selects none). Android back and the iOS edge swipe go back one level; on a tab root they do nothing (the PWA never closes itself on back).

### 1.4 Bottom tab bar

| Order | Label | Icon | Goes to | Badge |
| --- | --- | --- | --- | --- |
| 1 | "Home" | card stack | H1, H2 or H3 by state | Volt dot while today's set has unanswered questions |
| 2 | "Results" | check list | R1 | Count of newly set answers since the last visit, max "9+" |
| 3 | "Ranking" | podium | K1 | none |
| 4 | "Staking" | lock with arrow | S1 (S2 if the user has stakes) | Dot when a locked stake has 10 CT or more claimable, or a stake has unlocked |
| 5 | "Wallet" | wallet | W1 | none |

Profile and settings (P1) is reached from the header, not the tab bar, to keep five tabs.

---

## 2. Global PWA elements

### 2.1 App header (every PWA screen except A1, A2)

| Block | Element | Source | Notes |
| --- | --- | --- | --- |
| Left | Logo chip (snow chip, mark, "Cojam") on tab roots; back button "Back" (icon, labelled) on sub screens | static | 44 px target |
| Centre | Screen title on sub screens only ("Convert points", "Deposit", "Withdraw", "Profile") | static | |
| Right | Point pill "{points}P" | `[chain]` point balance, refreshed after every confirmed point change and every 30 s while visible | Tap: W1. States below |
| Right | Profile button (round, initial of display name or a generic person icon) | `[api]` profile | Tap: P1. Label "Profile and settings" |

Point pill states:

| State | Display | Accessible label |
| --- | --- | --- |
| Loading | Skeleton pill 64 px wide | "Loading points" |
| Ready | "1,250P" (confirmed on chain only) | "1,250 points" |
| Saving | "1,250P" with a small spinner, while today's fifth pick is not yet mined (the 100P is not added until it is) | "1,250 points. Saving your picks." |
| Hits pending | "1,250P" plus a small sky tag "+{n}" (hit points inside the 6 hour correction window, not yet credited) | "1,250 points. {n} points on the way, landing about {time}." |
| Error | Last known value plus a muted dot | "Balance may be out of date" |

Tap opens W1, whose points card spells out the pending hit points and when they land.

Header ground: blue band (`--brand`) with snow text, as the site shell. Safe area: `padding-top: env(safe-area-inset-top)`.

### 2.2 Transaction progress sheet

Used for staking, claiming interest, withdrawing principal, converting points, withdrawing CT. Not used for single prediction picks (they show inline status, section 3.H1).

| State | Title | Body | Actions |
| --- | --- | --- | --- |
| Review (only W4 and stakes over 10,000 CT) | "Check and confirm" | Summary rows of the action | "Confirm" (primary), "Cancel" |
| Signing | "Signing with your Cojam wallet" | "This only takes a moment. No confirmation is needed." | "Cancel" |
| Step list (when 2 steps: approve then stake) | "Staking {amount} CT" | Steps "1 Allow Cojam to use {amount} CT", "2 Stake {amount} CT", each Waiting / In progress / Done | "Cancel" until step 1 is sent; after that "Hide" (the work continues) |
| Sending | "Sending to Kaia" | "Usually confirmed in a few seconds." Tx hash chip once known | "Hide" |
| Success | Per action, see screen | Confirmed amounts, "View on Kaiascan" link | "Done" |
| Failed | "That did not go through" | Reason line (table 2.7) and "Nothing was taken from your balance." when true | "Try again" (primary), "Close" |
| Slow (over 60 s without receipt) | "Still waiting for Kaia" | "Your transaction is sent. It can take a little longer when the network is busy." | "Hide", "View on Kaiascan" |

Hidden sheets leave a slim status chip above the tab bar ("Staking 500 CT: sending") that reopens the sheet. Esc and the grip drag close the sheet only in Review, Success and Failed states.

### 2.3 Toasts

Ink pill, volt bottom edge, above the tab bar and the safe area, `aria-live="polite"`. Max one visible, queue the rest. Auto hide 4 s; toasts with a button stay 8 s.

| Event | Copy | Button |
| --- | --- | --- |
| Pick failed for good (only a non retryable failure while the question is open; never for a retry in progress) | "Your pick on question {n} was not saved." | "Try again" |
| Completion reward confirmed (fifth pick mined) | "+100P paid." | none |
| Points paid (other confirmed credits) | "+{n}P paid." | none |
| Hit points landed (after the correction window) | "{n} hits paid: +{p}P." | "See results" |
| CT arrived (deposit detected) | "{amount} CT arrived in your wallet." | none |
| Address copied | "Address copied." | none |
| Update ready | "A new version of Cojam is ready." | "Reload" |
| Back online | "Back online. Your data is up to date." | none |

### 2.4 Offline state

Detection: `navigator.onLine` plus a failed API heartbeat (2 misses, 10 s apart).

- Slim ink bar under the header: "You are offline. Showing what was saved on this device." with a muted "Last updated {time}".
- Cached screens stay readable (last set, last balances, last ranking from `[local]` cache). Every action that needs the network is disabled with the reason as its helper line: "Connect to the internet to pick." / "Connect to the internet to stake." and so on.
- Picks made offline are not queued (a set can close while offline). The card commit is blocked and the card springs back with the helper line.
- First open with no cache: full screen empty state "No connection", body "Cojam needs the internet to load today's predictions.", button "Try again".

### 2.5 Error states

| Case | Where | Copy | Action |
| --- | --- | --- | --- |
| API down (5xx, timeout) on a screen load | In place of the block that failed | "We could not load this. Your points and CT are safe on chain." | "Try again" |
| Chain RPC down | Balance blocks | "Kaia is not answering right now. Balances may be out of date." | "Try again" |
| Partial failure | Only the failed block shows the error; other blocks render | as above | per block |
| Unknown route | Full screen | "This page does not exist." | "Go to Home" |
| Gas sponsor out of funds (server reports) | Inline on the action; for picks, the H1 banner only (picks keep retrying until the question closes) | "Free transactions are paused for a moment. Try again in a few minutes." | "Try again" |
| Conversion reserve short (convert, airdrop) | Inline on the action | "Payouts are paused while Cojam refills the reward reserve. Your points are kept." | none |

### 2.6 Global system screens

| Screen | Trigger | Copy | Action |
| --- | --- | --- | --- |
| Maintenance | `[api]` status flag `maintenance=true` | Title "Cojam is being updated", body "Predictions and payouts are paused. Your points, stakes and CT are safe on chain. We will be back shortly." Optional admin message line. "Expected back: {time}" if set | "Check again" (re checks; also auto every 60 s) |
| Update required | `[api]` `minVersion` above the running version | "Update Cojam to keep playing", body "A newer version is needed." | "Update now" (activates the waiting service worker and reloads) |
| Session expired | Privy token refresh fails | Sheet: "Log in again", body "For your safety you were logged out. Your points and CT are kept. Picks you already made keep saving." | "Log in" (opens the A1 email and code steps as a sheet; on success the user returns to the same screen and state) |

### 2.7 Transaction error copy (shared)

| Cause | Copy |
| --- | --- |
| User cancelled while signing | "You cancelled. Nothing was sent." |
| Not enough CT | "You have {balance} CT. Enter {balance} CT or less." |
| Not enough KAIA for gas (W4 only) | "You need about {fee} KAIA for the network fee. You have {kaia} KAIA." |
| Reverted on chain | "Kaia rejected this transaction. Nothing was taken from your balance." |
| Network timeout before send | "We could not reach Kaia. Nothing was sent." |
| Relayer or fee payer refused | "Cojam could not sponsor this transaction right now. Try again in a minute." |
| Set closed (picks) | "Today's set has closed. A new set is ready." |
| Daily conversion limit reached | "You reached today's conversion limit. Try again after {time}." |
| Staking full | "Staking is full for now. Try a smaller amount or a shorter period, or try again later." |
| Unknown | "Something went wrong. Nothing was sent." plus a short error code for support |

---

## 3. PWA screens

Common to every PWA screen: header (2.1), tab bar (1.4) except on A1 and A2, offline bar (2.4), skip to content link, one `h1` per screen (visually the title or `sr-only`), every state reachable with `?state=` in development builds.

### G1 Gate

**Purpose**: turn a browser visit into an install; send swap traffic to the swap.
**Entry**: any non standalone visit to `app.cojam.app`, QR scans, shared links.

Layout top to bottom (blue ground with the 44 px grid, as the landing hero):

| Block | Elements | Source |
| --- | --- | --- |
| Top bar | Anti phishing line (ink): "Only on app.cojam.app. Cojam never asks for your seed phrase." | static |
| Header | Logo chip, language select (EN / 한국어 / 日本語) | `[local]` language |
| Hero | Display heading "Predict daily. Earn CT.", lede "Five quick predictions every day. Swipe to pick, earn points, turn them into CT." | static |
| Preview | A static, non interactive card stack image of a sample prediction, labelled "Example" | static |
| Install block | Variant content (table below) | UA detection, `beforeinstallprompt` |
| Rules strip | Three facts: "No fee for predicting, staking or converting", "Log in with your email", "Points live on Kaia" | static |
| Swap block | Heading "Holding old CT?", body "Swap old CT for new CT first, at cojam.app.", button "Swap old CT" (secondary, opens `https://cojam.app/migrate/` in a new tab) | static |
| Footer | "Cojam home" link to `https://cojam.app`, © line | static |

Install block per variant:

| Variant | Content |
| --- | --- |
| `android-prompt` | Primary button "Install Cojam". After `prompt()`: accepted, "Installing. Open Cojam from your home screen."; dismissed, the manual steps appear under "Or add it from the browser menu" |
| `android-manual` | Heading "Add Cojam to your home screen", steps: 1 "Tap the menu ⋮ in your browser", 2 "Tap Add to Home screen or Install app", 3 "Open Cojam from your home screen" |
| `ios-safari` | Heading "Add Cojam to your Home Screen", steps with icons: 1 "Tap Share at the bottom of Safari", 2 "Scroll and tap Add to Home Screen", 3 "Tap Add, then open Cojam from your Home Screen". A bouncing arrow points to Safari's toolbar (static under reduced motion) |
| `ios-other` | Same steps naming "the share button of your browser", plus "If you do not see Add to Home Screen, open this page in Safari." and a "Copy link" button |
| `inapp` | Heading "Open Cojam in your browser", body "This app inside {app name, or 'this app'} cannot install Cojam." Android: primary "Open in browser" (deep link); if nothing opens within 1.5 s, show the copy steps. iOS: steps "Tap ⋯ or the share icon", "Tap Open in Safari (or Open in browser)"; button "Copy link" |
| `desktop` | Heading "Play on your phone", body "Scan the code with your phone camera, then add Cojam to your home screen." QR block (encodes `https://app.cojam.app/?src=qr`), the URL in text under it, "Copy link" |
| `generic` | QR block and both step lists in a two item disclosure ("On iPhone", "On Android") |

States: no loading state (static page; QR renders client side, skeleton square 200 px until drawn); installed (`appinstalled`): install block replaced by "Cojam is installed. Open it from your home screen."; offline: unchanged (page is cached).

Actions: "Install Cojam" calls the deferred prompt; "Copy link" copies `https://app.cojam.app/` and toasts "Link copied."; "Swap old CT" opens the swap; language select re renders in place.

### A1 Login

**Purpose**: create or resume the Privy account and its Kaia embedded wallet with an email address and a one time code (Privy email login only; no social providers, no wallet connect), then get the account and this device ready to play.
**Entry**: first standalone launch, after log out, after session expiry (as a sheet, 2.6).

Two steps on one screen (email, then code), followed by the setup panel when needed.

**Step 1: email**

| Block | Elements | Source |
| --- | --- | --- |
| Top | Logo, language select | `[local]` (default from the device language: ko, ja, else en) |
| Hero | Heading "Log in to play", body "Enter your email. We send you a code. Cojam creates a wallet for you on Kaia." | static |
| Email field | Label "Email", placeholder "you@example.com", `type="email"`, `inputmode="email"`, `autocomplete="email"`, 16 px text | user |
| Action | Primary "Send code" | |
| Supported providers | Disclosure "Which email works?" listing the supported providers by display name ("Gmail, Naver, Kakao, Daum, Hanmail, iCloud, Outlook, Hotmail, Yahoo! JAPAN" at launch) | `[api]` allow list (`supportedProviders`) |
| Fine print | "By continuing you agree to the Terms and Privacy Policy." (links shown only once legal pages exist; legal is deferred by the founder) | static |
| Help | Disclosure "What is the Cojam wallet?": "A wallet on Kaia made for your login. It holds your points and CT. Only you can use it." | static |

"Send code" first calls `[api]` `POST /v1/auth/email-check` (allow list, normalisation, request limits), and only then asks Privy to send the code. An unsupported address never reaches Privy.

**Step 2: code**

| Block | Elements | Source |
| --- | --- | --- |
| Heading | "Check your email", body "We sent a code to {email}." | static |
| Code field | Label "Code", one field for the whole code (length from Privy, 6 expected), `inputmode="numeric"`, `autocomplete="one-time-code"`, monospace digits with tabular numerals; submits on its own when the last digit is typed | user |
| Action | Primary "Log in" | |
| Resend | Link "Send a new code", disabled for 60 s with the line "You can ask for a new code in {s}s" | `[local]` timer |
| Change | Link "Use another email" (back to step 1, field kept) | |
| Tip | "No email? Check your spam or promotions folder." | static |

The pending email and the time the code was sent are kept in `[local]`, so if the app reloads while the user is in Mail, A1 reopens on step 2 with the timer still right.

States:

| State | Display |
| --- | --- |
| Idle | Step 1, "Send code" enabled once the field is not empty |
| Email empty | On "Send code": "Enter your email address." |
| Email malformed | "This does not look like an email address. Check it and try again." |
| Provider not supported | Inline note (warn) under the field: title "This email provider is not supported yet", body "To keep Cojam fair, you can sign up with these providers: {list}. Use an address from one of them." The list is the display names from the allow list. No code is sent |
| Too many code requests | "Too many codes were asked for from this device or network. Wait a few minutes and try again." |
| Sending code | Button spinner, label "Sending code" |
| Send failed | "We could not send the code. Try again in a minute." |
| Code sent | Step 2, resend timer running |
| Checking code | Button spinner, label "Checking" |
| Wrong code | Field red edge, "That code is not right. Check the latest email from Cojam and try again." |
| Code expired | "This code has expired. Send a new code." with the resend link enabled at once |
| Too many tries | "Too many tries. Wait a few minutes, then send a new code." (Privy's limit; field disabled until then) |
| Creating wallet (first login) | Full panel: spinner, "Setting up your wallet on Kaia", "This happens once." |
| Wallet creation failed | "We could not set up your wallet. Try again." button "Try again" |
| Offline | Fields disabled, helper "Connect to the internet to log in." |

**Setup panel "Setting up your game"**

Runs after the code is accepted whenever the account is not yet registered as a player or this device has no valid play key (first login, new phone, reinstall, cleared storage, iOS eviction, expired key). It registers the account (`[api]` `POST /v1/session`, then the operator's `registerPlayer`) and authorises this device's play key (the Cojam wallet signs `setPlayKey` once, with no prompt). For a new user the panel runs behind A2 and only shows if A2 ends before it does.

| Block | Elements |
| --- | --- |
| Title | "Setting up your game" |
| Body | First login: "This takes a few seconds." Returning user on a new or reset device: "Getting this device ready to play. This happens once per device." |
| Steps | "1 Create your wallet", "2 Register your account", "3 Get this device ready to play", each Waiting / In progress / Done (steps already done are shown done) |

| State | Display |
| --- | --- |
| In progress | Steps as above; no action needed |
| Registration busy (sign ups queued) | Step 2 reads "Waiting in line. This can take a minute." |
| Registration refused: email already used | Panel title "We could not register this account", body "This email is already linked to another Cojam account. Log out and log in with the address you used first." Button "Log out" |
| Registration refused: provider not supported | Same title, body "This email provider is not supported yet. Log out and use an address from: {list}." Button "Log out" |
| Registration refused: too many sign ups | Same title, body "Too many new accounts were made from this device or network. Try again tomorrow." Buttons "Try again", "Log out" |
| Registration refused: other checks | Same title, body "This account could not be registered." Button "Log out" |
| Device setup failed | "We could not get this device ready. Check your connection and try again." Button "Try again" |
| Done | Panel closes: new user to A2 (or Home if A2 is done), returning user to Home |

Next: new user, A2; returning user, Home (through the setup panel when needed).

### A2 First run

**Purpose**: explain the loop in three short panels and confirm the language, while setup finishes behind it.
**Entry**: once per account after the first login (`[api]` `onboarded=false`), also from P1 "How Cojam works".

| Block | Elements |
| --- | --- |
| Language row (panel 1 only) | Segmented switch "EN" / "한국어" / "日本語", preselected from A1 |
| Panel 1 | Title "Five predictions a day", body "A new set of 5 opens every day at {time}. Swipe left or right to pick." ({time} is 09:00 KST in the device's time zone.) Illustration: card stack |
| Panel 2 | Title "Earn points", body "Finish all 5 to get 100P. Each correct pick adds 50P about 6 hours after the answer is set." Values from `[api]` reward settings |
| Panel 3 | Title "Points to CT", body "Turn every 1,000P into 1 CT, from 7 days after you join. The weekly Top 10 share a CT prize. You never pay a fee to play." |
| Setup line | Small line at the bottom of every panel while setup runs: "Setting up your game" with a spinner; "Ready to play" with a check when done |
| Progress | Three dots, current one volt |
| Actions | "Next" (primary) on panels 1 and 2, "Start predicting" on panel 3; "Skip" (ghost) top right |

States: setup still running when the user taps "Start predicting" or "Skip": the button shows a spinner and "Setting up your game", then goes to Home on its own; setup refused or failed: the A1 setup panel takes over with its refused or failed state; saving language fails silently (kept `[local]`, retried later). Swipe between panels plus buttons; panels are a list for screen readers. Done: `[api]` set `onboarded=true`, go to Home.

### H1 Home, card view

**Purpose**: answer today's remaining predictions by swiping.
**Entry**: Home tab, app launch, H3 when a new set opens, view switch from H2.

| Block | Elements | Source |
| --- | --- | --- |
| Header | 2.1 | |
| Title | h1 "Today's predictions", sub "5 new predictions every 24 hours" | static |
| View switch | Segmented "Card view" / "Terminal view" | `[local]` last choice, default Card |
| Progress | "{answered}/5" label plus 5 segments; answered segments volt, pending segment striped, empty segments mist. Label for screen readers "{answered} of 5 answered" | `[chain]` picks of this set, plus `[local]` pending picks |
| Set timer | "Closes in {hh:mm:ss}" small line | `[api]` set close time, server time offset |
| Card stack | Top card plus up to 2 cards peeking behind (only unanswered questions, in set order) | `[api]` today's set |
| Card | Category chip ("Crypto", "Sports" and so on); question text (20 px, up to 4 lines); detail line "Answer: {resolve rule summary}" when given; answer note "Set automatically by AI after {resolve time}"; two choice buttons, left choice and right choice, label from the question ("Down" / "Up", "No" / "Yes"); question number "Question {n} of 5" | `[api]` |
| Hint | "Swipe left or right, or tap a choice." Shown on the first two sets only (`[local]` counter) | `[local]` |
| Pick status list | Under the stack, one line per sent pick still waiting: "Q{n}: {choice}, saving" | `[local]` queue |

Swipe and commit rules (component detail in 6.3):

- Drag right commits the right choice, drag left the left choice. The choice under the drag direction highlights as the card moves.
- Commit when horizontal travel is 35% of card width or more, or fling velocity is 0.5 px/ms or more with travel of 15% or more. Otherwise the card springs back.
- Vertical drag over 10 px before horizontal travel reaches 10 px hands the gesture to page scroll.
- Tap on a choice button commits that choice at once (same animation).
- After commit the next card comes forward; the progress segment for that question turns striped (pending) and then volt on confirmation.

Pick transaction (founder decision, optimistic UI): every swipe or tap sends its own gas sponsored transaction in the background, signed on this device by its play key (no Cojam wallet signature and no prompt per pick; DEV-PLAN 4). The next card appears at once; nothing waits for confirmation and no progress sheet is ever shown for a pick. Picks are sent in commit order from a `[local]` queue, so a fast user can have several in flight.

Per card sync indicator (small, never blocking):

| Sync state | Where it shows | Display |
| --- | --- | --- |
| Sending | The question's progress segment, and the pick status line under the stack | Segment striped; line "Q{n}: {choice}" with a 12 px spinner, label "Saving" for screen readers only |
| Retrying | Same | Same look as Sending (the user is not told about quiet retries) |
| Confirmed | Same | Segment turns volt; the line fades out after 1 s |
| Failed for good | The card itself | See below |

Retry policy (one policy, the same as DEV-PLAN 4.7): a failed send (timeout, sponsor busy, nonce clash, RPC error) is retried automatically after about 1, 2, 4, 8, 16 and 30 s, then every 30 s, until the question closes, with no message. Before each retry the client reads the chain; if the pick is already there it counts as confirmed and is not resent. Retries pause while offline and resume on reconnect while the question is still open.

While it keeps failing (3 failed attempts or 60 s), a slim banner shows above the stack, without stopping the retries: "1 pick is still being saved" (plural "{n} picks are still being saved") with "Retry now".

The card comes back only for a non retryable failure while its question is still open (an unexpected rejection): it returns to the top of the stack as unanswered, its segment returns to empty, and the card carries a short inline note "Not saved. Pick again." plus the toast "Your pick on question {n} was not saved." with "Try again" (2.3). If the question closed before the pick could be saved, the card does not come back; the row reads "Not saved: the question closed" (7.1). Focus does not jump to the returned card; the live region announces "Question {n} was not saved. It is back in your stack."

Play key banners (above the stack; picks made meanwhile stay queued and are sent once the device is ready again):

| Case | Banner | Action |
| --- | --- | --- |
| Key expired or revoked, being re-authorised (silent, a few seconds) | "Reconnecting this device" with a spinner | none |
| Re-authorisation failed | "We could not reconnect this device. Your picks are kept and will be sent." | "Try again" |
| Key replaced because the account was set up on another device | Panel in place of the stack: title "Cojam is now set up on another device", body "Your account plays on one device at a time. Picks made there count. Play here instead?" | "Play on this device" (re-authorises; the other device then shows this panel) |
| Privy session expired as well | Session expired sheet (2.6) first, then the reconnect banner | |

States:

| State | Display |
| --- | --- |
| Loading | Title, switch, 5 empty segments, one card skeleton with chip, three text lines and two button shapes |
| Ready, none answered | 5 cards in the stack, progress "0/5" |
| Partly done | Only remaining cards; progress counts committed picks (sending and confirmed); a line above the stack "{n} left today" |
| Picks syncing | Stack continues normally; striped segments and the pick status lines show what is still sending |
| Picks still saving after 60 s | Banner "1 pick is still being saved" with "Retry now"; retries continue until the question closes |
| Reconnecting this device | Banner "Reconnecting this device"; picking stays possible, picks queue |
| Set up on another device | Panel "Cojam is now set up on another device" with "Play on this device" |
| Pick failed for good | Card returns as unanswered with "Not saved. Pick again."; progress count drops by one |
| Fifth pick committed | Go to H3 at once, even while picks are still syncing (H3 reward line rules) |
| No set published | Empty state: title "Today's set is on its way", body "New predictions open at {time}." with countdown; no cards |
| Set closed while open | See edge case 7.1 |
| Error loading set | Block error 2.5 with "Try again" |
| Offline | Cached cards visible, choices disabled, helper "Connect to the internet to pick." |

Actions: commit pick (above); switch to H2 (keeps state); point pill, profile (header).
Validation: a pick is refused client side when its question is past its close time ("This question has closed."), when the set is past its close time ("Today's set has closed. A new set is ready."), when the question is already answered on chain ("You already picked on this question."), or offline.

### H2 Home, terminal view

**Purpose**: the same 5 questions as a list for users who prefer reading to swiping.
**Entry**: view switch on H1; remembered choice.

| Block | Elements | Source |
| --- | --- | --- |
| Title, switch, progress, set timer | As H1 | |
| Terminal list | 5 rows in set order | `[api]` set plus `[chain]` picks |
| Row | Number "01" to "05"; question (2 lines, expand on tap); category chip; state cell | |
| Current row expanded | Question in full, detail and answer note as on the card, two choice buttons side by side | |

Row state cell:

| Row state | State cell | Notes |
| --- | --- | --- |
| Answered, confirmed | "Chose {choice}" with check icon | Row muted (still 4.5:1) |
| Answered, sending or retrying | "Chose {choice}" with a 12 px spinner (screen reader label "Saving") | Optimistic: the row reads as answered at once |
| Current (first unanswered) | Button "Pick" (secondary) | Opens the inline choice pair; the plan's "Join" label is replaced by "Pick" because nothing is joined from the user's view (decided default) |
| Remaining | "Remaining" muted | Tap makes it current |
| Failed for good | "Not saved" in down colour plus "Pick again" | Row returns to unanswered and becomes current if no other row is |

Picks in H2 follow the same optimistic rules, retry policy and play key banners as H1: tapping a choice marks the row answered at once, sends its own transaction in the background, the next unanswered row opens immediately, retries happen without a message until the question closes, and only a non retryable failure returns the row with "Not saved". No progress sheet. Only one row is expanded at a time. Rows answered earlier stay visible here (the list view shows the whole set so the user can see what they picked); the card view shows only the remaining ones, as the plan asks.

States: loading (5 row skeletons), empty and error and offline as H1. When the 5th pick is committed, go to H3 at once (confirmations may still be pending).

### H3 Day done with countdown

**Purpose**: close the day, confirm the 100P, point to what comes next.
**Entry**: 5th pick committed (optimistic: shown at once, while earlier picks may still be confirming); opening Home while the current set is complete.

| Block | Elements | Source |
| --- | --- | --- |
| Progress | "5/5"; confirmed segments volt, still syncing segments striped | `[chain]` plus `[local]` queue |
| Moment | Volt check badge; h1 "Today's 5 predictions done" | |
| Reward line | Until the fifth pick's transaction is mined: "Saving your picks. 100P follows." with a small spinner, and the 100P is not added to the point pill. The 100P is credited in that same transaction, so as soon as it is mined and the reward event is read: "+100P paid", the pill counts up and the toast "+100P paid." fires. Never shown before confirmation (REVIEW A4). If a pick fails for good: the screen returns to H1 or H2 with that card back as unanswered and the line is gone | `[chain]` picks and completion reward event |
| Countdown | Label "Next set in", value "hh : mm : ss" (display type, tabular), screen reader text updated every minute only: "Next set in {h} hours {m} minutes" | `[api]` next open time, server offset |
| Hit note | "Each correct pick adds +50P about 6 hours after its answer is set. Every answer is set within 48 hours after today's set closes." | `[api]` hit points value, settle delay |
| Today's picks | Compact list of the 5 picks: question (1 line), choice, then "Waiting for answer", "Hit: +50P lands about {time}", "Hit +50P" or "Miss" | `[chain]`, `[api]` |
| Actions | Primary "See weekly ranking" (K1); secondary "See results" (R1) | |

States: picks syncing (reward line "Saving your picks. 100P follows."); reward confirmed ("+100P paid"); fifth pick failed for good (back to H1 or H2, see above; there is no separate reward failure because the reward is paid in the fifth pick's transaction); countdown at zero: "Loading the new set" then H1 or H2 with a toast "New predictions are open."; offline: countdown keeps running from the cached time, reward line shows last known state.

### R1 Results

**Purpose**: show the outcome of past picks, hits and points earned.
**Entry**: Results tab, toast "See results", H3.

| Block | Elements | Source |
| --- | --- | --- |
| Title | h1 "Results" | |
| Summary card | "This week": points earned "{p}P", hits "{h} of {n}", days completed "{d} of 7", and when any: "Pending" "+{q}P" (hits still inside the correction window). "All time": points earned, hit rate | `[api]` aggregates of `[chain]` events |
| Filter | Segmented "All" / "Waiting" / "Set" | `[local]` |
| Day groups | Newest first. Group header: date, "Completed: +100P" or "{k} of 5 answered", day total "+{p}P" (confirmed only) and "+{q}P pending" when any. Each question of a day settles on its own, so a slow question never holds back the others | `[api]` |
| Result row | Question (2 lines), category chip, "You: {choice}", outcome cell | `[api]` question and answer, `[chain]` pick and payout |
| Load more | Button "Show earlier days" (pages of 7 days) | `[api]` |

Outcome cell:

| Case | Cell |
| --- | --- |
| Waiting for answer | "Waiting for answer" plus expected time "Expected {date time}" (always within 48 hours after the day's set closed) |
| Hit, paid | "Hit" tag (up colour) and "+50P" |
| Hit, pending (inside the 6 hour correction window) | "Hit" tag and "+50P lands about {time}", helper on expand: "Answers can be checked again for 6 hours before points are paid." |
| Miss | "Miss" tag (neutral, not red: a miss is not an error) |
| Not answered | "Not answered" muted, no points |
| Corrected | "Corrected" tag plus line "The first answer was wrong. Corrected on {date}." and the compensation line if any, "+50P added" |
| Void | "Cancelled" tag plus "This question was cancelled. No points either way. Your 100P for finishing the day is not affected." (also used when no answer could be set within 48 hours) |

Row tap expands: the answer, the AI's evidence summary (one or two lines) and source links, set time. Source: `[api]`.

States: loading (summary skeleton, 3 group skeletons); empty (no picks yet): title "No results yet", body "Your picks appear here once you play.", button "Go to today's predictions"; filter empty: "Nothing waiting. All your answers are set." / "No answers set yet."; error per block; offline shows cache with stamp.

### K1 Weekly ranking

**Purpose**: show the week's Top 10, the prize, and where the user stands.
**Entry**: Ranking tab, H3 button.

| Block | Elements | Source |
| --- | --- | --- |
| Title | h1 "Weekly ranking", sub "Ranked by points earned this week." | |
| Prize pool card | Label "This week's pool", value "{pool} CT", line "{qualified} qualified players x 1 CT, up to 10,000 CT", "Ends in {d}d {h}h" and the end time (Monday 09:00 KST); disclosure "How the pool works": "Players count when they play on 3 or more days of the week and joined more than 7 days ago. Prizes are sent on Wednesday at 21:00 KST, after every answer of the week is in." plus ranks 1 to 10 with percent and CT | `[api]` settings and qualified count, server time |
| Last week line | If the user won last week: "You placed {rank} last week. {amount} CT was sent to your wallet." | `[api]`, `[chain]` |
| Top 10 list | Row: rank (1 to 10, always distinct, 7.5), display name or short address "0x12ab…cdef", points "{p}P", prize "{c} CT". Rows with equal points carry a "Tied" tag. Top 3 get a volt rank badge. Points shown are confirmed; pending hits are not ranked until they land | `[api]` ranking snapshot, refresh every 60 s while visible |
| Updated stamp | "Updated {n}s ago" | `[api]` |
| Pinned own row | Fixed above the tab bar: "You", rank "{r}", "{p}P", and "{gap}P to Top 10" | `[api]` |

Own row variants: inside Top 10: row in the list gets a volt edge and the pinned row reads "You are in the Top 10" plus the prize; ranked outside: "{gap}P to Top 10"; no points this week: "No rank yet. Finish today's 5 to get on the board." with button "Play today's set" when the set is open.

States: loading (card skeleton, 10 row skeletons); fewer than 10 eligible players: only filled rows show, prizes of empty ranks show "Not awarded" (the unused prize stays in the reward reserve); last week being finalised (Monday 09:00 KST to Wednesday 21:00 KST): a "Last week" tab beside "This week" reads "Week closed. Late answers can still add points until {Wednesday 21:00 KST}, then prizes are sent."; prizes sent: "Prizes sent." with a Kaiascan link; error, offline as usual.

### S1 Staking, new stake

**Purpose**: lock CT for a period and earn interest.
**Entry**: Staking tab (when the user has no stakes), segmented switch from S2.

| Block | Elements | Source |
| --- | --- | --- |
| Title and switch | h1 "Staking", segmented "New stake" / "My stakes ({n})" | `[chain]` stake count |
| Holdings | "Available" "{balance} CT"; in Korean only, the KRW line "약 {krw}원" (no fiat in EN and JA) | `[chain]` CT balance, KRW from the swap site's live price source |
| Amount | Amount input (unit "CT"), "Max" button, helper "Minimum 100 CT" | user |
| Period | Period selector: 30 / 90 / 180 / 365 days, each showing its rate for the current amount tier | `[chain]` staking rate table |
| Summary rows | "Tier" (set by the size of this stake): "Under 1,000 CT" / "1,000 to 9,999 CT" / "10,000 CT and more"; "Annual rate": "{r}%"; "Interest over {d} days": "{x} CT"; "Unlocks on": "{date}"; in Korean only "Value": "약 {krw}원" | computed from `[chain]` table, client side |
| Rules line | "Interest builds every second until the unlock date, then stops. While locked you can take interest out from 10 CT; after unlock, any amount. Your CT unlocks after {d} days. There is no early exit." | `[chain]` minimums |
| Action | Primary "Stake {amount} CT" (disabled until valid); note "No fee: Cojam pays the network fee." | |
| Help | Disclosure "How staking works" with the full rate table | `[chain]` |

Validation (on input, message under the field, field red edge):

| Rule | Message |
| --- | --- |
| Not a number (parser accepts "1,250.5", "1250", "40 CT") | "Enter an amount in CT, like 250." |
| More than 18 decimals | "Use at most 18 decimal places." |
| Below minimum | "The minimum stake is 100 CT." with fix button "Stake 100 CT" when balance allows |
| Above balance | "You have {balance} CT." with fix button "Use {balance} CT" |
| Zero balance | Field disabled; note "You have no CT yet. Deposit CT or convert points first." buttons "Deposit" (W3), "Convert points" (W2) |
| No period chosen | Button stays disabled; helper "Choose a period." (default: 90 days preselected) |
| Staking full (the interest fund cannot reserve this stake's interest) | Note warn: "Staking is full for now." When some room is left: "Right now you can stake up to {x} CT for {d} days." with fix button "Stake {x} CT"; else "New stakes open again when Cojam adds interest funds." Button disabled |
| 20 open stakes | Note: "You have 20 open stakes, the most allowed. Withdraw an unlocked stake to open a new one." Button disabled |

Transaction: two steps when allowance is short (approve, stake), one otherwise; sheet 2.2. Success: title "Staked {amount} CT", rows "Unlocks on {date}", "Annual rate {r}%", button "See my stakes" (S2). Review step first when amount is 10,000 CT or more.

States: loading (holdings skeleton, inputs disabled); staking full (above; the full interest of every stake is reserved when it opens, so existing stakes are never affected); staking paused (pause covers new stakes only): note "New stakes are paused. Your stakes keep earning and can be claimed and withdrawn." button disabled; error; offline.

### S2 My stakes

**Purpose**: watch interest grow, claim interest, take the principal back after unlock.
**Entry**: Staking tab (when stakes exist), S1 switch, W1 "Staked" row, success sheet.

| Block | Elements | Source |
| --- | --- | --- |
| Title and switch | As S1 | |
| Totals | "Staked" "{sum} CT"; "Interest so far" "{sum} CT" ticking every second; "Claimable now" "{sum} CT" | `[chain]` positions, ticking computed client side from rate and start, re read every 30 s |
| Stake list | One card per stake, newest first; ended and fully withdrawn stakes under a "Closed" disclosure | `[chain]` |
| Stake card | Amount "{a} CT"; period "{d} days at {r}%"; progress bar from start to unlock with "Day {x} of {d}"; "Started {date}", "Unlocks {date}"; "Interest" "{i} CT" (ticking); status tag "Locked" / "Unlocked" / "Closed" | `[chain]` |
| Card actions | "Claim {i} CT interest" (secondary); "Withdraw {a} CT" (primary, only after unlock) | |

Action rules:

| Condition | Claim interest | Withdraw principal |
| --- | --- | --- |
| Locked, interest under 10 CT | Disabled, helper "You can claim from 10 CT. {10 minus i} CT to go." | Hidden; line "Unlocks on {date}" |
| Locked, interest 10 CT or more | Enabled | Hidden |
| Unlocked | Enabled for any amount (interest stopped at the unlock date) | Enabled: "Withdraw {a} CT" (pays the principal and all remaining interest) |
| Closed | none | none |

Transactions through sheet 2.2. Success copy: "Claimed {i} CT interest." / "Withdrew {a} CT. It is in your wallet." Unlock moment: when a card crosses its unlock time while visible, its tag flips to "Unlocked" and the withdraw button appears (no reload).

States: loading (totals and 2 card skeletons); empty: "No stakes yet", body "Stake CT to earn interest every second.", button "Start a stake" (S1); error, offline (tickers stop and show "Paused while offline").

### W1 Wallet

**Purpose**: one place for balances and the address, and the door to convert, deposit and withdraw.
**Entry**: Wallet tab, point pill.

| Block | Elements | Source |
| --- | --- | --- |
| Title | h1 "Wallet" | |
| Points card | "Points" "{p}P" (confirmed); row "On the way" "+{q}P, lands about {time}" when hit points are pending; line "{p div 1,000} CT ready to convert" when 1,000P or more; button "Convert points" (primary on this screen) | `[chain]`, `[api]` pending hits |
| CT card | "CT" "{c} CT", in Korean only the KRW line "약 {krw}원"; row "Staked" "{s} CT" with chevron to S2 | `[chain]` |
| KAIA card | "KAIA" "{k} KAIA"; helper "Only needed to withdraw CT to another wallet." | `[chain]` native balance |
| Address | Label "Your Cojam wallet on Kaia", address chip with full address in monospace, copy and "View on Kaiascan" | `[privy]` |
| Actions | "Deposit" and "Withdraw" (secondary, side by side) | |
| Token note | "CT here is new CT: 0x91cb3B346C80ff965a9667ba6228834dbedD71a2" with copy | static, from network config |
| Stamp | "Updated {n}s ago", pull to refresh | |

States: loading (card skeletons); zero balances shown as "0P", "0 CT", "0 KAIA" (not empty states); error per card; offline shows cache with stamp, actions disabled.

### W2 Convert points to CT

**Purpose**: turn points into CT at the current rate.
**Entry**: W1 "Convert points", S1 zero balance note.

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Convert points" | |
| Balance | "Available" "{p}P" | `[chain]` |
| Amount | Input in points, unit "P", "Max" (largest multiple of 1,000 at or under the balance), step hint "In steps of 1,000P" | user |
| Result | "You get" "{n} CT" (large) | computed from `[chain]` rate |
| Rows | "Rate": "1,000P = 1 CT"; "Minimum": "1,000P"; "Daily limit": "50 CT a day. {left} CT left today."; "Fee": "None. Cojam pays the network fee." | `[chain]` settings and today's conversions |
| Rank note | "Converting does not change your weekly rank." | static |
| Action | Primary "Convert {p}P to {n} CT" | |

Validation:

| Rule | Message |
| --- | --- |
| Under 1,000P | "The minimum is 1,000P." |
| Not a multiple of 1,000 | "Convert in steps of 1,000P. Try {floor}P." fix button "Use {floor}P" |
| Above balance | "You have {p}P." fix button "Use {max}P" |
| Balance under 1,000P | Input disabled; empty state "You need 1,000P to convert. You have {p}P, {gap}P to go." button "Play today's set" |
| Account younger than 7 days | Input disabled; note "New accounts wait 7 days before the first conversion. You can convert from {date time}." Points keep growing meanwhile |
| Above the personal daily limit | "You can convert {left} CT more today, which is {leftP}P." fix button "Use {leftP}P" |
| Personal daily limit used up | Input disabled; note "You reached today's limit of 50 CT. You can convert again after {time}." ({time} is the next 09:00 KST) |
| Everyone's daily limit reached (20,000 CT a day in total) | Input disabled; note "Today's conversions are used up for everyone. Try again after {time}." |

Success: "Converted {p}P to {n} CT." rows "Points left {x}P", "CT balance {y} CT". Conversion reserve short: 2.5 copy, button disabled.

### W3 Deposit

**Purpose**: receive new CT (and KAIA for withdraw gas) from another wallet or an exchange.
**Entry**: W1 "Deposit", S1 zero balance note, W4 "not enough KAIA" fix.

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Deposit" | |
| Lead | "Send new CT or KAIA to this address on the Kaia network." | static |
| QR block | QR of the address (plain address, no URI scheme), mark in the centre | `[privy]` |
| Address chip | Full address, monospace, wraps in groups; "Copy address" button (primary on this screen) | `[privy]` |
| Network row | "Network" "Kaia (chain ID 8217)" | static |
| Token row | "Token" "new CT" and full contract `0x91cb3B346C80ff965a9667ba6228834dbedD71a2` with copy | static |
| Warnings (note, warn style) | "Send only on Kaia. Tokens sent on another network can be lost." / "Old CT does not work here. Swap it first at cojam.app." with link "Swap old CT" / "Sending from an exchange? Choose the Kaia network for the withdrawal." | static |
| Watching | "Waiting for deposits" with live dot; on arrival the line becomes "{amount} CT arrived" and a toast fires | `[chain]` balance poll every 10 s while open |
| Share | "Share address" (Web Share API where present) | |

States: loading (QR skeleton square, address skeleton); address unavailable (Privy error): "We could not load your wallet address. Try again."; offline: address still shown from cache with "Deposits will show when you are back online."

### W4 Withdraw

**Purpose**: send CT to another wallet. The user pays the gas in KAIA.
**Entry**: W1 "Withdraw".

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Withdraw CT" | |
| Gas note (always) | "Withdrawals are not sponsored. You pay a small network fee in KAIA." Line "Your KAIA: {k} KAIA" | `[chain]` |
| To | Field "To address" with paste button (no QR scan at launch) | user |
| Amount | Amount input in CT with "Max", "Available {c} CT" | `[chain]` |
| Fee row | "Network fee" "about {fee} KAIA" | `[chain]` gas estimate |
| Action | Primary "Withdraw {amount} CT" leads to the review sheet | |

Validation:

| Rule | Message |
| --- | --- |
| Empty address | "Enter the address to send to." |
| Malformed (not 0x plus 40 hex) | "This is not a Kaia address. It starts with 0x and has 42 characters." |
| Mixed case checksum fails | "Check this address. One or more letters are wrong." |
| Own address | "This is your own Cojam wallet. Enter another address." |
| A token or contract address known to swallow tokens (new CT, old CT, swap, staking, prediction contracts) | "This is a contract address, not a wallet. CT sent here is lost." (blocks) |
| Amount invalid, zero, above balance | as S1 rules, "You have {c} CT." |
| KAIA under the fee estimate | Button disabled; note error: "You need about {fee} KAIA for the network fee. You have {k} KAIA." fix button "Deposit KAIA" (W3) |

Review sheet (always): "Send {amount} CT", "To {full address}", "Network fee about {fee} KAIA", checkbox "I checked the address. Sends on Kaia cannot be undone." Primary "Send {amount} CT". Success: "Sent {amount} CT." with Kaiascan link.

States: loading; offline; Max subtracts nothing (fee is KAIA, not CT).

### P1 Profile and settings

**Purpose**: name in the ranking, language, account, links.
**Entry**: header profile button.

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Profile" | |
| Account | "Logged in as {email}" (the full address, shown to the user only); wallet address chip (short form, copy) | `[privy]` |
| This device | "Ready to play on this device" with "until {date}" (the play key's expiry; renewed on its own); or "Not set up on this device" with button "Set up this device" (runs the A1 setup panel); or "Set up on another device" with "Play on this device" | `[chain]` play key, `[local]` |
| Display name | Field "Name in the ranking", helper "Shown to everyone on the weekly ranking. Leave empty to show your short address."; button "Save name" | `[api]` |
| Language | Segmented "EN" / "한국어" / "日本語" (applies at once) | `[local]` and `[api]` |
| View | Segmented "Card view" / "Terminal view" (same setting as the Home switch) | `[local]` |
| Help | "How Cojam works" (opens A2 panels), "How answers are set" (disclosure: "An AI checks public sources after each question closes and sets the answer automatically. If an answer turns out wrong, Cojam corrects it and pays the points owed.") | static |
| Links | "Swap old CT" (cojam.app/migrate/), "Cojam website" (cojam.app), Terms and Privacy when they exist (Q24) | static |
| Log out | Button "Log out" (secondary, down colour text) with confirm sheet "Log out of Cojam?" body "Your points and CT stay in your wallet. This device stops playing for you until you log in again with the same email." buttons "Log out", "Cancel". Log out revokes this device's play key and deletes it | `[privy]`, `[chain]` |
| Version | "Version {x}" and "Check for update" | service worker |

Display name validation: 2 to 20 characters; letters, numbers, spaces, `_` and `.`; Hangul and kana allowed; no leading or trailing space; must not look like an address (`0x` followed by hex) or contain "cojam" or "admin" (case blind). Names are not unique; a basic word list blocks offensive names, and admins can reset a name. Messages: "Use 2 to 20 characters.", "Use letters, numbers, spaces, _ or . only.", "This name looks like an address or staff name. Pick another.", "This name is not allowed. Pick another." Success toast "Name saved."

---

## 4. Admin screens

Shared admin frame: desktop layout, left side nav (Dashboard, Reward settings, Questions, Answers, Ranking and airdrop, System), top bar with environment badge ("Mainnet" in ink, "Test" in warn), signed in admin, "Sign out". Every page has an updated stamp. Every change that writes on chain shows the signer, the transaction and the result in the shared log viewer. Owner actions (reward settings, corrected outcomes after the window, unfreeze, reserve withdrawals) are built by the admin and signed and paid by the owner, the master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb`, connected in the browser for that one transaction; the server never signs them. Operator actions (freeze, correction inside the window, airdrop retry) are sent by the operator key through the worker. Language: English only.

### AD0 Admin sign in

| Block | Elements |
| --- | --- |
| Card | Title "Cojam admin", body "Sign in with an approved email." Email field and "Send code", then the code field and "Sign in" (Privy email login, a separate admin Privy app) |
| Allow list | Only addresses in the admin allow list (`admin_users`, roles viewer, operator, owner) get a session; the allow list is managed in AD6 by an owner role |
| Errors | "This email is not approved for the admin." / "That code is not right." / "This code has expired. Send a new code." / "Sign in failed. Try again." |
| Session | Idle sign out after 30 minutes: "You were signed out after 30 minutes without activity." |

### AD1 Dashboard

| Block | Elements | Source |
| --- | --- | --- |
| Alerts strip | Red or amber items with a link to the screen: "Gas wallet below {x} KAIA", "Reward wallet covers {d} days", "Tomorrow has {n} of 5 questions", "{n} answers waiting past their time", "Job {name} failed {t} ago" | `[api]` |
| Today | Set status ("Live, closes in {t}"), players today, picks today, completion rate, hits paid | `[api]` |
| KPI grid | Signed up users, active this week, points issued (today, week), points converted, CT paid by conversions, staked CT total, interest owed, this week's pool | `[api]`, `[chain]` |
| Charts | Daily players and completions (30 days), points issued vs converted (30 days) | `[api]` |
| Recent activity | Log viewer filtered to the last 50 system events | `[api]` |

### AD2 Reward settings

Form, grouped. Each field shows current value, the new value input and where it is stored (contract or server).

| Field | Initial | Rule | Error copy |
| --- | --- | --- | --- |
| Completion points | 100 | integer 0 to 1,000 | "Enter a whole number from 0 to 1,000." |
| Points per hit | 50 | integer 0 to 1,000 | same |
| Conversion rate | 1,000P = 1 CT | points per CT, integer 100 to 100,000 | "Enter how many points make 1 CT, from 100 to 100,000." |
| Minimum conversion | 1,000P | a multiple of the rate, up to 1,000,000 | "The minimum must be a multiple of the rate." |
| Conversion limit per user per day | 50 CT | 1 to 10,000 | "Enter 1 to 10,000." |
| Conversion limit per day, everyone | 20,000 CT | 100 to 1,000,000 | "Enter 100 to 1,000,000." |
| Wait before the first conversion | 7 days | 0 to 30 days | "Enter 0 to 30 days." |
| Correction window (settle delay) | 6 hours | 0 to 48 hours | "Enter 0 to 48 hours." |
| Treasury | master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb` | 0x address, checksum | "Enter a valid Kaia address." |
| Weekly pool per qualified player | 1 CT | number 0 or more (server setting) | "Enter 0 or more." |
| Weekly pool cap | 10,000 CT | 0 to 1,000,000 | "Enter 0 to 1,000,000." |
| Top 10 split | 30, 20, 15, 10, 7, 5, 4, 3, 3, 3 | 10 percentages, each 0 to 100, sum exactly 100, non increasing | "The split must add up to 100%. Now {s}%." / "A lower rank cannot get more than a higher rank." |
| Staking rate table | the 4 x 3 table | percent 0 to 50, two decimals | "Enter a rate from 0 to 50." |
| Staking tiers | 1,000 and 10,000 CT | ascending | "Tier limits must go up." |
| Minimum stake | 100 CT | 1 to 100,000 | "Enter 1 to 100,000." |
| Minimum interest claim | 10 CT | 0 to 1,000 | "Enter 0 to 1,000." |

Flow: "Review changes" shows a diff table (old, new, effective from), then "Sign with the owner wallet". Effective from: prediction contract values apply 48 hours after the owner's proposal (announced on chain), then the owner applies them; staking values apply to new stakes at once and never change an open stake; server settings apply at once. Pending on chain changes show the transaction state and the time they can be applied. Save fails: "Not saved: {reason}. Nothing changed."

### AD3 Questions

| Block | Elements |
| --- | --- |
| Calendar strip | Next 14 days, each with "{n}/5" filled; days under 5 marked amber |
| Toolbar | "Assign 5 per day" (fills empty slots from the AI queue for the next 14 days), "Add question", filter by state, search |
| Table | Publish day, slot (1 to 5), question, choices (left / right), category, closes at, answer due, state chip, source ("AI" or "Manual"), actions |
| AI queue | Drafts not yet scheduled, with AI's resolve rule and suggested source; row actions "Schedule", "Edit", "Discard" (allowed until the day is published on chain; no approval step) |
| Question form | Question (max 90 characters, the card limit), left choice and right choice (max 12 each), category (list), publish day and slot, closes at (default: set close), answer due (at most 24 hours after the set closes, so the answer is set within 48 hours), resolve rule (how the answer is decided), sources (URLs), languages KO and JA (AI drafted, editable) |

State chips: "Draft", "Scheduled", "Live", "Closed", "Answer set", "Corrected", "Cancelled".
Validation: "A day can hold 5 questions." / "Both choices are needed." / "Answer due must be after the close time." / "Answer due must be within 24 hours after the set closes." / "Add at least one source." / "Live questions cannot be edited." (only cancel, which voids the question: no hit points, the pick still counts toward the 5).

### AD4 Answers

| Block | Elements |
| --- | --- |
| List | Questions after close: question, closed at, AI answer, confidence if the AI gives one, set at, correction window ends at, hits paid or pending, deadline (set close plus 48 hours), state chip; filter "Waiting", "Set", "Corrected", "Late" (past due), "Near deadline" (less than 8 hours to the 48 hour deadline, after which the question is cancelled) |
| Detail | Question and resolve rule; AI answer; evidence: sources with link, quoted text, fetched time; on chain set transaction; pick counts per choice; hits paid |
| Log | Log viewer of the AI run: prompts, tool calls, retries, errors, timestamps |
| Correction tool | "Correct this answer": choose the right answer, reason (required), preview impact table ("{a} players who picked {right} will get +{p}P", "{b} players were paid for {wrong}: they keep their points"), "Apply correction". Inside the correction window the operator key replaces the answer before anyone is paid; after it, the owner wallet signs the corrected answer and the operator pays the compensation. Records everything in the log |
| Retry | For failed or late runs: "Run AI again" |

Errors: "Give a reason for the correction." / "This answer is already being corrected." / "Correction failed: {reason}. Nothing was paid."

### AD5 Ranking and airdrop

| Block | Elements |
| --- | --- |
| Week selector | This week, past weeks |
| Pool | Qualified players (played 3 or more days, account older than 7 days, not frozen), pool per player, pool total (capped at 10,000 CT), split table with CT per rank |
| Ranking table | Rank, display name, address (full, copy), points this week, prize CT, tie note ("Tied: reached {p}P first"), flags; row action "Reset name" |
| Airdrop | Automatic on Wednesday 12:00 UTC (21:00 KST), after every answer of the week is in. Status: "Not due", "Waiting for late answers", "Ready", "Sending", "Sent", "Failed"; transaction link per payout; button "Retry airdrop" only after a failure; reserve check: "The reward reserve has {x} CT, this airdrop needs {y} CT." |
| Export | "Download CSV" |

### AD6 System

| Block | Elements |
| --- | --- |
| Wallets | Gas wallet (fee payer: address, KAIA balance, days of runway at the current spend, alert threshold field); operator wallet (KAIA, runway); prediction reserve (CT balance, conversions per day, next airdrop, runway); staking interest fund (available, committed interest, principal held); treasury and owner (the master wallet address) |
| Sponsorship | Sponsored in the last hour by action (predict, play key setup, value actions), refusals by code, median confirm time, play keys set today, last error |
| Email allow list | Table of supported providers: domain, display name (shown in A1), normalisation rule ("Gmail: dots and +tags removed", "+tags removed", "None"), enabled switch, sign ups in the last 7 days, refusals in the last 7 days; "Add provider" form (domain, display name, rule); every change asks for a reason and is written to the log. Validation: "Enter a domain like example.com." / "This domain is already listed." Removing or disabling a provider stops new sign ups only; existing players keep playing. Edit rights: owner and operator roles |
| Admin allow list | Approved admin emails and roles; add and remove (owner role only) |
| Jobs | Table: question publisher, AI drafter, AI answer setter, registration queue, settle sweep (per question), ranking aggregator, airdrop sender, deposit watcher; columns last run, result, next run, "Run now" |
| Chain | RPC endpoint health, block height lag |
| App | Running version, minimum version field, maintenance switch with message and expected end (needed for 2.6) |
| Log viewer | All events, filter by job and level |

Status chips: "Healthy", "Slow", "Failing", "Off".

---

## 5. Edge cases

| # | Case | Behaviour |
| --- | --- | --- |
| 7.1 | Set rollover while the app is open | At the close time the client refetches. If the user is on H1 or H2 with picks left: cards fade, message "Today's set has closed. A new set is ready." with button "Show new set". Picks already sent before close but confirmed after: valid if the contract accepts them by its own time check; if rejected, the row shows "Not saved: the set closed" and no completion reward. On H3 the countdown reaching zero loads the new set (H3 states) |
| 7.2 | Pick sent, answer not set yet | R1 and H3 show "Waiting for answer" and the expected time. If the answer is late past its due time: "Answer is late. It will be set automatically." |
| 7.3 | User answered only some of 5 | No 100P. The unanswered questions show "Not answered" in R1 after close. Hits on the answered ones still pay 50P each |
| 7.4 | Answer correction and compensation | R1 row gets "Corrected" with date and line; points owed are paid and toasted "Answer corrected on question {n}: +{p}P." Treatment of points already paid on the wrong answer depends on Q5; the UI never silently lowers a balance |
| 7.5 | Ranking ties | Same points share a rank (1, 2, 2, 4). Prize split for ties needs Q12; until settled the UI shows the tie note "Tied" and the prize the rule gives |
| 7.6 | Week boundary | Ranking counts points earned between the week start and end in the week's time zone (Q8). Points from hits paid after the boundary for questions of the old week count in the week they are paid (Q8 confirm). K1 shows "Week closed. Final ranking is being counted." for the minutes the snapshot takes |
| 7.7 | Not enough points to convert | W2 empty state with gap (section W2) |
| 7.8 | Staking below the minimum | S1 validation "The minimum stake is 100 CT." |
| 7.9 | Interest below 10 CT | S2 claim disabled with the gap; at principal withdrawal see Q15 |
| 7.10 | Unlock date | Shown as date and local time at stake creation and on each card; the button appears at the exact second; a stake unlocked while the app was closed shows "Unlocked" on open, and the Staking tab gets a dot |
| 7.11 | Withdraw without KAIA | W4 blocks with the fee message and "Deposit KAIA" fix |
| 7.12 | Privy session expiry | Session expired sheet (2.6); pending picks in the local queue are kept and resent after login if the set is still open |
| 7.13 | In app browser | G1 `inapp` variant; nothing in the in app browser tries to log in |
| 7.14 | iOS limits | No install prompt API: G1 shows steps. Home screen apps on iOS keep their own storage, separate from Safari: the Gate never stores anything the app needs. Storage can be evicted after weeks without use: everything that matters is on chain or on the server, Privy restores the wallet at login, `[local]` holds only caches and preferences, so an eviction means one new login and the view preference resets. iOS has no background sync: queued picks are only sent while the app is open, and resume on the next open while the set is still open |
| 7.15 | App update available | New service worker waiting: toast "A new version of Cojam is ready." with "Reload". Never auto reload during a pick or a transaction. Below the minimum version: blocking Update required screen |
| 7.16 | Maintenance mode | Maintenance screen on every PWA route; Gate unaffected; admin unaffected |
| 7.17 | Two devices or two tabs | Picks are read from chain; the second device shows a pick made on the first after refresh; a duplicate pick is refused: "You already picked on this question." |
| 7.18 | Clock skew on the device | All countdowns use the server time offset from the API, not the device clock |
| 7.19 | Pending pick when the user leaves the app | Queue in `[local]`; on return the app checks the chain first and resends only picks not found |
| 7.20 | Reward wallet empty | Convert, interest claim, principal withdrawal (if paid from it, Q14) show the payouts paused note; nothing is debited |
| 7.21 | Gas sponsor down | Pick, stake and convert show "Cojam could not sponsor this transaction right now." Never fall back to charging the user |
| 7.22 | Display name abuse | Admin can reset a name (AD5 row action "Reset name"); user sees their short address until they save a new one (Q18) |
| 7.23 | Deposit of old CT or another token to the Privy address | Not shown in balances. W3 warns before; no recovery tool in scope (Q19) |
| 7.24 | Question cancelled after publish | R1 "Cancelled" row; the day still counts as complete if the user answered the remaining ones (Q6) |

---

## 6. UI component inventory

Match column: **Reuse** (take as is), **Adapt** (start from the named class and change), **New**. Files: `base.css`, `tokens.css`, `wallet.css`, `landing.css`, `menu.css`, `pages/migrate.css`, `pages/admin.css` under `site/assets/`.

| Component | Used on | Variants and states | Match |
| --- | --- | --- | --- |
| Design tokens | everywhere | colours, type scale, radii, motion durations and easings | Reuse `tokens.css` (copy into the app; one source) |
| App header | all PWA screens | tab root (logo), sub screen (back plus title); safe area top | Adapt `.cj-header`, `.cj-brand`, `.cj-chip` (`base.css`); new back button |
| Point pill | header | loading, ready, pending, stale | Adapt `.cj-price` pill shape (`base.css`) on blue; new content |
| Profile button | header | initial, generic icon, focus | New (44 px round, snow on blue) |
| Bottom tab bar | PWA | 5 items, selected (volt pill behind icon), badge dot, count badge, safe area bottom | New |
| Segmented view switch | H1/H2, S1/S2, R1 filter, P1, A2 language | 2 or 3 options, selected volt, disabled | Reuse `.seg`, `.seg-btn` (`base.css`) |
| Progress segments | H1, H2, H3 | 5 segments: empty, pending (stripes), done (volt), failed (down edge) | Adapt `.track-day` ticks and `.blocks` (`landing.css`) as the signature element |
| Swipe card stack | H1 | idle, dragging left or right (choice highlight, tilt up to 8°), committing, spring back, pending, failed return, disabled (offline or closed) | New. See 6.3 |
| Question card | H1 | as above; category chip; long text (4 lines max, then "More") | Adapt `.step` card (ink 2 px edge, 26 px radius, hard offset shadow on lift) |
| Choice button pair | H1, H2 | left and right, pressed, disabled; selected shows volt | Adapt `.btn` and `.seg-btn` |
| Category chip | H1, H2, R1 | per category, neutral colours only | Reuse `.tag` (`base.css`) |
| Terminal row | H2 | answered, pending, current expanded, remaining, failed | Adapt `.lift-row` and `.mg-row` patterns |
| Countdown | H3, H1 empty, K1 pool | large (H3), inline small; zero state | New (display type from `.track .top b`, `landing.css`) |
| Done moment | H3 | play once, static under reduced motion | Reuse `.cj-cele` check, ring, sparks (`base.css`) |
| Result row | R1 | waiting, hit paid, hit pending, miss, not answered, corrected, cancelled; expanded | Adapt `.mg-lot` (`migrate.css`) with `.tag-up`, `.tag-warn` |
| Day group header | R1 | completed, partial | New |
| Summary stat card | R1, W1 | value, label, loading | Adapt `.stat` (`landing.css`) and `.kpi` (`admin.css`) |
| Ranking row | K1 | rank 1 to 3 badge, 4 to 10, tie, own row highlight | Adapt `.table` rows and `.lift-row` |
| Pinned own row | K1 | in Top 10, outside, unranked | New (sticky above tab bar, ink ground, volt figures) |
| Prize pool card | K1 | loading, with split disclosure, week closed | Adapt `.track` ink card (`landing.css`) |
| Amount input with Max | S1, W2, W4 | empty, typing, valid, error with fix button, disabled; unit suffix; 16 px text | Reuse `.field`, `.field-box`, `.field-unit`, `.field-msg`, `.mg-max` |
| Address input | W4 | empty, valid, invalid, own address, contract warning; paste and scan buttons | Adapt `.field-box` |
| Period selector | S1 | 4 options with rate under each, selected | Adapt `.seg` to a 4 column grid of `.seg-btn` |
| Summary rows | S1, W2, W4, sheets | key and value; value loading; emphasis row | Reuse `.mg-rows`, `.mg-row` (`migrate.css`) |
| Stake card | S2 | locked, unlocked, closed; ticking interest; progress bar | Adapt `.mg-lot` and `.track-rail` |
| Primary button | all | default, hover, pressed, loading (spinner plus label), disabled; one per view | Reuse `.btn.btn-primary` (`base.css`) |
| Secondary button | all | outline ink, ghost, small, block | Reuse `.btn`, `.btn-ghost`, `.btn-sm`, `.btn-block` |
| Sheet | transaction sheet, review, log out, session expired | bottom sheet on phones with grip, dialog on desktop; Esc closes where allowed | Reuse `.cj-sheet`, `.cj-sheet-head`, `.cj-sheet-grip` (`wallet.css`) |
| Transaction steps | sheet | waiting, in progress, done, failed | Reuse `.steps li` (`base.css`) |
| Status chip above tab bar | hidden sheet | sending, done | New |
| Toast | global | plain, with button | Reuse `.toasts`, `.toast` (`base.css`), lifted above the tab bar |
| Note and alert | W3, W4, S1, errors | info, warn, error, ok, with action | Reuse `.note`, `.note-warn`, `.note-error`, `.note-action` |
| Skeleton | all | text line, pill, card, row, QR square | Reuse `.skel` |
| Empty state | R1, S2, W2, H1, offline | icon, title, body, one action | New |
| Offline bar | global | offline, back online | New (ink slim bar like `.cj-banner`) |
| QR block | W3, G1 | loading, ready, with centre mark | Reuse `.cj-qr`, `.cj-qr-ph` (`wallet.css`) |
| Address chip with copy | W1, W3, P1, AD5 | full, short, copied state, explorer link | Reuse `.addr`, `.addr-value`, `.addr-actions` (`base.css`) |
| Install steps | G1 | numbered with icons, per platform | Adapt `.cj-steps` (`wallet.css`) and `.safety ol` numbers (`landing.css`) |
| Link box | G1 copy link | default, copied | Reuse `.cj-linkbox` (`wallet.css`) |
| Help disclosure | S1, P1, A1 | closed, open | Reuse `.help`, `.help-pop` (`base.css`) |
| Language select | G1, A1 | 3 languages | Reuse `.cj-lang` (`base.css`) |
| System screen | maintenance, update, no connection, 404 | title, body, one action | New |
| Admin shell and side nav | AD1 to AD6 | selected, collapsed | Adapt `pages/admin.css` `.adm`, `.adm-head`; new side nav |
| Admin KPI | AD1 | value, unit, sub, loading | Reuse `.kpi-grid`, `.kpi` (`admin.css`) |
| Admin table | AD3 to AD6 | sortable, filter, empty, loading, row actions | Reuse `.table`, `.lots-table`, `.sort-btn`, `.lots-search-box` (`admin.css`) |
| Admin form field | AD2, AD3 | current value, new value, error, disabled, changed marker | Reuse `.field` family; new "current vs new" layout |
| Status chip | AD3 to AD6 | Draft, Scheduled, Live, Closed, Answer set, Corrected, Cancelled; Healthy, Slow, Failing, Off | Reuse `.tag`, `.tag-up`, `.tag-warn`, `.tag-down`, `.tag-sky` |
| Log viewer | AD1, AD4, AD6 | level filter, search, expand JSON, live tail | New (monospace only for hashes, ids and payloads) |
| Calendar strip | AD3 | full, short (amber), today | New |
| Diff review table | AD2 | old, new, effective from | Adapt `.table` |

### 6.1 Live data stamp

Reuse `.live-dot` and the "Updated {n}s ago" stamp from the status page on K1, W1, W3 and AD pages.

### 6.2 Number formatting helper

One shared formatter (points, CT, KAIA, KRW, durations) so every screen agrees; tabular numerals on every figure.

### 6.3 Swipe card stack: interaction spec

| Item | Rule |
| --- | --- |
| Pointer model | Pointer Events, one active pointer, `touch-action: pan-y` on the card so vertical scroll still works |
| Axis lock | First 10 px decides: more vertical than horizontal hands the gesture to scroll |
| Feedback while dragging | Card follows the finger 1:1 on x, rotates up to 8° at full travel, the choice on the drag side scales 1.04 and turns volt from 20% travel |
| Commit | Travel 35% of card width or more, or velocity 0.5 px/ms or more with travel 15% or more |
| Cancel | Release below the threshold: spring back (`--ease-spring`, 180 ms) |
| Button fallback | Two visible choice buttons on every card, always; tapping commits with the same exit animation |
| Keyboard | Card is a group labelled "Question {n} of {remaining}: {question}". Tab reaches the two choice buttons; Left and Right arrow keys commit the matching choice when the card has focus; Enter on a button commits |
| Screen reader | Choices are plain buttons with full labels ("Pick Up for: {question}"); after commit a polite live region says "Picked {choice}. {k} left." and focus moves to the next card's heading; swipe gestures are not required for any path |
| Undo | None after commit (picks are on chain). A pick is final; copy on the first card of the first set: "Picks are final once made." |
| Haptics | `navigator.vibrate(10)` on commit where supported (Android); none on iOS |

---

## 7. Motion and feedback

All motion uses transform and opacity, durations and easings from `tokens.css`. Under `prefers-reduced-motion: reduce` every item below falls back as stated, and loops stop.

| Interaction | Motion | Duration and easing | Reduced motion fallback |
| --- | --- | --- | --- |
| Swipe drag | 1:1 follow, rotate to 8°, choice highlight | live | Same follow (user driven) without rotation |
| Card commit | Card flies out on its side (x to 120%, rotate 14°, fade); next card scales 0.96 to 1 and rises 8 px | 240 ms `--ease-out`; next card 180 ms `--ease-spring` | Card fades out 0 ms, next card appears at once |
| Spring back | Return to centre | 180 ms `--ease-spring` | Instant |
| Progress segment | Pending stripes slide; done fills left to right | stripes 1.2 s loop; fill 240 ms `--ease-out` | Static stripes; instant fill |
| Points count up | Pill and totals count from old to new value after confirmation; pill pulses once (scale 1.06) | 400 ms `--ease-out` | Number swaps at once, no pulse |
| Day done moment | Volt check pops, ring expands, sparks; segments flash in sequence with 50 ms stagger; "+100P paid" counts up when confirmed | 320 to 400 ms, once per set | Static check, text appears at once |
| Countdown | Digits change without animation (no flipping), second digit only | none | none |
| Sheet open and close | Slide up from bottom on phones, fade and scale on desktop | 320 ms `--ease-drawer` | Instant |
| Toast | Rise 12 px and fade | 240 ms `--ease-out` | Fade only |
| Button press | Scale 0.97, held at least 90 ms; volt button presses onto its ink drop | 120 ms press, 180 ms release | Colour change only |
| Interest ticker (S2) | Last digits update every second | none | Updates every 10 s |
| Tab switch | Content crossfade | 160 ms | Instant |
| Unlock moment (S2) | Tag flips, withdraw button rises in | 240 ms `--ease-spring` | Instant |

Loops (stripes, live dot) pause when off screen or when the app is hidden (`visibilitychange`).

---

## 8. Accessibility and mobile rules

- Touch targets 44 x 44 px or more, including the point pill, tab items, chips that act, copy buttons and the swipe choice buttons.
- Inputs use 16 px text so iOS does not zoom; `inputmode="decimal"` for amounts, `inputmode="numeric"` for points, `autocomplete="off"` and `spellcheck="false"` for addresses.
- Safe areas: header top inset, tab bar and pinned rows bottom inset, sheets bottom inset; `viewport-fit=cover`.
- Contrast 4.5:1 for all text, including muted rows and disabled helper text (use `--ink-2`, never lower opacity). Volt is a fill with ink text, never text on snow. Blue mark on ink gets a snow tile.
- Every swipe has the two button path; no feature needs a gesture.
- Focus visible on every control (volt ring on blue, blue ring on snow, as the site).
- One `h1` per screen; tab bar is a `nav` with `aria-current="page"`; segmented switches use `aria-pressed`.
- Live regions: picks, points paid, transaction state, deposit arrival, countdown (minute updates only).
- Layout passes at 360, 390 and 430 px wide in EN, KO and JA with no button wrapping or overflow; Korean uses `word-break: keep-all`, Japanese `word-break: auto-phrase`.
- No horizontal scroll; wide content (rate table) becomes its own scroll box with a visible edge.
- Admin: keyboard reachable tables and forms, 1280 px minimum layout, same contrast rules.
- PWA manifest: `display: standalone`, `orientation: portrait`, theme colour `#124CC4`, background `#FDFDFF`, maskable icons from `cojam-mark.svg` on a snow tile.

---

## 9. Open questions for the founder

Each changes at least one screen. Proposed defaults are shown so work can start; none is built as a feature until confirmed.

| # | Question | Screens | Proposed default |
| --- | --- | --- | --- |
| Q1 | Which social logins? (Google, Apple, X, Telegram, LINE, Discord, others). Kakao is not a built in Privy provider | A1 | Google, Apple, X |
| Q2 | Sponsored transactions: if Privy wallets cannot sign Kaia fee delegated transactions, the relayer path needs a signed message per action. Staking needs `approve` on CT, and new CT has no `permit`, so an approve cannot be relayed. How should staking work in that case (contract pulls by a different method, a sponsored approve through some other path, or users get a one time KAIA top up)? | S1, sheet steps | Decide after the Privy check |
| Q3 | Terminal row button: plan says "Join". Keep "Join" or use "Pick"? | H2 | "Pick" |
| Q4 | Is the 100P completion reward paid in the same transaction as the 5th pick, or by the server afterwards? | H3 | Same transaction |
| Q5 | Wrong answer correction: players who picked the corrected right answer get 50P. What happens to players already paid for the wrong answer: keep their points, or take them back (needs a contract power that points can be reduced)? | AD4, R1 | Keep their points; pay the correct side |
| Q6 | Can a live or closed question be cancelled (bad question, source gone)? If so, does the day still count as complete for the 100P? | AD3, R1, H1 | Yes; complete counts the remaining questions |
| Q7 | AI drafts and posts automatically. Can the admin edit, reorder or discard AI drafts before they go live, or only add manual questions? | AD3 | Edit and discard allowed until publish |
| Q8 | Day and week boundaries: at what time does a new set open (for example 00:00 UTC or 09:00 KST), when does the week start and end, and do hits paid after the week ends count for the old or the new week? | H1, H3, K1 | Sets at 00:00 UTC; week Monday 00:00 UTC; points count in the week they are paid |
| Q9 | Fiat value: the plan shows KRW. Show KRW for every language, or KRW / USD / JPY by language, or none? Use the fixed 200 KRW reference or the live pool price? | S1, W1 | KRW for KO, USD for EN, JPY for JA, from the live price |
| Q10 | Airdrop: automatic at the week end, or sent by an admin pressing "Send airdrop"? | AD5, K1 | Automatic, with admin view |
| Q11 | Should K1 show last week's result (rank and prize) to the user? | K1 | Yes, one line for winners |
| Q12 | Ties and short boards: how is a prize split when players tie at a rank, and what happens to the prize of empty ranks when fewer than 10 players scored? | K1, AD5 | Tied players split the sum of the ranks they occupy; unused prize stays in the reward wallet |
| Q13 | Staking default period and whether a user may hold several stakes at once (the spec assumes yes, one card per stake) | S1, S2 | 90 days preselected; multiple stakes |
| Q14 | Is interest paid from the reward wallet (so it can run out) or reserved in the staking contract at stake time? Can new stakes be paused? | S1, S2, AD6 | Reserved at stake time; pause allowed |
| Q15 | Interest under 10 CT: a 100 CT stake for 30 days earns about 0.66 CT, so it can never reach the 10 CT claim minimum. Is all interest paid with the principal at withdrawal regardless of the minimum? Does interest keep growing after unlock until withdrawal? | S2 | Paid in full with the principal; no interest after unlock |
| Q16 | Rate tier: decided by the size of each stake, or by the user's total staked? | S1 | Each stake |
| Q17 | QR scan for the withdraw address (needs camera permission)? | W4 | Paste only for launch |
| Q18 | Display names: must they be unique? Is a word filter needed, and should admins be able to reset names? | P1, K1, AD5 | Not unique; basic word list; admin reset |
| Q19 | Wrong token sent to a Privy address (old CT, other tokens): offer any recovery or key export? Can users export their Privy wallet key at all? | W3, P1 | No recovery; key export shown in P1 if the founder wants it |
| Q20 | Admin sign in method and host (`app.cojam.app/admin/` or `admin.cojam.app`), and who signs admin on chain changes (master EOA, a separate admin key, a multisig)? | AD0, AD2 | Privy login with an allowlist; separate admin key for settings |
| Q21 | Admin in English only, or also Korean? | AD all | English only |
| Q22 | Reward setting changes: effective at once, from the next set, or from the next week (for the pool and split)? Do staking rate changes apply to existing stakes? | AD2 | Next set; next week for pool; existing stakes keep their rate |
| Q23 | Maintenance switch in the admin (needed for the maintenance screen)? | AD6, 2.6 | Yes |
| Q24 | Terms and privacy pages: legal is deferred, but social login collects emails. Show links on A1 and P1 at launch or not? | A1, P1 | Placeholders hidden until pages exist |
| Q25 | Notifications (a push when a new set opens or answers are set) are not in the plan. Wanted? iOS allows push only in the installed app | none yet | Not built |
| Q26 | "Signed up users" for the weekly pool: every Privy account, or only accounts that played that week? (Social login makes accounts cheap, so the pool can be inflated) | K1, AD5 | Players with at least one pick that week |
| Q27 | Does predicting ever cost points? DECISIONS says balances change through "predicting", the plan has free picks with completion and hit rewards | H1 | Free picks |
| Q28 | KAIA withdrawal: W4 sends CT only. Should users also be able to send KAIA out? | W4 | CT only |
| Q29 | Should each question lock earlier than the set close when its outcome becomes known during the day (for example a match that ends at 20:00)? | H1, AD3 | Each question has its own close time, never after the set close |

---

## 10. Items in the plan that conflict or do not add up

1. **Interest minimum vs small stakes**: minimum stake 100 CT and minimum interest withdrawal 10 CT. At the highest rate a 100 CT stake earns 27 CT a year, at 30 days about 0.66 CT. Small stakes can never claim interest under the stated rule (Q15).
2. **Staking under the relayer fallback**: DECISIONS allows a relayer if Privy cannot sign fee delegated transactions, but staking needs `approve`, and new CT has no `permit` (CLAUDE.md token spec), so the "same experience either way" promise breaks for staking (Q2).
3. **"Predicting" changes point balances** (DECISIONS) while the plan has no stake or cost per pick (Q27).
4. **Login and wallet connect**: the plan's feature list says email login and wallet connect; DECISIONS replaces it with social login only. Followed DECISIONS. Email login is not social login; confirm it is out (Q1).
5. **Desktop and mobile web app** in the plan vs installed PWA only in DECISIONS: followed DECISIONS (Gate).
6. **Admin "Answer setting" tab** implies a human sets answers; DECISIONS makes it fully automatic. AD4 is a monitoring and correction screen, not an approval step.
7. **Weekly pool = signed up users x 1 CT** grows without limit and is easy to inflate with free social accounts (Q26).
8. **KRW value** in the staking mockup while the app ships in EN, KO and JA (Q9).
9. **Wrong answer compensation** is promised, but points are non transferable and only change through the contracts; taking back wrongly paid points needs an explicit contract power that the decisions do not mention (Q5).
