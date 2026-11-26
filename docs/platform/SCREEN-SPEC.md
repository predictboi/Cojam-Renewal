# Cojam Daily Prediction: screen specification

Status: draft 3 (2026-11-27). Agrees with `DEV-PLAN.md` draft 3 on names, numbers and states.
Scope: only `PLAN-SOURCE.md` as changed by `DECISIONS.md`. Where the two disagree, `DECISIONS.md` wins (later rows override earlier ones). What is still open is listed in section 9 and is not designed as a feature here.
Reference design: the built screens in `platform/design/` (HTML per screen, `assets/i18n.js` for the final EN / KO / JA copy, `ROUND5.md` for the visual rules). Where this spec and the built design differ on layout or copy, the design wins and this spec follows it; places where the design does not yet have something this spec requires are listed in section 10.2.

Changes in draft 3:

1. **Friend invites (new scope)**: new screen I1 Invite friends; optional invite code in A2 with its states; the Gate shows the code from an invite link; invite rows on W1, P1 and R1; the one time "+100P welcome bonus" line on H3; admin parameters, statistics and flagged clusters (AD1, AD2, AD7); edge cases 7.28 to 7.35. Sharing the invite link is the only sharing feature (the W3 "Share address" button is removed).
2. **Abuse blocking**: automatic freeze by the risk job (hourly and at every sign up), the player's "This account is on hold" screen (2.6), a new admin screen AD7 Players with the review list, blocked accounts and unblock with the operator key.
3. **Image led prediction cards**: every question carries an AI generated 4:5 image (category illustration as fallback); the deck with depth; thumbnails in the list view; admin preview of the card crop (AD3).
4. **Undo**: 3 seconds after each pick; the previous card comes back; the pick is sent after the window; "Finish now" after the fifth pick; held picks are sent when the player leaves the screen. Replaces "a pick is final" (6.3).
5. **Languages**: English by default for everyone, Korean and Japanese chosen by hand and remembered, never switched by device language; question text authored natively in all three languages (about 70 characters, three lines).
6. **Visual direction**: coral (left) and sky blue (right) answer colours; the quiet flat surfaces, three button looks, one segmented pattern and the three step radius scale (6.0).
7. **Per screen changes from the built design**: short wallet address chip on W1 and P1 (full address and QR on W3 only); finished home state; H3 hero; R1 summary, marks and chips; K1 podium, "Around you" and the tie line; staking tabs and a review sheet for every stake; the S2 claim rule shown as text, not a disabled button; ranking ties confirmed.

Conventions used below:

- **Data source tags**: `[chain]` read from a Kaia contract (prediction, staking, CT token) through the server's RPC or the client; `[api]` Cojam platform API on `app-api.cojam.app` (the swap's gas API on `api.cojam.app` is separate); `[privy]` Privy SDK (session, user, embedded wallet); `[local]` device only (localStorage, IndexedDB, service worker cache).
- **Copy**: text in quotes is the English source string, as in `platform/design/assets/i18n.js`. `{name}` is a variable. Every string goes into the EN / KO / JA dictionary; no string is hard coded in markup. KO and JA are written natively, not translated word for word.
- **Language**: the app opens in English for everyone. Korean and Japanese are chosen by the player from the language control (G1, A1, A2 panel 1, P1) and remembered (`[local]`, and `[api]` once logged in). The device language is never read. `?lang=en|ko|ja` exists for review links only.
- **Numbers**: points are whole numbers with thousands separators and a `P` suffix with no space ("1,250P"). CT shows up to 4 decimals with trailing zeros trimmed ("12.5 CT", "0.35 CT"); prizes show 2 decimals; the full value is in the accessible label. KAIA shows up to 4 decimals. All figures use tabular numerals; key figures use the display numerals. Dates use the device locale; times show the device time zone abbreviation the first time they appear on a screen.
- **Ticker rule**: in the PWA, "CT" always means new CT (`0x91cb3B346C80ff965a9667ba6228834dbedD71a2`). Where old CT can be confused (W1 token info, W3, W4, G1), the copy says "new CT" and shows the full address.
- **Never show a result before it is confirmed** on chain (points paid, CT received, stake opened). Pending values are labelled as pending.

---

## 1. Overview

### 1.1 Surfaces

| Surface | Where | Who | Device | Purpose |
| --- | --- | --- | --- | --- |
| (a) PWA | `app.cojam.app`, display mode standalone | Players | Phone first (360 to 430 px), works on tablets | All play: predict, results, ranking, staking, wallet, invites, profile |
| (b) Gate | `app.cojam.app` in any ordinary browser tab | Visitors | Any | Install the app, carry an invite code, or go to the swap at `https://cojam.app/migrate/`. No play, no login |
| (c) Admin | `admin.cojam.app`, desktop web page | Cojam operators on the admin allow list | Desktop, 1280 px and up | Watch the AI pipeline, change reward numbers, correct and compensate, run the airdrop, review and unblock accounts, watch invites, wallets and jobs |

### 1.2 Install gate logic

Runs before anything else on `app.cojam.app`, synchronously in the document head so the wrong surface never flashes.

```
standalone = matchMedia('(display-mode: standalone)').matches
          || matchMedia('(display-mode: fullscreen)').matches
          || navigator.standalone === true            // iOS home screen
(the admin lives on admin.cojam.app and never reaches this logic)
if standalone                             -> PWA (A1 if no Privy session; A1 setup panel if the account is not registered or this device has no valid play key;
                                              "Account on hold" (2.6) if the player is frozen; else A2 if first run not done; else Home)
else                                      -> G1 Gate, variant chosen below; an invite path /i/{code} (or ?invite={code}) adds the invite block
```

G1 variant, first match wins:

| # | Condition | Variant | Main action |
| --- | --- | --- | --- |
| 1 | In app browser: user agent contains `KAKAOTALK`, `Instagram`, `FBAN`/`FBAV`, `Line/`, `NAVER(inapp`, `DaumApps`, `Telegram` (Android webview), or a webview marker | `inapp` | "Open in browser". Android KakaoTalk: try `kakaotalk://web/openExternal?url=` first; Android others: `intent://` to Chrome; iOS: copy link plus steps |
| 2 | Android and a `beforeinstallprompt` event arrived | `android-prompt` | "Install Cojam" (calls `prompt()`) |
| 3 | Android, no prompt event within 3 s (Samsung Internet, Firefox, prompt already dismissed) | `android-manual` | Steps: browser menu, then "Add to Home screen" or "Install app" |
| 4 | iOS or iPadOS, Safari | `ios-safari` | Steps: Share, "Add to Home Screen", Add |
| 5 | iOS or iPadOS, other browser (Chrome, Edge, Firefox on iOS 16.4 and later) | `ios-other` | Same steps through that browser's share menu; fallback line "If you do not see Add to Home Screen, open this page in Safari." |
| 6 | Desktop (no touch primary pointer, width 900 px and up) | `desktop` | QR code to `https://app.cojam.app/?src=qr` (to the invite link when one is open), plus "Swap old CT" link |
| 7 | Anything else | `generic` | QR code and the manual steps for both platforms |

After `appinstalled` fires (Android), G1 switches to "Cojam is installed. Open it from your home screen." There is no reliable way to open the installed app from the tab, so the copy says where to find it.

### 1.3 Navigation map

```
G1 Gate ──install──> (home screen icon) ──> A1 Login (email, code) ──> A2 First run (setup finishes behind it; optional invite code) ──> Home
A1 ──returning user, no valid play key on this device──> A1 setup panel "Setting up your game" ──> Home
G1 ──"Swap old CT"──> https://cojam.app/migrate/ (new tab)
Any PWA launch while the player is frozen ──> "This account is on hold" (2.6) ──"Open wallet"──> W1

Home = H1 Card view | H2 List view (switch; choice remembered [local])
   H1/H2 ──5th pick, after its Undo window or "Finish now"──> H3 Day done ──"See weekly ranking"──> K1
   Home tab on a finished day ──> finished home ("That is all five") ──"See today's picks"──> H3
   H3 ──countdown hits 0──> H1/H2 with the new set
Tab bar: Home (H1/H2) · Results (R1) · Ranking (K1) · Staking (S1 ⇄ S2) · Wallet (W1)
   S1 <──tabs──> S2
   W1 ──"Convert points"──> W2 ;  W1 ──"Deposit"──> W3 ;  W1 ──"Withdraw"──> W4 ;  W1 ──"Invite friends"──> I1
   W1 "Staked" row ──> S2
Header: point pill ──> W1 ;  profile button ──> P1
P1 ──"Invite friends"──> I1 ;  P1 ──"Log out"──> A1 ;  P1 ──"Swap old CT"──> cojam.app/migrate/ (external)
Global layers on any PWA screen: transaction sheet, toasts, offline bar, error screens, maintenance screen, update toast, session expired sheet, account on hold

Admin: AD0 ──> AD1 ; side nav: AD1 Dashboard · AD2 Reward settings · AD3 Questions · AD4 Answers · AD5 Ranking and airdrop · AD6 System · AD7 Players
   AD3 question row ──"Open answer"──> AD4 detail ;  AD1 alert ──> the screen it names
```

Sub screens (W2, W3, W4, I1, P1) open as pushed pages with a back button in the header; the tab bar stays visible and the Wallet tab stays selected for W2, W3, W4 and I1 (P1 selects none). Android back and the iOS edge swipe go back one level; on a tab root they do nothing (the PWA never closes itself on back).

### 1.4 Bottom tab bar

| Order | Label | Icon | Goes to | Badge |
| --- | --- | --- | --- | --- |
| 1 | "Home" | card stack | H1 or H2 by the remembered view | Sky dot while today's set has unanswered questions |
| 2 | "Results" | check list | R1 | Count of newly set answers since the last visit, max "9+" |
| 3 | "Ranking" | podium | K1 | none |
| 4 | "Staking" | lock | S2 when the player has stakes, else S1 | Sky dot when a locked stake has 10 CT or more claimable, or a stake has unlocked |
| 5 | "Wallet" | wallet | W1 | none |

The current tab shows its filled icon and ink label; there is no lime pill behind it (DECISIONS, visual direction). Profile and settings (P1) is reached from the header, not the tab bar, to keep five tabs. I1 Invite friends is reached from W1 and P1.

---

## 2. Global PWA elements

### 2.1 App header (every PWA screen except A1, A2 and the full screen system screens)

| Block | Element | Source | Notes |
| --- | --- | --- | --- |
| Left | Logo chip (snow chip, mark, "Cojam") on tab roots; back button (icon, labelled "Back") plus the screen title on sub screens ("Convert points", "Deposit", "Withdraw CT", "Invite friends", "Profile") | static | 44 px target |
| Right | Point pill "{points}P" (ink pill, display numerals) | `[chain]` point balance, refreshed after every confirmed point change and every 30 s while visible | Tap: W1. States below |
| Right | Profile button (round, initial of the display name or a generic person icon; lime filled while P1 is open) | `[api]` profile | Tap: P1. Label "Profile and settings" |

Under the header, tab roots carry a page head on the same blue grid band: the h1 (and on Home the view switch, counter, day progress and "Closes in" countdown).

Point pill states:

| State | Display | Accessible label |
| --- | --- | --- |
| Loading | Skeleton pill | "Loading points" |
| Ready | "1,250P" (confirmed on chain only; includes invite bonus and welcome points, which are ordinary points) | "1,250 points. Open wallet" |
| Saving | "1,250P" with a small spinner, while today's fifth pick is not yet mined (the 100P is not added until it is) | "1,250 points. Open wallet Saving your picks." |
| Hits pending | "1,250P" plus a small sky tag "+{n}" (the player's own hit points inside the 6 hour correction window, not yet credited; invite bonus is never shown as pending) | "1,250 points. Open wallet {n} points on the way, landing about {time}." |
| Error | Last known value plus a muted dot | "Balance may be out of date" |

Tap opens W1, whose points section spells out the pending hit points and when they land. When points are confirmed the pill counts up from the old value and pulses once (7).

Header ground: blue band (`--brand`) with the 44 px grid and snow text, as the site shell. Safe area: `padding-top: env(safe-area-inset-top)`.

### 2.2 Transaction progress sheet

Used for staking, claiming interest, withdrawing a stake, converting points, withdrawing CT. Not used for prediction picks (they show in the pick bar, H1).

| State | Title | Body | Actions |
| --- | --- | --- | --- |
| Review (every new stake and every W4 withdrawal) | Per action: "Stake {a} CT for {d} days?" / "Send {amount} CT" | Summary rows of the action; a warn line for stakes "No early exit: this CT stays locked until {date}." | Primary with the action's own label ("Stake {a} CT", "Send {amount} CT"), "Cancel" |
| Signing | "Signing with your Cojam wallet" | "This only takes a moment. No confirmation is needed." | "Cancel" |
| Step list (when 2 steps: approve then stake) | "Staking {a} CT" | Steps "Allow Cojam to use {a} CT", "Stake {a} CT", each Waiting / In progress / Done | "Cancel" until step 1 is sent; after that "Hide" (the work continues) |
| Sending | "Sending to Kaia" | "Usually confirmed in a few seconds." Transaction hash chip once known | "Hide" |
| Success | Per action, see screen | Confirmed amounts | Per screen action, "Done" |
| Failed | "That did not go through" | Reason line (table 2.7) | "Try again" (primary), "Close" |
| Slow (over 60 s without receipt) | "Still waiting for Kaia" | "Your transaction is sent. It can take a little longer when the network is busy." | "Hide", "View on Kaiascan" |

Cancel before anything was sent toasts "Cancelled. Nothing was sent and your CT has not moved." (for a stake: "Stake cancelled. Your CT has not moved."). A hidden sheet leaves the screen's primary action button as the status: disabled, with a spinner and "{label}: sending" (for example "Staking 500 CT: sending"); a second action of the same kind waits until the first ends. Esc and the grip drag close the sheet only in Review, Success and Failed states.

### 2.3 Toasts

Ink toast with a snow ring, above the tab bar and the safe area, `aria-live="polite"`. Max one visible, queue the rest. Auto hide 4 s; toasts with a button stay 8 s.

| Event | Copy | Button |
| --- | --- | --- |
| Pick failed for good (only a non retryable failure while the question is open; never for a retry in progress) | "Your pick on question {n} was not saved." | "Try again" |
| Picks sent because the player left the screen inside an Undo window, shown on return | "Pick saved" / "{n} picks saved" | none |
| Points paid (confirmed credits other than the day done moment, which has its own reward line and no toast) | "+{n}P paid." | none |
| Hit points landed (after the correction window) | "{n} hits paid: +{p}P." | "See results" |
| CT arrived (deposit detected) | "{a} CT arrived in your wallet." | none |
| Contract address copied (W1 token info, W3) | "Contract address copied. Do not send funds to it." | none |
| Invite link shared through the share sheet (I1) | "Invite link shared." | none |
| Name saved | "Name saved." | none |
| Update ready | "A new version of Cojam is ready." | "Reload" |
| Back online | "Back online. Your data is up to date." | none |
| Offline tap on an answer | "Connect to the internet to pick." | none |

The wallet address chip and the invite code block do not toast: for 2 s the icon becomes a check and the label reads "Copied" (the I1 "Copy link" button reads "Link copied"). Invite bonus credits do not toast (they can be frequent); I1, W1 and R1 show them.

### 2.4 Offline state

Detection: `navigator.onLine` plus a failed API heartbeat (2 misses, 10 s apart).

- Slim ink bar under the header: "You are offline. Showing what was saved on this device." with a muted "Last updated {time}".
- Cached screens stay readable (last set, last balances, last ranking, invite code and stats from `[local]` cache). Every action that needs the network is disabled with the reason as its helper line: "Connect to the internet to pick." / "Connect to the internet to stake." / "Connect to the internet to convert, deposit or withdraw." and so on.
- Picks made offline are not queued (a set can close while offline). The answers are drawn switched off; a tap on one toasts "Connect to the internet to pick."
- First open with no cache: full screen "No connection", body "Cojam needs the internet to load today's predictions.", button "Try again".

### 2.5 Error states

| Case | Where | Copy | Action |
| --- | --- | --- | --- |
| API down (5xx, timeout) on a screen load | In place of the block that failed | "We could not load this. Your points and CT are safe on chain." | "Try again" |
| Chain RPC down | Balance blocks | "Kaia is not answering right now. Balances may be out of date." | "Try again" |
| Partial failure | Only the failed block shows the error; other blocks render | as above | per block |
| Unknown route | Full screen | "This page does not exist.", body "The link may be old. Today's predictions are one tap away." | "Go to Home" |
| Gas sponsor out of funds (server reports) | Inline on the action; for picks, the H1 banner only (picks keep retrying until the question closes) | "Free transactions are paused for a moment. Try again in a few minutes." | "Try again" |
| Conversion reserve short (convert, airdrop) | Inline on the action | "Payouts are paused while Cojam refills the reward reserve. Your points are kept." | none |

### 2.6 Global system screens

| Screen | Trigger | Copy | Action |
| --- | --- | --- | --- |
| Maintenance | `[api]` status flag `maintenance=true` | Title "Cojam is being updated", body "Predictions and payouts are paused. Your points, stakes and CT are safe on chain. We will be back shortly." Optional admin message line. "Expected back: {time}" if set; foot "Checks again by itself every minute." | "Check again" |
| Update required | `[api]` `minVersion` above the running version | "Update Cojam to keep playing", body "A newer version is needed." | "Update now" (activates the waiting service worker and reloads) |
| Session expired | Privy token refresh fails | Sheet: "Log in again", body "For your safety you were logged out. Your points and CT are kept. Picks you already made keep saving." | "Log in" (opens the A1 email and code steps as a sheet; on success the user returns to the same screen and state) |
| **Account on hold** | `[api]` session or `GET /v1/me` returns `frozen=true`, or the fee payer answers `FROZEN` | Full screen, calm (clock icon, no red): title "This account is on hold", body "We are reviewing this account, so predicting, converting and prizes are paused for now. The points you earned and the CT in your wallet stay yours.", line "If you think this is a mistake, tell us and we will look again." | Secondary "Contact support" (opens mail to the support address, section 9 O4), text link "Open wallet" (W1) |

While the account is on hold: Home shows this screen in place of H1, H2 and H3 (no deck, nothing queued); Results, Ranking, Wallet and Profile stay readable; W2 Convert, S1 new stakes and I1 sharing are disabled with the line "Paused while this account is on hold."; W3 Deposit and W4 Withdraw (user paid) work; existing stakes can be claimed and withdrawn as user paid transactions like W4 (no sponsored gas, DECISIONS), unless section 9 O5 decides otherwise. When the operator unblocks the account the next session check returns to normal; nothing earned before was debited.

### 2.7 Transaction error copy (shared)

| Cause | Copy |
| --- | --- |
| User cancelled while signing | "Cancelled. Nothing was sent and your CT has not moved." |
| Not enough CT | "That is more than your {b} CT." |
| Not enough KAIA for gas (W4, and staking actions while on hold) | "You need about {f} KAIA for the network fee. You have {k} KAIA." |
| Reverted on chain | "Kaia rejected this transaction. Nothing was taken from your balance." |
| Network timeout before send | "We could not reach Kaia. Nothing was sent." |
| Relayer or fee payer refused | "Cojam could not sponsor this transaction right now. Try again in a minute." |
| Set closed (picks) | "Today's set has closed. A new set is ready." |
| Daily conversion limit reached | "You reached today's limit of 50 CT. You can convert again after {time}." |
| Staking full | "Staking is full for now." plus the room line of S1 |
| Account frozen | The Account on hold screen (2.6) instead of an error line |
| Unknown | "Something went wrong. Nothing was sent." plus a short error code for support |

---

## 3. PWA screens

Common to every PWA screen: header (2.1), tab bar (1.4) except on G1, A1, A2 and full screen system screens, offline bar (2.4), skip to content link, one `h1` per screen (visually the title or `sr-only`), every state reachable with `?state=` in development builds (as the built design does).

### G1 Gate

**Purpose**: turn a browser visit into an install; carry an invite code into the app; send swap traffic to the swap.
**Entry**: any non standalone visit to `app.cojam.app`, QR scans, invite links (`/i/{code}`), shared links.

Layout top to bottom (blue ground with the 44 px grid, as the landing hero):

| Block | Elements | Source |
| --- | --- | --- |
| Top note | Anti phishing line (ink, shield icon): "Only on app.cojam.app. Cojam never asks for your seed phrase." | static |
| Bar | Logo chip, language select (English / 한국어 / 日本語; English unless the visitor chose another) | `[local]` language |
| Hero | Display heading "Predict daily. Earn CT.", lede "Five quick predictions every day. Swipe to pick, earn points, turn them into CT." | static |
| Preview | A static, inert question card (image led, as H1) with the sticker "Example"; for an invited visitor it moves below the panel, so the code comes first | static |
| Install panel | Variant content (table below); for an invite link, the invite variant | UA detection, `beforeinstallprompt`, `[api]` `GET /v1/invite/lookup?code=` |
| Facts | Three lines with icons: "No fee for predicting, staking or converting", "Log in with your email", "Points live on Kaia" | static |
| Swap block | Heading "Holding old CT?", body "Swap old CT for new CT first, at cojam.app.", secondary "Swap old CT" (opens `https://cojam.app/migrate/` in a new tab) | static |
| Footer | "Cojam home" link to `https://cojam.app`, © line | static |

Invite variant `invited` (the page was opened from an invite link and the code is valid). The installed app cannot read anything from the browser on iOS, so the code is shown to be copied and carried over by hand (DECISIONS "Invite code and PWA"):

| Element | Copy |
| --- | --- |
| Heading | "{name} invited you" ({name}: the inviter's ranking name, or their short address when they have none; `translate="no"`) |
| Code | Copy block with the code in the data face and the label "Copy code" (copies the code; "Copied" for 2 s) |
| Lines | "Copy the code, install the app, then enter it when you start." / "You get +100P after your first full day of 5." |
| Install steps | "Add Cojam to your home screen" with the platform's steps (as `ios-safari`, or the Android menu steps), in the same panel |

Rules: the Gate also saves the code in `[local]` (`cjp.invite`). On Android the installed app shares this storage, so A2 can fill the code in; on iOS the home screen app has its own storage, so the player types it. "Copy link" in the `ios-other` and `inapp` variants copies the invite link (`https://app.cojam.app/i/{code}`) when one is open, so the code survives opening the page in Safari. An unknown or disabled code shows the normal Gate; a lookup that fails for network reasons shows the variant without the name.

Install panel per variant:

| Variant | Content |
| --- | --- |
| `android-prompt` | Heading "Get the app", body "Cojam plays as an app on your home screen. It installs in seconds, with no app store.", primary "Install Cojam". After `prompt()`: accepted, note "Installing. Open Cojam from your home screen."; dismissed, the manual steps appear under "Or add it from the browser menu" |
| `android-manual` | Heading "Add Cojam to your home screen", steps: 1 "Tap the menu in your browser", 2 "Tap Add to Home screen or Install app", 3 "Open Cojam from your home screen" |
| `ios-safari` | Heading "Add Cojam to your home screen", steps with icons: 1 "Tap Share at the bottom of Safari", 2 "Scroll and tap Add to Home Screen", 3 "Tap Add, then open Cojam from your Home Screen". A bouncing arrow with "The Share button is down here" points to Safari's toolbar (static under reduced motion) |
| `ios-other` | Same steps with step 1 "Tap the share button of your browser", note "If you do not see Add to Home Screen, open this page in Safari." and a "Copy link" button |
| `inapp` | Heading "Open Cojam in your browser", body "The browser inside {app} cannot install Cojam." Android: primary "Open in browser" (deep link); if nothing opens within 1.5 s, "If nothing opens, do it by hand" with steps "Tap the more menu or the share icon", "Tap Open in Safari or Open in browser". iOS: the steps; button "Copy link" |
| `desktop` | Heading "Play on your phone", body "Scan the code with your phone camera, then add Cojam to your home screen." QR block (encodes `https://app.cojam.app/?src=qr`, or the invite link), the host in text under it, "Copy link" |
| `generic` | Heading "Play on your phone", QR block and both step lists in two disclosures ("On iPhone", "On Android") |

States: no loading state (static page; QR renders client side, skeleton square until drawn); installed (`appinstalled`): install panel replaced by "Cojam is installed. Open it from your home screen."; offline: unchanged (page is cached; the invite block shows the code without the name).

Actions: "Install Cojam" calls the deferred prompt; "Copy link" copies `https://app.cojam.app/` (or the invite link) and toasts "Link copied."; "Copy code" copies the code; "Swap old CT" opens the swap; the language select re renders in place.

### A1 Login

**Purpose**: create or resume the Privy account and its Kaia embedded wallet with an email address and a one time code (Privy email login only; no social providers, no wallet connect), then get the account and this device ready to play.
**Entry**: first standalone launch, after log out, after session expiry (as a sheet, 2.6).

One screen on the blue band: bar (logo, language select), headline, a white panel with the current step, and a facts list. Headline per step: "Log in to play" (email), "Check your email" (code), "Almost there" (setup).

**Step 1: email**

| Block | Elements | Source |
| --- | --- | --- |
| Bar | Logo, language select (English by default; the choice is remembered) | `[local]` |
| Lede | "Enter your email and we send you a code. Cojam makes your Kaia wallet for you." | static |
| Email field | Label "Email", `type="email"`, `inputmode="email"`, `autocomplete="email"`, 16 px text; caption under it "Works with {list}." ({list}: the display names of the allow list, "Gmail, Naver, Kakao, Daum, Hanmail, iCloud, Outlook, Hotmail, Yahoo! JAPAN" at launch) | user, `[api]` `supportedProviders` |
| Action | Primary "Send code" | |
| Help | Disclosure "What is the Cojam wallet?": "A wallet on Kaia made for your login. It holds your points and CT. Only you can use it." | static |
| Fine print | "By continuing you agree to the Terms and the Privacy Policy." (links shown only once legal pages exist; legal is deferred by the founder) | static |
| Facts | "5 questions a day, about a minute", "Free to play: Cojam pays the network fees", "Points turn into CT" (they stay only when the screen is tall enough, and never push the page into a scroll) | static |

"Send code" first calls `[api]` `POST /v1/auth/email-check` (allow list, normalisation, request limits), and only then asks Privy to send the code. An unsupported address never reaches Privy. A mistyped provider (for example `gmial.com`, `naver.co`, `hanmail.com`) is a typo, not an unsupported provider: the field shows "Did you mean {domain}?" with a secondary button "Send code to {email}" (the corrected whole address in lower case).

**Step 2: code**

| Block | Elements | Source |
| --- | --- | --- |
| Heading | "Enter the 6 digit code", body "We sent it to {email}." | static |
| Code field | Label "Code", one field for the whole code (length from Privy, 6 expected), `inputmode="numeric"`, `autocomplete="one-time-code"`, tabular digits; submits on its own when the last digit is typed | user |
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
| Likely typo | "Did you mean {domain}?" with "Send code to {email}" |
| Provider not supported | Inline note (warn) under the field: title "We cannot use this email provider yet", body "To keep the game fair, sign up with one of these: {list}." No code is sent |
| Too many code requests | "Too many codes were asked for from this device or network. Wait a few minutes and try again." |
| Sending code | Button spinner, label "Sending code" |
| Send failed | "We could not send the code. Try again in a minute." |
| Code sent | Step 2, resend timer running |
| Code incomplete | "Enter all 6 digits." |
| Checking code | Button spinner, label "Checking" |
| Wrong code | Field red edge, "That code is not right. Check the latest email from Cojam and try again." |
| Code expired | "This code has expired. Send a new code." with the resend link enabled at once |
| Too many tries | "Too many tries. Wait a few minutes, then send a new code." (Privy's limit; field disabled until then) |
| Wallet creation failed | "We could not set up your wallet. Try again." button "Try again" |
| Offline | Fields disabled, helper "Connect to the internet to log in." |

**Setup panel "Setting up your game"**

Runs after the code is accepted whenever the account is not yet registered as a player or this device has no valid play key (first login, new phone, reinstall, cleared storage, iOS eviction, expired key). It registers the account (`[api]` `POST /v1/session`, then the operator's `registerPlayer`) and authorises this device's play key (the Cojam wallet signs `setPlayKey` once, with no prompt). For a new user the panel runs behind A2 and only shows if A2 ends before it does.

| Block | Elements |
| --- | --- |
| Title | "Setting up your game" |
| Body | First login: "This takes a few seconds." Returning user on a new or reset device: "Getting this device ready to play. This happens once per device." |
| Steps | "Create your wallet", "Register your account", "Get this device ready to play", each Waiting / In progress / Done (steps already done are shown done) |

| State | Display |
| --- | --- |
| In progress | Steps as above; no action needed |
| Registration busy (sign ups queued) | Step 2 reads "Waiting in line. This can take a minute." |
| Registration refused: email already used | Panel title "We could not register this account", body "This email is already linked to another Cojam account. Log out and log in with the address you used first." Button "Log out" |
| Registration refused: provider not supported | Same title, body "This email provider is not supported yet. Log out and use an address from: {list}." Button "Log out" |
| Registration refused: too many sign ups | Same title, body "Too many new accounts were made from this device or network. Try again tomorrow." Buttons "Try again", "Log out" |
| Registration refused: other checks | Same title, body "This account could not be registered." Button "Log out" |
| Registered but frozen by the sign up check | The Account on hold screen (2.6) |
| Device setup failed | "We could not get this device ready. Check your connection and try again." Button "Try again" |
| Done | Panel closes: new user to A2 (or Home if A2 is done), returning user to Home |

### A2 First run

**Purpose**: explain the loop in three short panels, let the player pick a language and enter a friend's invite code, while setup finishes behind it.
**Entry**: once per account after the first login (`[api]` `onboarded=false`), also from P1 "How Cojam works" (then without the setup line and the invite link).

Blue band, full screen, no header or tab bar.

| Block | Elements |
| --- | --- |
| Top bar | Step dots (label "Step {n} of 3"), "Skip" (on band) |
| Panel 1 | Illustration: card stack and day progress. Title "Five predictions a day", body "A new set of 5 opens every day at 09:00 KST. Swipe left or right to pick." |
| Panel 2 | Illustration: "+100P" "all 5 done" and "+50P" "per hit". Title "Earn points", body "Finish all 5 to get 100P. Each correct pick adds 50P about 6 hours after the answer is set." Values from `[api]` reward settings |
| Panel 3 | Illustration: "1,000P" to "1 CT". Title "Points to CT", body "Turn every 1,000P into 1 CT, from 7 days after you join. Each week the top 10 win CT prizes. You never pay a fee to play." |
| Invite code (panel 1 only, not when opened from P1) | Closed: one text link "Have an invite code?" with a chevron. Open: the field below. Opens already filled in when a code is known from the Gate on Android (`[local]` `cjp.invite`) |
| Language row (panel 1 only) | Segmented "English" / "한국어" / "日本語" (current language selected) |
| Action | Primary "Next" on panels 1 and 2, "Start predicting" on panel 3 |
| Setup line | Under the action while setup runs: "Setting up your game" with a spinner; "Ready to play" with a check when done |

**Invite code field** (on panel 1, so it adds no screen):

| Element | Copy and rule |
| --- | --- |
| Label | "Have an invite code?" with "Optional"; text button "Skip" beside the label (closes the field) |
| Field | Placeholder "Enter code", data face, upper case, `autocapitalize="characters"`, `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, at most 8 characters; anything but letters and digits is dropped as typed; "Apply" inside the field (like Max on an amount field), which turns into "Change" once the code is accepted; Enter applies |
| Help | "You can only enter a code here, before you start." |
| Next | "Next" on panel 1 first checks a code that was typed but not applied; a wrong one keeps the player on panel 1 |

Invite code states (validated by `[api]` `POST /v1/invite/redeem`):

| State | Display |
| --- | --- |
| Checking | "Checking the code" |
| Valid, linked | Check and "Invited by {name}. You get +100P after your first full day."; the field is read only with "Change" |
| Too short | "A code has 6 to 8 letters and numbers." |
| Unknown code (also a disabled code or a frozen inviter) | "We can't find this code. Check it with your friend." with text link "Continue without a code" |
| Own code | "This is your own code. Enter a friend's code." |
| Already linked (a second device or a reinstall during first run) | "Your account is already linked to {name}. A link cannot be changed." |
| Code cannot take more friends now (inviter limit or a two way link, 7.33, 7.35) | "This code cannot be used right now. Try again later." with "Continue without a code" |
| Offline | "Connect to the internet to use a code." |
| Skipped ("Skip", "Continue without a code", or leaving panel 1 with the field empty) | Nothing is bound, and no code can be entered later (7.29) |

Entry window (chosen, following the design): a code can be entered **only in the first run, before the player starts** (DECISIONS: "fixed once at sign up"). On chain the operator may bind the link until the player's first completed day (DEV-PLAN 3.9), because the binding transaction can land a little after registration; the app never offers the field after the first run, and the 24 hour alternative is not used.

States: setup still running when the user taps "Start predicting" or "Skip": the button shows a spinner and "Setting up your game", then goes to Home on its own; setup refused or failed: the A1 setup panel takes over with its refused or failed state; saving language fails silently (kept `[local]`, retried later); a code entered while registration is still pending is kept by the server and bound with the registration. Swipe between panels plus buttons and arrow keys; panels are a list for screen readers. Done: `[api]` set `onboarded=true`, go to Home.

### H1 Home, card view

**Purpose**: answer today's remaining predictions by swiping an image led deck.
**Entry**: Home tab, app launch, H3 when a new set opens, view switch from H2.

| Block | Elements | Source |
| --- | --- | --- |
| Header | 2.1 | |
| Page head (blue band) | h1 "Today's picks"; view switch (2 px snow outline track: the current view named in words "Cards", the other one as its icon, label "List"); status row: counter "{answered}/5", 5 day progress blocks, "Closes in {hh:mm:ss}" | `[local]` view; `[chain]` picks plus `[local]` held and pending picks; `[api]` set close time, server time offset |
| Banner slot | Play key and slow pick banners (below) | |
| Deck | The front card plus up to 2 cards behind it (offset, softened, image only), unanswered questions in set order | `[api]` today's set |
| Card | See below | `[api]` |
| Pick bar | Under the deck: hint at rest, Undo while a pick is held, saving state after (below) | `[local]` |
| Deck end panel | Behind the last card: the finishing panel after the fifth pick (below) | `[local]` |

Card (4:5 image led, `role="group"`, label "Question {n} of 5: {title}"):

- **Image**: full bleed behind the card, cropped from the top (`object-position: 50% 0`); a scrim keeps the lower text readable. With no image: the category icon in a snow tile on the blue grid (fallback, never an empty card). An alternative "image on top" layout (image above a white body) exists in the design for review and is not the default.
- **Top chips**: category chip ("Crypto", "Markets", "Weather", "Sports", "Culture") and "{n} / 5".
- **Title**: the question in the chosen language, clamped to 3 lines; long titles step down one size (questions are written to stay under about 70 characters in English, 40 in Korean and Japanese, DEV-PLAN 6.4).
- **Meta**: "Answer: {rule}" (search icon) and a button "AI settles it after {time}" (clock and info icons) that opens the sheet "How answers are set": steps "After the time shown, AI checks the source named on the card.", "A second check follows before points are paid.", "If an answer turns out to be wrong, it is corrected and you are compensated." and rows "Source", "Answer set".
- **Answers**: two buttons, left and right, labels from the question ("No" / "Yes", "Lower" / "Higher", "2 or fewer" / "3 or more"). Left is coral, right is sky blue, equal weight, ink text, a 3 px ink drop; arrow icons point outward. The same colours mark the drag stamp and every pick chip.
- **Foot line**: "+50P if right. Undo for 3 seconds."
- **Failed return**: inline note "Not saved. Pick again." (down colour) above the meta.

Swipe and commit rules (component detail in 6.3):

- Drag right commits the right choice, drag left the left choice. The stamp of the choice under the drag direction (its label, in its colour) fades in as the card moves.
- Commit when horizontal travel is 35% of card width or more, or fling velocity is 0.5 px/ms or more with travel of 15% or more. Otherwise the card springs back.
- Vertical drag over 10 px before horizontal travel reaches 10 px hands the gesture to page scroll.
- Tap on an answer button commits that choice at once (same throw). Left and Right arrow keys commit while the deck has focus.
- The very first card a player ever sees leans right, then left, once, to teach the throw (never under reduced motion, never again).

**Undo and sending (DECISIONS)**: after a commit the next card shows at once and the pick is **held** for 3 seconds:

| Moment | Pick bar | Card and progress |
| --- | --- | --- |
| At rest, nothing picked yet | Hint "Swipe the card or tap an answer" (touch) or "Drag the card, click an answer, or press the arrow keys" (fine pointer) | |
| At rest after picks | "{n} left today" | |
| Pick held (0 to 3 s) | Check icon, "Q{n}: {choice}" (choice as a coral or sky pick chip), secondary "Undo" with a ring that empties over 3 s (and a "Z" key hint on devices with a pointer) | The block for that question shows pending stripes; counter up by one |
| Undo pressed (button, Z or Backspace) | The bar shows the next most recent held pick, if any, with its remaining time | The previous card comes back to the front from the side it left; its block returns to empty; counter down by one; live region "Question {n} is back. Pick again." |
| Window over | "Saving: Q{n}: {choice}" with a spinner | The pick is now sent in the background (pick transaction below) |
| Confirmed | "Saved: Q{n}: {choice}", fades after about 1.2 s | Block fills |

Undo acts on the most recent held pick; each held pick has its own 3 s window, so after one Undo an earlier pick still inside its window takes the bar with the time it has left (section 10.1 note). A pick whose question closes within 15 s is not held: it is sent at once and the bar shows "Saving" with no Undo (7.36).

**Fifth pick and the finishing panel**: when the fifth pick is committed the deck is empty and the deck end panel shows: a check inside a ring that empties with the last pick's window, "That is all five", "Finishing in {n}" (seconds) and primary "Finish now". When the window ends (or "Finish now" is pressed, which sends every held pick at once) the line reads "Saving your last pick" and the app opens H3. The primary button exists only while there is a wait to end, so Home carries no lime at rest.

**Leaving inside a window**: switching tab, opening another screen, or the app going to the background (`pagehide`, `visibilitychange` hidden) sends every held pick at once (no Undo after leaving). On return Home toasts "Pick saved" or "{n} picks saved".

**Finished home**: opening Home on a day whose 5 picks are all made shows the deck end panel without a countdown: "That is all five", "Answers are set within 48 hours. The next set opens at 09:00 KST.", primary "See today's picks" (H3). The counter reads 5/5.

Pick transaction (founder decision, optimistic UI): when a pick's window ends it sends its own gas sponsored transaction in the background, signed on this device by its play key (no Cojam wallet signature and no prompt per pick; DEV-PLAN 4). Nothing waits for confirmation and no progress sheet is ever shown for a pick. Picks are sent in commit order from a `[local]` outbox, so a fast player can have several in flight.

Sync indicator (small, never blocking):

| Sync state | Where it shows | Display |
| --- | --- | --- |
| Held | Progress block and pick bar | Pending stripes; Undo in the bar |
| Sending | Same | Stripes; "Saving: Q{n}: {choice}" with a spinner |
| Retrying | Same | Same look as Sending (the user is not told about quiet retries) |
| Confirmed | Same | Block fills; "Saved" line fades out |
| Failed for good | The card itself | See below |

Retry policy (one policy, the same as DEV-PLAN 4.7): a failed send (timeout, sponsor busy, nonce clash, RPC error) is retried automatically after about 1, 2, 4, 8, 16 and 30 s, then every 30 s, until the question closes, with no message. Before each retry the client reads the chain; if the pick is already there it counts as confirmed and is not resent. Retries pause while offline and resume on reconnect while the question is still open.

While it keeps failing (3 failed attempts or 60 s), a slim banner shows above the deck, without stopping the retries: "{n} pick is still being saved" (plural "{n} picks are still being saved") with "Retry now".

The card comes back only for a non retryable failure while its question is still open (an unexpected rejection): it returns to the front as unanswered, its block returns to empty, and the card carries "Not saved. Pick again." plus the toast "Your pick on question {n} was not saved." with "Try again" (2.3). If the question closed before the pick could be saved, the card does not come back; R1 reads "Not saved: the question closed" (7.1). Focus does not jump to the returned card; the live region announces "Question {n} was not saved. It is back in your stack." A `FROZEN` answer opens the Account on hold screen (2.6) instead.

Play key banners (above the deck; picks made meanwhile stay queued and are sent once the device is ready again):

| Case | Banner | Action |
| --- | --- | --- |
| Key expired or revoked, being re-authorised (silent, a few seconds) | "Reconnecting this device" with a spinner | none |
| Re-authorisation failed | "We could not reconnect this device. Your picks are kept and will be sent." | "Try again" |
| Key replaced because the account was set up on another device | Panel in place of the deck: title "Cojam is now set up on another device", body "Your account plays on one device at a time. Picks made there count. Play here instead?" | "Play on this device" (re-authorises; the other device then shows this panel) |
| Privy session expired as well | Session expired sheet (2.6) first, then the reconnect banner | |

States:

| State | Display |
| --- | --- |
| Loading | Page head with 5 empty blocks and a countdown skeleton; one card skeleton (image area, chips, two title lines, meta lines, two answer shapes) |
| Ready, none answered | 5 cards in the deck, counter "0/5", hint in the pick bar |
| Partly done | Only remaining cards; the counter counts committed picks (held, sending and confirmed); the bar reads "{n} left today" |
| Pick held | Undo in the bar (above) |
| Picks syncing | Deck continues normally; striped blocks and the saving line show what is still sending |
| Picks still saving after 60 s | Banner with "Retry now"; retries continue until the question closes |
| Reconnecting this device | Banner "Reconnecting this device"; picking stays possible, picks queue |
| Set up on another device | Panel "Cojam is now set up on another device" with "Play on this device" |
| Pick failed for good | Card returns as unanswered with "Not saved. Pick again."; counter drops by one |
| Fifth pick committed | Finishing panel, then H3 |
| Finished home | Deck end panel with "See today's picks" |
| No image for a question | Fallback card (category icon on the blue grid) |
| No set published | Empty state: title "Today's set is on its way", body "New predictions open at {time}." with a countdown; no cards |
| Set closed while open | Empty state "Today's set has closed. A new set is ready." with primary "Show new set" (7.1) |
| Error loading set | Block error 2.5 with "Try again" |
| Offline | Cached cards visible, answers drawn switched off; a tap toasts "Connect to the internet to pick." |
| Account on hold | The Account on hold screen (2.6) in place of Home |

Validation: a pick is refused client side when its question is past its close time ("This question has closed."), when the set is past its close time ("Today's set has closed. A new set is ready."), when the question is already answered on chain ("You already picked on this question."), or offline.

### H2 Home, list view

**Purpose**: the same 5 questions as a list for players who prefer reading to swiping (the "terminal view" of the plan, labelled "List").
**Entry**: view switch on H1; remembered choice.

| Block | Elements | Source |
| --- | --- | --- |
| Page head | As H1, view switch with "List" named | |
| List | 5 rows in set order, each with a 52 px image thumbnail on the right (category icon when there is no image) | `[api]` set plus `[chain]` and `[local]` picks |
| Row | Number "01" to "05"; question (2 lines); category tag; state cell | |
| Current row (open) | Question in full as `h2`, "Answer: {rule}", the "AI settles it after {time}" button, the two coral and sky answer buttons, foot line "+50P if right. Undo for 3 seconds." | |

Row state cell:

| Row state | State cell | Notes |
| --- | --- | --- |
| Held (inside the Undo window) | "Chose {choice}" plus a secondary "Undo" with its ring in the row | Undo returns the row to unanswered and makes it the open row |
| Answered, sending or retrying | Spinner (label "Saving") and "Chose {choice}" | Optimistic: the row reads as answered at once |
| Answered, confirmed | Check icon, "Chose {choice}" (pick chip in its colour) | Row muted (still 4.5:1) |
| Current (first unanswered) | Open row (above) | |
| Remaining | Secondary small button "Pick" | Tap makes it the open row; the plan's "Join" label is replaced by "Pick" |
| Failed for good | Warn icon, "Not saved", button "Pick again" | Row returns to unanswered and becomes current if no other row is |

Under the list, once all five are picked: "That is all five" with "Finishing in {n}" and primary "Finish now" while a pick is held; then "Saving your last pick"; on a finished day the block leads the list with "Answers are set within 48 hours. The next set opens at 09:00 KST." and primary "See today's picks". Picks in H2 follow the same Undo, leaving, optimistic sending, retry policy and play key banners as H1. Only one row is open at a time. Rows answered earlier stay visible (the list shows the whole set); the card view shows only the remaining ones.

States: loading (5 row skeletons), empty, closed, error, offline, other device and on hold as H1.

### H3 Day done with countdown

**Purpose**: close the day, confirm the 100P, point to what comes next.
**Entry**: the fifth pick leaves its Undo window (or "Finish now"); "See today's picks" on the finished home.

| Block | Elements | Source |
| --- | --- | --- |
| Page head (blue band) | h1 "All 5 done"; hero figure "+100P" in the display numerals; reward status line; counter "5/5" and 5 day blocks | `[chain]` plus `[local]` outbox |
| Reward status | Until the fifth pick's transaction is mined: spinner and "Saving your last pick"; the hero waits in the quiet blue and the point pill shows its Saving state. The 100P is credited in that same transaction, so as soon as it is mined and the reward event is read: check and "+100P added to your points"; the hero pops in lime with a burst that stays inside the band, then settles to white; the pill counts up. No toast repeats it (live region "+100P paid."). Never shown before confirmation (REVIEW A4) | `[chain]` completion reward event |
| Welcome bonus (once, invited players only) | On the first completed day of a player whose invite was linked, and only when the welcome credit is in that same transaction (DEV-PLAN 3.9): a second figure "+100P" with the tag "Welcome bonus" beside the hero; the status reads "+200P added to your points" ("+{n}P added to your points" with the sum); a note under it: "{name} invited you, so your first full day pays a one time +100P welcome bonus on top of today's +100P." The pill counts up by the sum | `[chain]` welcome event |
| Action | Primary "See weekly ranking" (K1) | |
| Next set | One line: clock icon, "Next set in" and the time "hh:mm:ss" (tabular); screen reader text updated every minute only: "Next set in {h} hours {m} minutes" | `[api]` next open time, server offset |
| Today's picks | Section under the 2 px rule: heading "Today's picks" with text link "See results" (R1); "{n} waiting for answers"; two lines "Answers are set within 48 hours." "Each right pick pays +50P about 6 hours later."; one row per pick: question (1 line), pick chip, and when known "Hit: +50P lands about {time}" or "Miss" | `[chain]`, `[api]` |

States: saving (status "Saving your last pick"); paid ("+100P added to your points"); welcome (the invited player's first full day, above); fifth pick failed for good (back to H1 or H2 with that card back as unanswered; there is no separate reward failure because the reward is paid in the fifth pick's transaction); countdown at zero: "Loading the new set" with a spinner, then H1 or H2 and the toast "New predictions are open."; offline: countdown keeps running from the cached time, status shows the last known state.

### R1 Results

**Purpose**: show the outcome of past picks, hits and points earned.
**Entry**: Results tab, toast "See results", H3.

| Block | Elements | Source |
| --- | --- | --- |
| Page head | h1 "Results" | |
| Summary | Three figures in one row, each with a label and one short fact (section label "Points summary" for screen readers): "This week" "{p}P" with "{a}/{b} hits"; "All time" "{p}P" with "{n}% hit rate"; "Pending" "+{q}P" with "about {time}" (the player's own hits inside the correction window). These are prediction points only: invite bonus and welcome points are not in them | `[api]` aggregates of `[chain]` events |
| Filter | Segmented "All" / "Waiting" / "Set" | `[local]` |
| Legend | "What the marks mean": hit (ink filled), miss (ink outline), waiting (outline with a core) | static |
| Day groups | Newest first, under the 2 px rule. Group head: "Today" / "Yesterday" / weekday and date; one mark per question; sub line "All 5 answered: +100P" or "{k} of 5 answered", plus ", +{q}P pending" when any, plus ", +100P welcome bonus" on the day it was paid; the day total "+{p}P" (confirmed only, prediction points) in the display numerals. Each question settles on its own, so a slow question never holds back the others | `[api]` |
| Invite bonus line (days on which friends earned the player a bonus) | Its own line in the day group, apart from the day's points and the hit chips: "Invite bonus", "10% of your friends' points. Not counted in the ranking.", "+{p}P" and a chevron to I1 | `[api]` |
| Result row | Question (2 lines); meta: category and "You: {choice}" (pick chip); right column: a state chip and the points | `[api]` question and answer, `[chain]` pick and payout |
| Load more | Text button "Show earlier days" (pages of 7 days) | `[api]` |

Right column per outcome:

| Case | Chip | Points |
| --- | --- | --- |
| Waiting for answer | Clock chip "Waiting, {time}" (always within 48 hours after the day's set closed) | "+50P if hit" (muted) |
| Hit, paid | "Hit" (ink filled) | "+50P" |
| Hit, pending (inside the 6 hour correction window) | "Hit" | "+50P" with "about {time}" |
| Miss | "Miss" (neutral, not red: a miss is not an error) | "0P" |
| Not answered | "Not answered" (muted) | "0P" |
| Not saved (the question closed first) | "Not saved: the question closed" (muted) | "0P" |
| Corrected | "Corrected" | "+50P" |
| Cancelled | "Cancelled" (muted) | "0P" |

Row tap expands (`aria-expanded`): "Answer:", "Evidence:" (one line from the AI's evidence summary) and "Set at:" for set answers; for a pending hit "Answers can be checked again for 6 hours before points are paid."; for a corrected answer "The first answer was wrong. Corrected on {date}. +50P added"; for a cancelled one "This question was cancelled. No points either way. Your 100P for finishing the day is not affected." (also used when no answer could be set within 48 hours); for a waiting one "Source:". Every expanded row except cancelled ones has a text link "How answers are set" that opens the same sheet as the card, with this question's source and time.

States: loading (summary skeleton, 3 group skeletons); empty (no picks yet): title "No results yet", body "Your picks appear here once you play.", primary "Go to today's predictions"; filter empty: "Nothing waiting. All your answers are set." / "No answers set yet."; error per block; offline shows cache with stamp.

### K1 Weekly ranking

**Purpose**: show the week's Top 10, the prize, and where the player stands.
**Entry**: Ranking tab, H3 button.

| Block | Elements | Source |
| --- | --- | --- |
| Page head | h1 "Weekly ranking" | |
| Week switch | Segmented "This week" / "Last week" (label "Week") | `[api]` |
| Note slot | Winner line "You placed {rank} last week. {amount} CT was sent to your wallet." (sky note); on "Last week" while it is being finalised "Week closed. Late answers can still add points until Wednesday 21:00 KST, then prizes are sent."; after the airdrop "Prizes sent." with "View on Kaiascan" (ok note) | `[api]`, `[chain]` |
| Pool | Two figures straight on the page: label "This week's pool" with "{pool} CT", and "Ends in" with "{d}d {h}h" (on "Last week": the pool and the tag "Final ranking" or "Prizes sent."); text link "How prizes work" opens a sheet | `[api]` settings and qualified count, server time |
| "How prizes work" sheet | "Each qualified player adds 1 CT to the pool: {n} so far. The pool is capped at 10,000 CT." / "Same points: whoever got there first ranks higher. Every rank has its own prize, and prizes are never split." / "Players count when they play on 3 or more days of the week and joined more than 7 days ago. Prizes are sent on Wednesday at 21:00 KST, after every answer of the week is in." Then the split table: "#1" to "#10", share of the pool and CT | `[api]` |
| Top 10 | Section "Top 10" with a live stamp "Updated {n}s ago". Ranks 1 to 3 as a podium: name, points, prize "{c} CT", on a step whose height is the rank. Ranks 4 to 10 as rows under column labels "Player and points" / "Prize": rank number, name, "{p}P", prize. Empty ranks read "Not awarded" (the unused prize stays in the reserve). Names are the ranking name or the short address `0x12ab…cdef`, `translate="no"`. Points are confirmed weekly points only: pending hits, invite bonus and welcome points are never ranked | `[api]` ranking snapshot, refresh every 60 s while visible |
| Tie line | Under the list, info icon: "Same points: whoever got there first ranks higher." | static |
| Around you | Section "Around you", sub "Ranks {a} to {b}": the rank above the player, the player (tag "You"), the rank below, each with its distance in words "{n}P ahead" / "{n}P behind" / "Level". Hidden while the player is in the Top 10 or unranked | `[api]` |
| Pinned bar | Ink bar above the tab bar: rank, "You", "{gap}P behind the top 10", and the player's "{p}P" labelled "This week" (so it is not read as the balance). Tap scrolls to "Around you" and flashes it (label "Show the ranks around you") | `[api]` |

Pinned bar variants: in the Top 10: rank, "You are in the top 10", "Prize {c} CT", and the player's podium or row carries the "You" tag; unranked (no points this week): "No rank yet. Finish today's 5 to get on the board." with button "Play today's set"; "Last week": rank, "You", "Final ranking", points labelled "Last week".

States: loading (pool skeleton, 10 row skeletons); fewer than 10 eligible players: the empty ranks show "Not awarded"; last week being finalised (Monday 09:00 KST to Wednesday 21:00 KST) and prizes sent (above); error, offline as usual. The first view sizes rows so the pinned bar's top edge lands between two rows.

### S1 Staking, new stake

**Purpose**: lock CT for a period and earn interest.
**Entry**: Staking tab (when the player has no stakes), the "New stake" tab from S2.

| Block | Elements | Source |
| --- | --- | --- |
| Page head | h1 "Staking" | |
| Tabs | Two tabs standing on the 2 px ink rule (they navigate between two pages, so they are tabs, not a segmented filter): "New stake" / "My stakes" with the count of open stakes in a chip | `[chain]` stake count |
| Amount | Field "Amount" with unit "CT" and "Max" inside; right of the label "Available {balance} CT"; under the field one line: "Minimum 100 CT" until the minimum is met, then the tier cue "1,000 CT or more earns +1%" / "+1% applied. +2% from 10,000 CT" / "+2% applied: the top rate"; in Korean only the KRW value "약 {krw}원" | user, `[chain]` CT balance, KRW from the swap site's live price source |
| Lock period | Four buttons "30 d" / "90 d" / "180 d" / "365 d" (90 preselected), each showing its annual rate for the tier of the amount entered; rates roll to the new tier as the amount crosses a tier | `[chain]` staking rate table |
| Summary | One figure: label "Interest over {d} days", value "{x} CT" (a dash while the amount is invalid); in Korean only "약 {krw}원" as its caption | computed client side |
| Lock line | Lock icon, "Locked until {date}. No early exit." | |
| Help | Disclosure "How staking works": "The rate is set by the size and period of each stake. The full interest is set aside when you stake, so it is never affected by later stakes." and the rate table (lock by "Under 1,000" / "1,000+" / "10,000+") | `[chain]` |
| Action bar (pinned above the tab bar) | Primary "Stake {a} CT" when valid, "Stake" (disabled) otherwise; note "No fee: Cojam pays the network fee." | |

Validation (the reason is said once, in the line under the field; the button keeps "Stake" and is switched off):

| Rule | Message |
| --- | --- |
| Not a number (parser accepts "1,250.5", "1250", "40 CT") | "Enter an amount in CT, like 250." |
| More than 4 decimals | "CT has up to 4 decimals here." with fix button "Use {b} CT" (rounded down) |
| Below minimum | "The minimum is 100 CT." with fix button "Stake 100 CT" when the balance allows |
| Above balance | "That is more than your {b} CT." with fix button "Use {b} CT" |
| Zero balance | Field disabled; note "You have no CT yet. Deposit CT or convert points first." with buttons "Deposit" (W3), "Convert points" (W2) |
| Staking full (the interest fund cannot reserve this stake's interest) | Note warn "Staking is full for now." When some room is left: "Right now you can stake up to {x} CT for {d} days." with fix button "Stake {x} CT"; else "New stakes open again when Cojam adds interest funds." Button disabled |
| 20 open stakes | Note "You have 20 open stakes, the most allowed. Withdraw an unlocked stake to open a new one." with button "My stakes (20)". Button disabled |

While the amount is in error the period buttons keep the base tier rates and the summary shows no interest (no rate is promised for an amount that cannot be staked).

Transaction: **every stake opens the review sheet first** (a lock with no early exit never starts on one tap): title "Stake {a} CT for {d} days?", rows "Amount", "Lock period", "Annual rate", "Interest over {d} days" (emphasised), warn "No early exit: this CT stays locked until {date}.", primary "Stake {a} CT", "Cancel". Then two steps when the allowance is short (approve, stake), one otherwise; sheet 2.2. Success: "Staked {a} CT", rows "Unlocks on {date}", "Annual rate {r}%", primary "See my stakes" (S2). The available balance drops at once on every screen that shows it.

States: loading (field skeletons, inputs disabled); staking full (above; the full interest of every stake is reserved when it opens, so existing stakes are never affected); staking paused (pause covers new stakes only): note "New stakes are paused. Your stakes keep earning and can be claimed and withdrawn." button disabled; account on hold: field disabled, note "Paused while this account is on hold."; a stake pending with its sheet hidden: the action button is the status; error; offline ("Connect to the internet to stake.").

### S2 My stakes

**Purpose**: watch interest grow, claim interest, take the stake back after unlock.
**Entry**: Staking tab (when stakes exist), the "My stakes" tab from S1, W1 "Staked" row, success sheet.

| Block | Elements | Source |
| --- | --- | --- |
| Page head and tabs | As S1, "My stakes" current | |
| Total | Label "Staked", figure "{sum} CT"; under it two figures side by side, both to 4 decimals: "{x}" "Interest so far (CT)" (ticking every second) and "{y}" "Claimable now (CT)" | `[chain]` positions, ticking computed client side from rate and start, re read every 30 s |
| Stake sections | One section per open stake under the 2 px rule, newest first | `[chain]` |
| Stake section | Amount "{a} CT"; "{d} days at {r}%"; tag "Locked" (lock icon) or "Unlocked" (sky); progress bar with "Started {date}", "Day {x} of {d}", "Unlocks {date}"; row "Interest" "{i} CT" (ticking, 4 decimals); the action line (below) | `[chain]` |
| Closed | Disclosure "Closed ({n})": per closed stake "{a} CT, {d} days at {r}%", tag "Closed", "Paid out {a} CT" | `[chain]` |

Action rules (shown in place, one per stake):

| Condition | Shown |
| --- | --- |
| Locked, interest under 10 CT | No button (there is nothing to press): the line "You can claim from 10 CT. {g} CT to go." |
| Locked, interest 10 CT or more | Secondary "Claim {i} CT interest" |
| Unlocked | Primary "Withdraw {total} CT" (the stake plus all remaining interest), with the line "{p} CT stake + {i} CT interest" under it (interest stopped at the unlock date) |
| Closed | Moves to the Closed disclosure |

Transactions through sheet 2.2 (no review step for claims and withdrawals: nothing is locked by them). Success copy: "Claimed {i} CT interest." / "Withdrew {a} CT. It is in your wallet." Unlock moment: when a stake crosses its unlock time while visible, its tag flips to "Unlocked" and the withdraw button appears (no reload; live region "Unlocked").

States: loading (total and 2 section skeletons); empty: "No stakes yet", body "Stake CT to earn interest every second.", primary "Start a stake" (S1); account on hold: claims and withdrawals are user paid (2.6) with the KAIA fee row of W4; error, offline (tickers stop and show "Paused while offline").

### W1 Wallet

**Purpose**: one place for balances and the address, and the door to convert, deposit, withdraw and invite.
**Entry**: Wallet tab, point pill.

| Block | Elements | Source |
| --- | --- | --- |
| Page head | h1 "Wallet" | |
| CT (hero) | Label "Available", figure "{c} CT"; in Korean only "약 {krw}원"; next to it the **short address chip** "0x7A3f…1C7e" with a copy icon (a tap copies the full address; for 2 s the icon is a check and the label "Copied"; screen readers get "Copy address: {full address}") and opposite it the live stamp "Updated {n}s ago" | `[chain]`, `[privy]` |
| Actions | Secondary "Deposit" and "Withdraw" side by side | |
| List | Row "Staked" "{s} CT" with the count of open stakes and a chevron (S2); row "KAIA" "{k} KAIA" with "Only needed to withdraw CT to another wallet." | `[chain]` |
| Points | Under the 2 px rule: label "Points", figure "{p}" (second in size); line "1,000P = 1 CT. You can convert {n} CT now." or "1,000P = 1 CT. {g}P more for your first CT."; when the player's own hit points are pending: chip "On the way" with "+{q}P, lands about {time}"; primary "Convert points" (the one primary action of the screen) | `[chain]`, `[api]` pending hits |
| Invite row | Under "Convert points" (so the primary stays where it was): row "Invite bonus this week" with "Get 10% of the points they earn", the figure "+{p}P" (0P when none) and a chevron to I1 (back returns to W1) | `[api]` invite stats |
| Token info | Disclosure "Token info": warn "New CT token contract. Do not send anything to this address.", the full contract address `0x91cb3B346C80ff965a9667ba6228834dbedD71a2` in groups, secondary "Copy contract address" (toast "Contract address copied. Do not send funds to it."), "Kaiascan" external link | static, from network config |

The player's full address and its QR are shown on W3 Deposit only (DECISIONS). States: loading (section skeletons); zero balances shown as "0P", "0 CT", "0 KAIA" (not empty states); Kaia not answering: note "Kaia is not answering right now. Balances may be out of date." with "Try again", pill in its Error state; offline: note "Connect to the internet to convert, deposit or withdraw.", cache with stamp, actions disabled; account on hold: "Convert points" disabled with "Paused while this account is on hold.".

### W2 Convert points to CT

**Purpose**: turn points into CT at the current rate. Invite bonus and welcome points convert like any points.
**Entry**: W1 "Convert points", S1 zero balance note.

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Convert points" | |
| Amount | Field "Points to convert" with unit "P" and "Max" (largest multiple of 1,000 at or under the balance); right of the label "Available {p}P"; helper "In steps of 1,000P" | user, `[chain]` |
| Result | "You get" "{n} CT" (large) | computed from `[chain]` rate |
| Rows | "Rate": "1,000P = 1 CT"; "Minimum": "1,000P"; "Daily limit": "50 CT a day. {n} CT left today."; "Fee": "None. Cojam pays the network fee." | `[chain]` settings and today's conversions |
| Rank note | "Converting does not change your weekly rank." | static |
| Action bar | Primary "Convert {p}P to {n} CT" ("Enter points to convert" while empty) | |

Validation:

| Rule | Message |
| --- | --- |
| Under 1,000P | "The minimum is 1,000P." |
| Not a multiple of 1,000 | "Convert in steps of 1,000P. Try {f}P." fix button "Use {f}P" |
| Above balance | "You have {p}P." fix button "Use {f}P" |
| Balance under 1,000P | Input disabled; empty state "You need 1,000P to convert", body "You have {p}P, {g}P to go." button "Play today's set" |
| Account younger than 7 days | Input disabled; title "Your first conversion opens on {date}", body "New accounts wait 7 days before the first conversion. You can convert from {date}." and "{d} days {h} hours to go". Points keep growing meanwhile |
| Above the personal daily limit | "You can convert {n} CT more today, which is {f}P." fix button "Use {f}P" |
| Personal daily limit used up | Input disabled; "You reached today's limit of 50 CT. You can convert again after {time}." ({time} is the next 09:00 KST) |
| Everyone's daily limit reached (20,000 CT a day in total) | Input disabled; "Today's conversions are used up for everyone. Try again after {time}." |
| Account on hold | Input disabled; "Paused while this account is on hold." |

Success: "Converted {p}P to {n} CT." rows "Points left {x}P", "CT balance {y} CT". Conversion reserve short: 2.5 copy, button disabled.

### W3 Deposit

**Purpose**: receive new CT (and KAIA for withdraw gas) from another wallet or an exchange. The only screen that shows the player's full address and its QR.
**Entry**: W1 "Deposit", S1 zero balance note, W4 "Deposit KAIA" fix.

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Deposit" | |
| Lead | "Send new CT or KAIA to this address on the Kaia network." | static |
| QR block | QR of the address (plain address, no URI scheme), mark in the centre | `[privy]` |
| Address | Label "Your wallet address (Kaia)", the full address in monospace groups (two rows of five groups), primary "Copy address" (the screen's one primary action; label "Copied" for 2 s), watch line under it: live dot and "Waiting for deposits"; on arrival a tag "{a} CT arrived" and the toast "{a} CT arrived in your wallet." | `[privy]`, `[chain]` balance poll every 10 s while open |
| Network and token | Rows "Network" "Kaia (chain ID 8217)", "Token" "new CT"; the full contract `0x91cb3B346C80ff965a9667ba6228834dbedD71a2` in groups with a "Copy" text button | static |
| Warnings (warn note, one list) | "Send only on Kaia. Tokens sent on another network can be lost." / "Old CT does not work here. Swap it first at cojam.app." with link "Swap old CT" / "Sending from an exchange? Choose the Kaia network for the withdrawal." | static |

No share button: sharing the invite link is the only sharing feature (DECISIONS). States: loading (QR skeleton square, address skeleton); address unavailable (Privy error): "We could not load your wallet address. Try again."; offline: address still shown from cache with "Deposits will show when you are back online."

### W4 Withdraw

**Purpose**: send CT to another wallet. The player pays the gas in KAIA.
**Entry**: W1 "Withdraw".

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Withdraw CT" | |
| Gas note (always) | "Withdrawals are not sponsored. You pay a small network fee in KAIA." Row "Your KAIA" "{k} KAIA" | `[chain]` |
| To | Field "To address" with a "Paste" button (no QR scan at launch); a valid address shows "Valid Kaia address" | user |
| Amount | Field "Amount" in CT with "Max", "Available {c} CT" | `[chain]` |
| Fee row | "Network fee" "about {f} KAIA" | `[chain]` gas estimate |
| Action bar | Primary "Withdraw {a} CT" ("Enter address and amount" while incomplete) leads to the review sheet | |

Validation:

| Rule | Message |
| --- | --- |
| Empty address | "Enter the address to send to." |
| Malformed (not 0x plus 40 hex) | "This is not a Kaia address. It starts with 0x and has 42 characters." |
| Mixed case checksum fails | "Check this address. One or more letters are wrong." |
| Own address | "This is your own Cojam wallet. Enter another address." |
| A token or contract address known to swallow tokens (new CT, old CT, swap, staking, prediction contracts) | "This is a contract address, not a wallet. CT sent here is lost." (blocks) |
| Amount invalid, zero, above balance | as S1 rules, "That is more than your {b} CT." |
| KAIA under the fee estimate | Button disabled; error note "You need about {f} KAIA for the network fee. You have {k} KAIA." fix button "Deposit KAIA" (W3) |

Review sheet (always): "Send {a} CT", rows "To {full address}", "Network fee about {f} KAIA", checkbox "I checked the address. Sends on Kaia cannot be undone." (the primary stays disabled until it is ticked). Primary "Send {a} CT". Success: "Sent {a} CT." with Kaiascan link.

States: loading; offline ("Connect to the internet to withdraw."); Max subtracts nothing (fee is KAIA, not CT). W4 works while the account is on hold (it is user paid).

### I1 Invite friends

**Purpose**: give the player their invite code and link, explain the bonus, and show what invites have earned. Sharing the invite link is the only sharing feature in the product (DECISIONS).
**Entry**: the "Invite friends" row on P1 (back returns to P1) and the "Invite bonus this week" row on W1 (back returns to W1).

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Invite friends" | |
| Offer (blue band) | "10%" in the display numerals with the line "You get 10% of the points your friends earn."; sub "Paid the moment they earn it. Nothing is taken from your friend."; the offer worked once: "A friend earns +350P" to "You get +35P" (a full day with five hits; label for screen readers "Example: when a friend earns 350P, you get 35P.") | `[api]` config (`referralBps`) |
| Your invite code | Label "Your invite code"; the code as a copy block (data face, letter spaced, `translate="no"`; a tap copies it, "Copied" for 2 s); under it the link `app.cojam.app/i/{code}` | `[api]` `GET /v1/invite` |
| Actions | Primary "Share invite link": the system share sheet through `navigator.share` (toast "Invite link shared." when it completes); where there is none, the same button copies the link and its label reads "Link copied" for 2 s. Secondary "Copy link" | |
| How it works | Section with three numbered steps: 1 "Your friend installs Cojam and enters your code when they start." 2 "Your friend plays. After their first full day of 5 they get +100P, once." 3 "Every time your friend earns points, you get 10% of them." | static, values from `[api]` config |
| Your invites | Three figures: "Friends joined" "{n}", "Bonus this week" "{p}P", "Bonus in total" "{p}P"; sub heading "Recent friends": up to 10 rows, newest first, each with the friend's masked name (masked by the server: the first two characters and the last of the ranking name, the rest as asterisks, for example "da****a"; the short address when they have no name), a state tag "Joined" or "Finished first day" (ink), and the bonus that friend has earned the player "+{p}P" ("0P" muted) | `[api]` from `[chain]` counters (`referredCount`, `referralPointsOf`) and the index |
| Good to know | "Invite bonus is not counted in the weekly ranking." / "It can be converted to CT like any other points." / "One invite link per friend, fixed when they sign up. It cannot be changed later." / "Only friends you invite yourself count. The people they invite do not pay you." | static |

Share text (one string per language, written natively): "Play Cojam with me: five predictions a day. Enter my code {code} when you start and you get +100P after your first full day." with the link `https://app.cojam.app/i/{code}`. The code is in the text because an iPhone home screen app cannot read the link (G1).

States:

| State | Display |
| --- | --- |
| Loading | Section skeletons for the figures and three friend rows |
| No friends yet | In "Your invites", one plain sentence instead of figures at zero: "No friends have joined yet. Your bonus starts with the first point your first friend earns." The offer, the code and the steps carry the page |
| Ready | All blocks |
| Copied, shared | The copy block reads "Copied"; the toast "Invite link shared." |
| Error | In "Your invites": error note "We could not load your invites. Your code still works." with "Try again"; the code and link from cache stay usable |
| Offline | Code and link from cache (copy and share still work; the link opens later); figures from cache with "Last updated {time}" |
| Account on hold | Code and actions hidden; note "Paused while this account is on hold." (no new invites while frozen; past bonus stays) |

### P1 Profile and settings

**Purpose**: name in the ranking, language, account, invites, links.
**Entry**: header profile button (back goes to W1).

One flat page; sections between 2 px ink rules with hairline rows.

| Block | Elements | Source |
| --- | --- | --- |
| Header | Back, title "Profile" | |
| Identity | The ranking name (or the short address) in large type; three figures: "Weekly rank" "{r}" (or "–" with "No rank yet"), "This week" "{p}P" (ranked points), "Points" "{p}P" (balance); under them the row "Invite friends" with "Get 10% of the points they earn", the number of friends joined as a count chip (label "{n} friends joined") and a chevron to I1 | `[api]`, `[chain]` |
| Account | Section "Account": mail icon and "Logged in as {email}" (the full address, shown to the player only); label "Your wallet address (Kaia)" with the short address chip (as W1); row "View on Kaiascan" (external); device block: "Ready to play on this device" with "until {date}" (the play key's expiry; renewed on its own), or "Not set up on this device" with secondary "Set up this device" (runs the A1 setup panel), or "Set up on another device" with "Play on this device" | `[privy]`, `[chain]` play key, `[local]` |
| Name | Field "Name in the ranking" with "Save" inside the field (wakes only when the name changed and is valid; Enter saves), helper "Shown to everyone on the weekly ranking. Leave empty to show your short address." | `[api]` |
| Preferences | Section "Preferences": "Language" segmented "English" / "한국어" / "日本語" (applies at once and is remembered); "Home view" segmented "Cards" / "List" (same setting as the Home switch) | `[local]` and `[api]` |
| Help and links | Section "Help": "How Cojam works" (opens A2 panels), disclosure "How answers are set" ("An AI checks public sources after each question closes and sets the answer automatically. If an answer turns out wrong, Cojam corrects it and pays the points owed. Points already paid are never taken back."), "Swap old CT" (cojam.app/migrate/, external), "Cojam website" (cojam.app, external); Terms and Privacy when they exist (hidden until then) | static |
| Foot | Text button "Log out" in the down colour, with the confirm sheet "Log out of Cojam?" body "Your points and CT stay in your wallet. This device stops playing for you until you log in again with the same email." buttons "Log out", "Cancel". Log out revokes this device's play key and deletes it. Then "Version {v}" and text button "Check for update" ("Cojam is up to date.") | `[privy]`, `[chain]`, service worker |

Display name validation: 2 to 20 characters; letters, numbers, spaces, `_` and `.`; Hangul and kana allowed; no leading or trailing space; must not look like an address (`0x` followed by hex) or contain "cojam" or "admin" (case blind). Names are not unique; a basic word list blocks offensive names, and admins can reset a name. Messages: "Use 2 to 20 characters.", "Use letters, numbers, spaces, _ or . only.", "This name looks like an address or staff name. Pick another.", "This name is not allowed. Pick another." Success toast "Name saved."

---

## 4. Admin screens

Shared admin frame: desktop layout, left side nav (Dashboard, Reward settings, Questions, Answers, Ranking and airdrop, System, Players), top bar with environment badge ("Mainnet" in ink, "Test" in warn), signed in admin, "Sign out". Every page has an updated stamp. Every change that writes on chain shows the signer, the transaction and the result in the shared log viewer. Owner actions (reward settings, corrected outcomes after the window, reserve withdrawals) are built by the admin and signed and paid by the owner, the master wallet `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb`, connected in the browser for that one transaction; the server never signs them. Operator actions (register, link an invite, block and unblock, correction inside the window, airdrop retry) are sent by the operator key through the worker; no master wallet signature (DECISIONS). Language: English only.

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
| Alerts strip | Red or amber items with a link to the screen: "Gas wallet below {x} KAIA", "Reward reserve covers {d} days", "Staking interest fund covers {d} days", "Owner action announced: {action}", "Tomorrow has {n} of 5 questions", "{n} questions without an image", "{n} answers waiting past their time", "{n} accounts blocked in the last hour", "{n} accounts waiting for review", "Invite cluster flagged under {inviter}", "Job {name} failed {t} ago" | `[api]` |
| Today | Set status ("Live, closes in {t}"), players today, picks today, Undo rate (share of picks undone), completion rate, hits paid | `[api]` |
| KPI grid | Signed up users, active this week, points issued (today, week) split into prediction, invite bonus and welcome, points converted, CT paid by conversions, staked CT total, interest owed, this week's pool, invites linked (today, week), share of new players who were invited, accounts blocked (total, this week) | `[api]`, `[chain]` |
| Charts | Daily players and completions (30 days), points issued vs converted (30 days, prediction and invite stacked), invites linked per day (30 days) | `[api]` |
| Recent activity | Log viewer filtered to the last 50 system events | `[api]` |

### AD2 Reward settings

Form, grouped. Each field shows current value, the new value input and where it is stored (contract or server).

| Field | Initial | Rule | Error copy |
| --- | --- | --- | --- |
| Completion points | 100 | integer 0 to 1,000 | "Enter a whole number from 0 to 1,000." |
| Points per hit | 50 | integer 0 to 1,000 | same |
| Invite bonus rate | 10% (1,000 bps) | 0 to 20%, whole basis points | "Enter a rate from 0% to 20%." |
| Welcome bonus | 100P | integer 0 to 1,000 | "Enter a whole number from 0 to 1,000." |
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
| Invite links per inviter per day (server setting) | 30 | 1 to 1,000 | "Enter 1 to 1,000." |
| Risk thresholds (server setting) | block at score 80, review from 50 | 0 to 100, review below block | "The review threshold must be below the block threshold." |
| Staking rate table | the 4 x 3 table | percent 0 to 50, two decimals | "Enter a rate from 0 to 50." |
| Staking tiers | 1,000 and 10,000 CT | ascending | "Tier limits must go up." |
| Minimum stake | 100 CT | 1 to 100,000 | "Enter 1 to 100,000." |
| Minimum interest claim | 10 CT | 0 to 1,000 | "Enter 0 to 1,000." |

Flow: "Review changes" shows a diff table (old, new, effective from), then "Sign with the owner wallet". Effective from: prediction contract values (including the invite bonus rate and the welcome bonus) apply 48 hours after the owner's proposal (announced on chain), then the owner applies them; staking values apply to new stakes at once and never change an open stake; server settings apply at once. Pending on chain changes show the transaction state and the time they can be applied. Save fails: "Not saved: {reason}. Nothing changed."

### AD3 Questions

| Block | Elements |
| --- | --- |
| Calendar strip | Next 14 days, each with "{n}/5" filled and "{m}/5 with image"; days under 5 marked amber |
| Toolbar | "Assign 5 per day" (fills empty slots from the AI queue for the next 14 days), "Add question", filter by state, search |
| Table | Publish day, slot (1 to 5), image thumbnail, question (EN), choices (left / right), category, closes at, answer due, state chip, source ("AI" or "Manual"), actions |
| AI queue | Drafts not yet scheduled, with the AI's resolve rule, suggested source and image; row actions "Schedule", "Edit", "Discard" (allowed until the day is published on chain; no approval step) |
| Question form | Language tabs EN / KO / JA, each with: question (EN up to 70 characters, KO and JA up to 40, at most 3 lines on the card), left choice and right choice (EN up to 12 characters, KO and JA up to 8), answer rule (EN up to 60 characters, KO and JA up to 40), settle time phrase. Each language is written natively by the AI and editable; a counter shows characters left. Then category (list), publish day and slot, closes at (default: set close), answer due (at most 24 hours after the set closes, so the answer is set within 48 hours), resolve rule (how the answer is decided), sources (URLs) |
| Image block | The question image with **card crop previews**: the front card as it renders at 360 and 430 px wide, in each language (the longest title decides), with the scrim, chips, title and answer buttons drawn over it, plus the 52 px list thumbnail. Image state chip ("Generated", "Fallback", "Replaced", "Rejected by check"), the prompt used and the model. Actions: "Generate again", "Use category illustration", "Upload image" (4:5, at least 800 x 1000, checked by the same rules) |

State chips: "Draft", "Scheduled", "Live", "Closed", "Answer set", "Corrected", "Cancelled".
Validation: "A day can hold 5 questions." / "Both choices are needed in every language." / "The question is too long for the card in {language}." / "Answer due must be after the close time." / "Answer due must be within 24 hours after the set closes." / "Add at least one source." / "Live questions cannot be edited." (only cancel, which voids the question: no hit points, the pick still counts toward the 5; the image of a live question can still be replaced, because it is not part of the content hash).

### AD4 Answers

| Block | Elements |
| --- | --- |
| List | Questions after close: question, closed at, AI answer, confidence if the AI gives one, set at, correction window ends at, hits paid or pending, deadline (set close plus 48 hours), state chip; filter "Waiting", "Set", "Corrected", "Late" (past due), "Near deadline" (less than 8 hours to the 48 hour deadline, after which the question is cancelled) |
| Detail | Question and resolve rule in the three languages; AI answer; evidence: sources with link, quoted text, fetched time; on chain set transaction; pick counts per choice; hits paid |
| Log | Log viewer of the AI run: prompts, tool calls, retries, errors, timestamps |
| Correction tool | "Correct this answer": choose the right answer, reason (required), preview impact table ("{a} players who picked {right} will get +{p}P, and their inviters 10% of it", "{b} players were paid for {wrong}: they keep their points"), "Apply correction". Inside the correction window the operator key replaces the answer before anyone is paid; after it, the owner wallet signs the corrected answer and the operator pays the compensation (which pays the invite bonus too, DEV-PLAN 3.9). Records everything in the log |
| Retry | For failed or late runs: "Run AI again" |

Errors: "Give a reason for the correction." / "This answer is already being corrected." / "Correction failed: {reason}. Nothing was paid."

### AD5 Ranking and airdrop

| Block | Elements |
| --- | --- |
| Week selector | This week, past weeks |
| Pool | Qualified players (played 3 or more days, account older than 7 days, not frozen), pool per player, pool total (capped at 10,000 CT), split table with CT per rank |
| Ranking table | Rank, display name, address (full, copy), weekly points (prediction points only; invite bonus and welcome points are excluded on chain), prize CT, tie note ("Same points: reached {p}P first"), flags; row action "Reset name" |
| Airdrop | Automatic on Wednesday 12:00 UTC (21:00 KST), after every answer of the week is in. Status: "Not due", "Waiting for late answers", "Ready", "Sending", "Sent", "Failed"; transaction link per payout; button "Retry airdrop" only after a failure; reserve check: "The reward reserve has {x} CT, this airdrop needs {y} CT." Frozen winners are skipped and the next rank moves up |
| Export | "Download CSV" |

### AD6 System

| Block | Elements |
| --- | --- |
| Wallets | Gas wallet (fee payer: address, KAIA balance, days of runway at the current spend, alert threshold field); operator wallet (KAIA, runway); prediction reserve (CT balance, conversions per day, next airdrop, runway); staking interest fund (available, committed interest, principal held); treasury and owner (the master wallet address) |
| Sponsorship | Sponsored in the last hour by action (predict, play key setup, value actions), refusals by code (including `FROZEN`), median confirm time, play keys set today, last error |
| Email allow list | Table of supported providers: domain, display name (shown in A1), normalisation rule ("Gmail: dots and +tags removed", "+tags removed", "None"), enabled switch, sign ups in the last 7 days, refusals in the last 7 days; "Add provider" form (domain, display name, rule); every change asks for a reason and is written to the log. Validation: "Enter a domain like example.com." / "This domain is already listed." Removing or disabling a provider stops new sign ups only; existing players keep playing. Edit rights: owner and operator roles |
| Images | Image generation in the last 7 days: generated, rejected by the check, fallbacks used, cost; the model in use |
| Admin allow list | Approved admin emails and roles; add and remove (owner role only) |
| Jobs | Table: question publisher, AI drafter, image generator, AI answer setter, registration queue (with invite links), risk check (hourly and at sign up), settle sweep (per question), ranking aggregator, airdrop sender, deposit watcher; columns last run, result, next run, "Run now" |
| Chain | RPC endpoint health, block height lag |
| App | Running version, minimum version field, maintenance switch with message and expected end (needed for 2.6) |
| Log viewer | All events, filter by job and level |

Status chips: "Healthy", "Slow", "Failing", "Off".

### AD7 Players (abuse review and invites)

Rights: viewer reads; operator and owner roles can block, unblock and clear. Block and unblock are sent with the operator key (DECISIONS); every action asks for a reason and is written to the audit log.

| Block | Elements |
| --- | --- |
| Tabs | "Review list" · "Blocked" · "Invites" · search by address, email hash match or invite code |
| Review list | Accounts with a risk score between the review and the block threshold: address (full, copy), joined, score, rules that fired with their evidence ("6 sign ups from one network in 1 hour", "same 5 answers and timing as 0x…", "only converts", "8 friends of one inviter joined within 10 minutes"), inviter, friends; actions "Block" (reason prefilled from the rules, editable) and "Clear" (marks reviewed; the same rule does not flag this account again for 30 days) |
| Blocked | Every frozen account: address, blocked at, by ("Risk check" or the admin), reason, score, points balance (never debited), CT balance, inviter and friends; action "Unblock" (reason required; confirm "Unblock {address}? The account can predict, convert and receive prizes again. Points earned before stay as they are.") |
| Invites | KPIs (links today and this week, share of new players invited, invite bonus points issued today and this week, welcome bonuses paid); **top inviters** table: inviter, friends joined, friends with a first day done, share of friends active after 7 days, bonus points lifetime and this week, risk score, flags; **flagged clusters**: groups of friends under one inviter that share a network, device or answer pattern, with "Open in review list" |
| Player detail | Drawer: profile, registration, play key, freeze history, risk history, inviter and friends, points by kind (completion, hits, compensation, invite bonus, welcome), conversions, sponsored transactions |

Errors: "Give a reason." / "This account is already blocked." / "Unblock failed: {reason}. Nothing changed."

---

## 5. Edge cases

| # | Case | Behaviour |
| --- | --- | --- |
| 7.1 | Set rollover while the app is open | At the close time the client refetches. If the player is on H1 or H2 with picks left: the empty state "Today's set has closed. A new set is ready." with "Show new set". Held picks are sent at the close at once. Picks sent before close but confirmed after: valid if the contract accepts them by its own time check; if rejected, R1 shows "Not saved: the question closed" and no completion reward. On H3 the countdown reaching zero loads the new set (H3 states) |
| 7.2 | Pick sent, answer not set yet | R1 and H3 show "Waiting for answer" and the expected time. If the answer is late past its due time: "Answer is late. It will be set automatically." Every answer is set within 48 hours after the day's set closes; a question still without an answer then is cancelled (R1 "Cancelled"). Each question settles on its own, so a late answer never delays the hit points of the other four |
| 7.3 | Player answered only some of 5 | No 100P. The unanswered questions show "Not answered" in R1 after close. Hits on the answered ones still pay 50P each |
| 7.4 | Answer correction and compensation | Inside the 6 hour correction window nothing has been paid, so the pending hit simply changes (R1 shows the corrected answer). After it: R1 row gets "Corrected" with date and line; points owed are paid and toasted "+{n}P paid."; the inviter of each compensated player gets the invite bonus on it. Players paid on the wrong answer keep their points; no balance is ever lowered |
| 7.5 | Ranking ties | Confirmed by the founder: ranks are always distinct; equal points rank by who reached the total first, then by address (the contract checks this order). K1 says so under the list ("Same points: whoever got there first ranks higher.") and in the prize sheet ("Every rank has its own prize, and prizes are never split."). No split prizes, no "Tied" tag |
| 7.6 | Week boundary | Weeks run Monday 09:00 KST to the next Monday 09:00 KST. Hit points count in the week of the question's day, even when they land after the boundary (Sunday's questions can land until Wednesday). K1 "Last week" shows "Week closed. Late answers can still add points until Wednesday 21:00 KST, then prizes are sent." The new week starts at 0 at once |
| 7.7 | Not enough points to convert | W2 empty state with the gap |
| 7.8 | Staking below the minimum | S1 "The minimum is 100 CT." |
| 7.9 | Interest below 10 CT | While locked: S2 shows the gap line and no button. After unlock: claim any amount; withdrawal pays the stake plus all remaining interest. Interest stops at the unlock date |
| 7.10 | Unlock date | Shown as a date on the lock line and each stake; the withdraw button appears at the exact second; a stake unlocked while the app was closed shows "Unlocked" on open, and the Staking tab gets a dot |
| 7.11 | Withdraw without KAIA | W4 blocks with the fee message and "Deposit KAIA" fix |
| 7.12 | Privy session expiry | Session expired sheet (2.6). Picks keep saving meanwhile, because the play key does not need the Privy session; value actions (convert, stake, claim, withdraw) wait for the login. If the play key also needs renewing, the reconnect banner follows the login |
| 7.13 | In app browser | G1 `inapp` variant; nothing in the in app browser tries to log in; "Copy link" carries the invite link |
| 7.14 | iOS limits | No install prompt API: G1 shows steps. Home screen apps on iOS keep their own storage, separate from Safari: the Gate never stores anything the app needs (the invite code is typed by the player). Storage can be evicted after weeks without use: everything that matters is on chain or on the server, Privy restores the wallet at login, `[local]` holds only caches, the outbox and preferences, so an eviction means one new login, one "Setting up your game" step (the play key lived in that storage), and the view and language preferences come back from `[api]`. iOS has no background sync: queued picks are only sent while the app is open, and resume on the next open while the set is still open |
| 7.15 | App update available | New service worker waiting: toast "A new version of Cojam is ready." with "Reload". Never auto reload during a held pick, a pick send or a transaction. Below the minimum version: blocking Update required screen |
| 7.16 | Maintenance mode | Maintenance screen on every PWA route; Gate unaffected; admin unaffected |
| 7.17 | Two devices or two tabs | One device plays at a time: setting up a second device replaces the first device's play key. The first device then shows "Cojam is now set up on another device" with "Play on this device", and never takes the key back on its own. Picks are read from chain, so either device shows picks made on the other; a duplicate pick is refused: "You already picked on this question." Two tabs on one device share one key and one outbox |
| 7.18 | Clock skew on the device | All countdowns use the server time offset from the API, not the device clock |
| 7.19 | App killed or hidden with picks held or queued | A held pick is written to the `[local]` outbox at commit, so a kill does not lose it: on the next start a held pick whose window has passed is treated as not undone and sent while its question is open. Hiding the app sends held picks at once. If the play key was lost with the storage, queued picks are lost with it and the cards show again as unanswered |
| 7.20 | Reward reserve empty | Convert and the airdrop show the payouts paused note; nothing is debited. Staking claims and withdrawals never pause: principal and every stake's full interest are held by the staking contract from the moment the stake opens; only new stakes can be "full for now" |
| 7.21 | Gas sponsor down | Stake and convert show "Cojam could not sponsor this transaction right now. Try again in a minute."; picks keep retrying until the question closes with the H1 banner. Never fall back to charging the player |
| 7.22 | Display name abuse | Admin can reset a name (AD5 row action "Reset name"); the player sees their short address until they save a new one. Names are not unique |
| 7.23 | Deposit of old CT or another token to the Privy address | Not shown in balances. W3 warns before; no recovery tool and no key export at launch |
| 7.24 | Question cancelled after publish | The card stays in the set until it closes and a pick on it still counts toward the 5 and the 100P; it pays no hit points. R1 shows "Cancelled" |
| 7.25 | Email provider not supported | A1 shows "We cannot use this email provider yet" with the supported list; no code is sent. If a provider is removed later, its existing players keep playing |
| 7.26 | Same mailbox, different spelling (dots or +tags) | Normalised to one address: the second account is refused at registration with "This email is already linked to another Cojam account." |
| 7.27 | Play key expires while the app is closed | On the next open the key is renewed in the background (the "Reconnecting this device" banner only if it takes more than 2 s); no action from the player |
| 7.28 | Invite link opened on iPhone, app installed from it | The Gate shows "{name} invited you" and the code to copy; the installed app cannot read Safari's storage, so A2 starts with the field closed and the player opens it and types the code |
| 7.29 | Player skipped the code in A2 | Nothing is bound and the app offers no later entry (A2 help line: "You can only enter a code here, before you start."). The player plays normally without an inviter |
| 7.30 | Code entered while registration is still pending | The server keeps the code; the operator registers the player with the inviter in the same call; A2 shows "Invited by {name}" at once |
| 7.31 | Inviter is frozen | Codes of a frozen inviter are refused as unknown ("We can't find this code. Check it with your friend."); for friends already linked, no invite bonus is minted while the inviter is frozen and none is paid later; a friend's own points are untouched. The welcome bonus is not paid to a friend whose inviter is frozen at that moment (DEV-PLAN 3.9) |
| 7.32 | Invited friend is frozen | The friend pays no bonus while frozen (DECISIONS); the inviter's I1 still lists the friend with their last state (an account's hold is not shown to other players) |
| 7.33 | Many sign ups under one inviter | Above 30 links in a day the code is refused with "This code cannot be used right now. Try again later."; bursts and clusters under one inviter feed the risk check (AD7) at any count |
| 7.34 | Welcome bonus and the first day | Paid once, in the transaction of the fifth pick of the first completed day, only to a player whose invite was linked before it; a player who never completes a day never receives it; it never counts toward the ranking and earns the inviter nothing |
| 7.35 | Two players try to invite each other | Refused: a player whose own inviter is the code's owner cannot link to them ("This code cannot be used right now. Try again later.") |
| 7.36 | Pick made in the last seconds before a question closes | When the question closes within 15 s, the pick is not held: it is sent at once, with no Undo |
| 7.37 | Undo after leaving the screen | Not possible: leaving sends the held picks; the return toast "Pick saved" says so |
| 7.38 | Question image fails to load or was not generated | The card draws the category fallback; the list view thumbnail shows the category icon; nothing else changes |
| 7.39 | Player is blocked while playing | The next sponsored send answers `FROZEN`: the outbox stops, held and queued picks are dropped, and the Account on hold screen opens. Points already earned stay |
| 7.40 | Language changed mid day | Questions are already stored in the three languages: the deck, R1 and H3 re render in the chosen language at once; picks are not affected |

---

## 6. UI component inventory

### 6.0 Visual rules (DECISIONS "Visual direction", `ROUND5.md`)

- The brand's character sits on the prediction deck, the blue grid header band and the display numerals. Every other surface is quiet and flat: sections and hairline rows instead of stacked bordered cards, no card in card.
- Major sections are separated by the 2 px ink rule; light hairlines only between rows inside a list. Numbers sit directly on the surface.
- Heavy ink border and offset shadow only on the main action (primary button) and the prediction card (and the answer buttons on it).
- Three step radius scale: 6 px (tags, small controls), 12 px (buttons, fields, segmented controls), 24 px (the prediction card); pills only for chips and the point pill. Buttons are not full pills.
- **Exactly three button looks**: primary (lime `#D6FF3D`, ink edge, ink offset drop that presses down; one per view), secondary (2 px ink outline on white, 12 px radius, no shadow), text link (also used for "Cancel" in sheets, "Show earlier days", and "Log out" in the down colour). No grey filled buttons.
- **One segmented pattern**: 2 px ink outline track, current segment filled ink with white text. A control that navigates to another page reads as tabs (S1 and S2) or a view switch, not as a filter.
- Lime only for the primary action, the current selection, day progress and the day done reward moment. Never lime for a hit, a figure or decoration. No lime pill on the current tab.
- **Answer colours**: left (no, down, under) coral `#FF7A66`, right (yes, up, over) sky blue `#4DB0FF`, equal visual weight, ink text on both, on the answer buttons, the drag stamps and every pick chip. Neither answer looks recommended.
- Ink outlined number blocks or chips only for real counts, ranks, steps or states. No gradients (except the scrim that keeps card text readable), glow, glass or emoji.

### 6.1 Components

Match column: **Built** (exists in `platform/design/assets/components.css` and `components.js` under the named class or builder), **New** (to build).

| Component | Used on | Variants and states | Match |
| --- | --- | --- | --- |
| Design tokens | everywhere | colours (brand, volt, coral and sky answer colours, ink), type scale, the three radii, edges, shadows, motion durations and easings | Built `tokens.css` |
| App header | all PWA screens | tab root (logo chip), sub screen (back plus title); safe area top | Built `C.header`, `.ah` |
| Point pill | header | loading, ready, saving, hits pending ("+{n}" sky tag), stale | Built `.pts` |
| Profile button | header | initial, generic icon, current (lime) | Built `.me` |
| Page head band | tab roots | title, view switch, counter, day progress, countdown | Built `.ph`, `.ph-line` |
| Bottom tab bar | PWA | 5 items, current (filled icon, ink label, no pill), sky dot, count badge, safe area bottom | Built `C.tabbar`, `.tb` |
| Segmented control | R1 filter, K1 week, P1 language and view, A2 language | 2 or 3 options, current ink filled, disabled | Built `C.seg`, `.seg` |
| View switch | H1, H2 | current named, other as icon, on the band | Built `C.viewSwitch`, `.viewsw` |
| Page tabs | S1, S2 | two tabs on the ink rule, count chip | Built `.mtabs` |
| Day progress | H1, H2, H3, A2 | 5 blocks: empty, pending (stripes), done (lime), failed; band, small and large sizes | Built `C.day5` |
| Prediction deck | H1, G1 preview | front card plus 2 behind (offset, softened), drag, throw, spring advance, restore on Undo, nudge once, disabled | Built `App.deck`, `.deck`. See 6.3 |
| Question card | H1, G1 | image full bleed (default), image on top (alternative), fallback (category tile on the grid), chips, title (3 lines, steps down when long), meta and AI info button, stamps, failed note, foot line | Built `C.qcard`, `.qcard`, `.qimg`, `.qimg--fallback` |
| Answer buttons | H1, H2 | left coral, right sky, pressed, disabled (offline), arrow icons | Built `.choice` |
| Pick chip | H1 bar, H2, H3, R1 | coral or sky dot with the choice label | Built `C.pick`, `.pk` |
| Pick bar with Undo | H1 | hint (touch or keys), held with ring and "Z" hint, saving, saved (fades), left count | Built `.pickbar`, `.undo` |
| Deck end panel | H1, H2 | finishing (ring countdown, "Finish now"), saving, finished home | Built `.deck-end`, `.term-end` |
| AI answer sheet | H1, H2, R1 | three steps, source and time rows | Built (sheet) |
| List row | H2 | held with Undo, answered, sending, current open, remaining with "Pick", failed; thumbnail | Built `.trow`, `C.thumb` |
| Countdown | H1 head, H3, H1 empty, K1 pool | inline, display figure, zero state | Built `data-cd`, `C.closes`, `C.clock` |
| Day done hero | H3 | waiting (blue), pop (lime with burst inside the band), settled (white); static under reduced motion | Built `.done-fig`, `.burst` |
| Welcome bonus figure and note | H3 | second "+100P" with the "Welcome bonus" tag, sum in the status, note with the inviter's name | Built in the current design round (`done.html?state=welcome`) |
| Results summary | R1 | three figures with labels and facts, loading | Built `.tri` |
| Result marks and legend | R1 | hit, miss, waiting, off | Built `.rmark`, `.rs-legend` |
| Result row | R1 | waiting, hit paid, hit pending, miss, not answered, not saved, corrected, cancelled; expanded | Built `.rrow`, `.rchip` |
| Day group head | R1 | marks, completed or partial, pending, welcome, total | Built `.rs-dayh` |
| Podium | K1 | ranks 1 to 3 on steps, "You" tag | Built `.podium`, `.pod` |
| Ranking row | K1 | rank 4 to 10, not awarded, own row, gap in words (Around you) | Built `.krow` |
| Pinned bar | K1 | in Top 10, outside, unranked, last week | Built `.pin` |
| Action bar | S1, W2, W4 | primary plus note, pinned above the tab bar | Built `C.actbar`, `.pin--act` |
| Pool block | K1 | figures, countdown, tag, "How prizes work" sheet with split table | Built `.pool`, `.split` |
| Amount field with Max | S1, W2, W4 | empty, typing, valid, error with fix button, disabled; unit suffix; 16 px text | Built `C.amount`, `.field` |
| Address field | W4 | empty, valid, invalid, own address, contract warning; paste button | Built `.field-box` |
| Period buttons | S1 | 4 options with rate under each, selected, rate roll on tier change | Built `.period` |
| Summary rows | S1 review, W2, W4, sheets | key and value; emphasis row | Built `C.rows` |
| Stake section | S2 | locked, unlocked, closed; ticking interest; progress bar; claim gap line | Built `.mstake`, `.mbar` |
| Hero figure section | W1, S1, S2 | label, figure, KRW caption (Korean only) | Built `.mhero` |
| Short address chip | W1, P1 | short form, copy icon, "Copied" for 2 s, full address in the label | Built `C.addr`, `.addr-chip` |
| Full address block | W3, W1 token info, AD5 | grouped monospace, copy | Built `.addr-v`, `F.groups` |
| Primary button | all | default, hover, pressed, loading (spinner plus label), disabled (pale lime); one per view | Built `.btn-primary` |
| Secondary button | all | outline ink, small, block | Built `.btn` |
| Text link button | sheets, R1, P1 | default, down colour (Log out) | Built `.btn-ghost`, `.linkish`, `kind: danger` |
| Sheet | transaction sheet, review, AI answer, prizes, log out, session expired | bottom sheet on phones with grip, dialog on desktop; Esc closes where allowed | Built `App.sheet` |
| Transaction steps | sheet | waiting, in progress, done, failed | Built `.txsteps` |
| Toast | global | plain, with button | Built `.toasts`, `.toast` |
| Note and alert | W1, W3, W4, S1, K1, errors | info, sky, warn, error, ok, with action | Built `C.note` |
| Banner above the deck | H1, H2 | still being saved with "Retry now", reconnecting, reconnect failed | Built `C.banner`, `C.playBanner` |
| Skeleton | all | text line, pill, card, row, QR square | Built `C.skel` |
| Empty state | R1, S2, W2, H1, I1, offline | icon, title, body, one action | Built `C.empty` |
| Offline bar | global | offline, back online | Built `C.offbar` |
| QR block | W3, G1 | loading, ready, with centre mark | Built `C.qr` |
| Install steps | G1 | numbered with icons, per platform | Built `C.steps` |
| Help disclosure | S1, W1, P1, A1, G1 | closed, open, row variant | Built `C.help` |
| Language select | G1, A1 | 3 languages | Built `C.lang` |
| Email field and code field | A1, AD0 | empty, typing, invalid, typo suggestion, provider not supported, sending, checking, incomplete, wrong, expired, locked; resend timer link | Built (A1) |
| Setup panel | A1, A2 setup line, P1 "Set up this device" | three steps waiting, in progress, done; busy; refused (per reason); failed | Built (A1) |
| System screen | maintenance, update, no connection, 404, account on hold | title, body, one action; calm variant for on hold | Built `system.html` |
| Invite code copy block | I1, G1 | code in the data face, copy, "Copied" | Built in the current design round `C.code` |
| Invite code field | A2 | closed link, open with "Optional" and "Skip", typing, checking, linked ("Change"), too short, unknown with "Continue without a code", own; still to design: already linked, limit, offline | Built in the current design round (`first-run.html`) |
| Gate invite variant | G1 | with name, without name (lookup failed) | Built in the current design round (`gate.html?state=invited`); the no name case is still to design |
| Invite offer band, figures and friends list | I1 | offer with worked example, three figures, rows with masked name, state tag and bonus, empty sentence, error | Built in the current design round (`invite.html`, `assets/screens/invite.css`) |
| Invite rows | W1 ("Invite bonus this week", "+{p}P"), P1 ("Invite friends", count chip), R1 (per day "Invite bonus" line) | label, sub line, figure or count, chevron | Built in the current design round `.inv-row`, `.rs-inv` |
| Admin shell and side nav | AD1 to AD7 | selected, collapsed | Adapt `site/assets/pages/admin.css`; new side nav |
| Admin KPI | AD1, AD7 | value, unit, sub, loading | Adapt `.kpi-grid`, `.kpi` (`admin.css`) |
| Admin table | AD3 to AD7 | sortable, filter, empty, loading, row actions | Adapt `.table` (`admin.css`) |
| Admin form field | AD2, AD3 | current value, new value, error, disabled, changed marker, character counter | Adapt `.field`; new "current vs new" layout |
| Card crop preview | AD3 | 360 and 430 px, per language, thumbnail, image state | New (renders `C.qcard` at fixed widths) |
| Status chip | AD3 to AD7 | Draft, Scheduled, Live, Closed, Answer set, Corrected, Cancelled; Healthy, Slow, Failing, Off; Blocked, Review, Cleared | Adapt `.tag` |
| Log viewer | AD1, AD4, AD6 | level filter, search, expand JSON, live tail | New (monospace only for hashes, ids and payloads) |
| Calendar strip | AD3 | full, short (amber), today, image count | New |
| Diff review table | AD2 | old, new, effective from | Adapt `.table` |

### 6.2 Number formatting helper

One shared formatter (points, CT, KAIA, KRW, durations; `App.fmt` in the design) so every screen agrees; tabular numerals on every figure.

### 6.3 Prediction deck: interaction spec

| Item | Rule |
| --- | --- |
| Pointer model | Pointer Events, one active pointer, `touch-action: pan-y` on the card so vertical scroll still works |
| Axis lock | First 10 px decides: more vertical than horizontal hands the gesture to scroll |
| Feedback while dragging | The card follows the finger 1:1 on x and rotates around a low pivot up to 8° at full travel; the stamp of the choice on the drag side (its label in coral or sky) fades in from 20% travel; the cards behind come forward a little as the front card leaves |
| Commit | Travel 35% of card width or more, or velocity 0.5 px/ms or more with travel 15% or more: the card is thrown on its side with the release velocity |
| Cancel | Release below the threshold: spring back (`--ease-spring`) |
| Advance | The next card springs to the front; up to 2 cards stay visible behind (offset, softened, image only) |
| Button fallback | Two visible answer buttons on every card, always; tapping commits with the same throw |
| Keyboard | Focus lands on the deck; Left and Right arrow keys commit the matching choice; Tab reaches the answer buttons and the AI info button; Z or Backspace is Undo while a pick is held |
| Screen reader | The card is a group labelled "Question {n} of 5: {title}"; answers are plain buttons with full labels ("Pick {choice} for: {title}"); after commit a polite live region says "Picked {choice}. {k} left. You can undo for 3 seconds."; Undo is a button labelled "Undo question {n}: {choice}"; swipe gestures are not required for any path |
| Undo | 3 seconds after each commit (DECISIONS): the previous card returns to the front from the side it left and is picked again; the transaction is sent only after the window (H1). Replaces draft 2's "a pick is final" |
| Haptics | `navigator.vibrate(10)` on commit where supported (Android); the day done moment uses a short pattern; none on iOS |

---

## 7. Motion and feedback

All motion uses transform and opacity, durations and easings from `tokens.css`. Under `prefers-reduced-motion: reduce` every item below falls back as stated, and loops stop. Card motion quality is a priority (DECISIONS).

| Interaction | Motion | Duration and easing | Reduced motion fallback |
| --- | --- | --- | --- |
| Swipe drag | 1:1 follow, rotate to 8°, stamp fade in, cards behind come forward | live | Same follow (user driven) without rotation |
| Card throw | Card flies out on its side with the release velocity, rotating, fading | `--dur-deck` `--ease-out` | Card fades out, next card appears at once |
| Advance | Next card springs to the front | `--ease-spring` | Instant |
| Spring back | Return to centre | `--ease-spring` | Instant |
| Undo restore | The card comes back from the side it left and settles in front | `--ease-spring` | Instant |
| Undo ring | Ring empties over the window | 3 s linear | Static ring; the seconds are still announced |
| First card nudge | Leans right, then left, once | 1.5 s | Never shown |
| Day progress | Pending stripes slide; done fills | stripes loop; fill `--ease-out` | Static stripes; instant fill |
| Points count up | Pill and totals count from old to new value after confirmation; pill pulses once | 400 ms `--ease-out` | Number swaps at once, no pulse |
| Day done moment | "+100P" pops in lime with a flat burst inside the band, blocks wave, then settles to white | once per set | Static figure, text appears at once |
| Countdown | Digits change without animation | none | none |
| Sheet open and close | Slide up from bottom on phones, fade and scale on desktop | `--ease-drawer` | Instant |
| Toast | Rise and fade | `--ease-out` | Fade only |
| Button press | Scale down, primary presses onto its ink drop | press and release tokens | Colour change only |
| Rate roll (S1) | Period rates roll up or down one after another on a tier change | short stagger | Instant |
| Interest ticker (S2) | Last digits update every second | none | Updates every 10 s |
| Tab switch | Content crossfade | 160 ms | Instant |
| Unlock moment (S2) | Tag flips, withdraw button rises in | `--ease-spring` | Instant |
| Around you jump (K1) | Smooth scroll and a short flash on the section | `--ease-out` | Jump, no flash |

Loops (stripes, live dot) pause when off screen or when the app is hidden (`visibilitychange`).

---

## 8. Accessibility and mobile rules

- Touch targets 44 x 44 px or more, including the point pill, tab items, chips that act, copy chips, Undo and the answer buttons.
- Inputs use 16 px text so iOS does not zoom; `inputmode="decimal"` for amounts, `inputmode="numeric"` for points, `autocomplete="off"` and `spellcheck="false"` for addresses and invite codes.
- Safe areas: header top inset, tab bar, action bars and pinned rows bottom inset, sheets bottom inset; `viewport-fit=cover`.
- Contrast 4.5:1 for all text, including muted rows and disabled helper text (use `--ink-2`, never lower opacity). Lime is a fill with ink text, never text on white. Ink text on both answer colours. Card text sits on the scrim. Blue mark on ink gets a snow tile.
- Every swipe has the two button path and the arrow keys; no feature needs a gesture.
- Focus visible on every control (snow ring on blue and on the card, blue ring on white).
- One `h1` per screen; the tab bar is a `nav` with `aria-current="page"`; segmented controls use `aria-pressed`; page tabs use `aria-current`.
- Live regions: picks and Undo, points paid, transaction state, deposit arrival, invite code result, countdown (minute updates only).
- Question images are decorative (`alt=""`): the title carries the meaning.
- Layout passes at 360, 390 and 430 px wide in EN, KO and JA with no button wrapping or overflow; Korean uses `word-break: keep-all`, Japanese `word-break: auto-phrase`; question titles are checked at 360 px in all three languages (AD3 preview).
- `lang` on the document follows the chosen language; names, addresses and codes carry `translate="no"`.
- No horizontal scroll; wide content (rate table) becomes its own scroll box with a visible edge.
- Admin: keyboard reachable tables and forms, 1280 px minimum layout, same contrast rules.
- PWA manifest: `display: standalone`, `orientation: portrait`, theme colour `#124CC4`, background `#FDFDFF`, maskable icons from `cojam-mark.svg` on a snow tile.

---

## 9. Open questions for the founder

### 9.1 Still open (each with the recommended default this spec assumes)

| # | Question | Recommended default | Screens |
| --- | --- | --- | --- |
| O1 | Reward funding amounts at launch: how much CT the master wallet sends for conversions and airdrops, and for staking interest. Sets when W2 shows "payouts paused" and when S1 shows "Staking is full for now" | Fund for 30 days of expected conversions plus 4 weekly pools, plus 5 to 10% for invite and welcome points (DEV-PLAN 3.9); top up monthly | W2, S1, AD6 |
| O2 | External audit before mainnet (staking holds user principal). No screen changes | A paid external audit of `CojamStaking` at least | none |
| O3 | Which image model generates the question images | Evaluate two or three models on 30 past questions against the criteria in DEV-PLAN 6.4 (no text in the image, palette and style fit, safety filters, commercial licence, price, latency); pick the cheapest that passes | AD3, AD6 |
| O4 | Support contact on the Account on hold screen | A `support@cojam.app` mailbox (as the design has it), answered in EN, KO and JA | 2.6 |
| O5 | Should a frozen player's staking claims and stake withdrawals stay sponsored? DECISIONS says frozen accounts get no sponsored gas, so this spec makes them user paid | Sponsor these two calls only: it is the player's own principal and interest, and the on hold screen promises it stays theirs | 2.6, S2 |
| O6 | Invite code window | Only in the first run, before the player starts (chosen here, following the design); on chain the link is accepted until the first completed day so the binding can land after registration. The alternative is 24 hours after sign up | A2 |
| O7 | Daily cap on links per inviter | 30 a day (server setting in AD2); clusters go to review at any count | A2, AD2, AD7 |
| O8 | Welcome bonus when the inviter is frozen at that moment | Not paid (chosen here, to stop sybil inviters' friends collecting it) | H3 |

### 9.2 Settled (written into the screens above)

| Former # | Decision | Where |
| --- | --- | --- |
| Q1 | Privy email login with a one time code only, limited to an allow list of major email providers with address normalisation; no social providers, no wallet connect | A1, AD6 |
| Q2 | Play key for picks (one Cojam wallet signature per device per 30 days); value actions signed by the Cojam wallet with sponsored fees; if that fails in the spike, a relayer plus a one time KAIA top up for the staking approve (DEV-PLAN 1.2, 1.4) | H1, A1, S1 |
| Q3 | "Pick" | H2 |
| Q4 | Completion reward in the same transaction as the fifth pick | H3 |
| Q5 | Players paid on the wrong answer keep their points; the correct side is paid | AD4, R1, 7.4 |
| Q6 | A live question can be cancelled; a pick on it still counts toward the 5; no hit points | AD3, 7.24 |
| Q7 | Edit, discard, cancel or replace until published on chain; no approval step | AD3 |
| Q8 | New set at 09:00 KST daily; week from Monday 09:00 KST; hits count in the week of the question's day | A2, K1, 7.6 |
| Q9 | KRW in Korean only, from the swap site's live price; no fiat in EN and JA | S1, W1 |
| Q10 | Automatic airdrop on Wednesday 21:00 KST; admin retries only after a failure | AD5, K1 |
| Q11 | Yes, one line for winners | K1 |
| Q12 | Distinct ranks: equal points rank by who reached the total first; no split prizes; unused prizes stay in the reserve (confirmed again in draft 3) | K1, AD5, 7.5 |
| Q13 | 90 days preselected; up to 20 open stakes | S1, S2 |
| Q14 | Interest reserved at stake time; pause covers new stakes only | S1, 7.20 |
| Q15 | 10 CT minimum while locked, any amount after unlock; no interest after unlock | S2, 7.9 |
| Q16 | Tier by the size of each stake | S1 |
| Q17 | Paste only at launch | W4 |
| Q18 | Not unique, basic word list, admin reset | P1, AD5 |
| Q19 | No recovery tool and no key export at launch | W3, 7.23 |
| Q20 | `admin.cojam.app`, Privy email login on an allow list; owner actions signed by the master wallet | AD0, AD2 |
| Q21 | English only | Admin |
| Q22 | Prediction values apply 48 hours after the owner's proposal; staking values apply to new stakes only; server settings at once | AD2 |
| Q23 | Yes | AD6, 2.6 |
| Q24 | Legal is deferred by the founder: Terms and Privacy links stay hidden until the pages exist | A1, P1 |
| Q25 | No notifications at launch | none |
| Q26 | Qualified players (3 or more days played that week, account older than 7 days), pool capped at 10,000 CT | K1, AD5 |
| Q27 | Picks are free | H1 |
| Q28 | CT only | W4 |
| Q29 | Each question has its own close time, never after the set close | H1, AD3 |
| D1 (draft 3) | Abuse blocking: hourly and sign up checks, automatic freeze, review list, unblock with the operator key, points never debited | 2.6, AD7 |
| D2 | Image led cards with AI generated images, category fallback | H1, H2, AD3 |
| D3 | English default, manual language choice, never the device language | everywhere |
| D4 | Question text written natively in three languages, all three in the content hash | H1, AD3 |
| D5 | Undo for 3 seconds; the transaction is sent after the window | H1, H2, 6.3 |
| D6 | Coral (left) and sky blue (right) answers; the quiet flat visual direction | 6.0 |
| D7 | Short wallet address chip on W1 and P1; full address and QR on W3 only | W1, P1, W3 |
| D8 | Friend invites at 10% (0 to 20%), one level, not ranked, convertible; welcome bonus +100P on the first completed day; invite code shown on the Gate and entered in A2 only; the invite link is the one sharing feature | I1, A2, G1, H3, R1, W1, P1 |

---

## 10. Conflicts and gaps

### 10.1 Items that conflicted, and how they were resolved

1. **Interest minimum vs small stakes**: a 100 CT stake for 30 days earns about 0.66 CT, under the 10 CT minimum. Resolved: the minimum applies only while locked; after unlock any amount can be claimed, and withdrawal pays all remaining interest (REVIEW B9).
2. **Staking under the relayer fallback**: new CT has no `permit`, so an approve cannot be relayed. Resolved: path A sponsors the approve directly; path B, only if the spike fails, sends a one time KAIA top up for it (DEV-PLAN 1.2).
3. **"Predicting" changes point balances** (DECISIONS) while the plan has no cost per pick. Resolved: picks are free; predicting changes balances only through the completion, hit, invite and welcome credits.
4. **Login and wallet connect**: the plan's feature list says email login and wallet connect. Resolved by DECISIONS: Privy email login only, no wallet connect, with an email provider allow list.
5. **Desktop and mobile web app** in the plan vs installed PWA only in DECISIONS: followed DECISIONS (Gate).
6. **Admin "Answer setting" tab** implies a human sets answers; DECISIONS makes it fully automatic. AD4 is a monitoring and correction screen, not an approval step.
7. **Weekly pool = signed up users x 1 CT** grows without limit and email accounts are cheap. Resolved: qualified players only, capped at 10,000 CT.
8. **KRW value** in the staking mockup while the app ships in EN, KO and JA. Resolved: KRW in Korean only.
9. **Wrong answer compensation** with non transferable points. Resolved: points are never taken back; only the correct side is paid, and the contract checks each compensation.
10. **"A pick is final" (draft 2) vs Undo (DECISIONS)**: Undo adopted. The design lets each held pick keep its own 3 s window, so after one Undo the next most recent held pick can be undone too; DECISIONS says "Undo acts on the most recent pick only". Read here as "each press acts on the most recent held pick"; if the founder means only one Undo per window, the bar should hide Undo after one use.
11. **Invite link fixed "at sign up"** (DECISIONS) vs a code field in A2, which a player reaches after registration has usually been sent: the app offers the field only in the first run (as the design does); on chain the operator may bind the link once, until the player's first completed day (contract enforced, DEV-PLAN 3.9), so a binding that lands a little after registration still counts.
12. **Frozen accounts get no sponsored gas** (DECISIONS) vs the on hold screen's promise that CT stays the player's: staking claims and withdrawals become user paid while frozen; section 9 O5 recommends sponsoring these two.
13. **W3 "Share address"** (draft 2) vs "the invite link is the one sharing feature" (DECISIONS): removed (the built design has no share button).
14. **Image rule**: the design's image notes (`assets/img/SOURCES.md`) put the subject in the top 45% of the frame, away from the top corners, with no text in the image; this spec and DEV-PLAN follow the design (a 55% figure was discussed earlier).

### 10.2 Where the built design is missing something this spec requires

The invite screens were being added to `platform/design/` while this draft was written (I1 `invite.html`, the A2 code field, the G1 `invited` variant, the H3 `welcome` state, the W1, P1 and R1 invite rows); this spec follows them. Still missing:

| Spec item | Missing in `platform/design/` |
| --- | --- |
| A2 code states "Already linked", "This code cannot be used right now", "Connect to the internet to use a code" | Not in `first-run.html` |
| G1 invite variant when the lookup fails (no name) | Not in `gate.html`; "Copy link" in `ios-other` and `inapp` still copies the plain app URL, not the invite link |
| I1 offline and account on hold states | Not in `invite.html` |
| "Paused while this account is on hold." on W1, W2, S1, I1; on hold variants of H1 and S2 (user paid claims) | Only the full screen exists (`system.html?state=blocked`, marked as a proposal) |
| 7.36 no hold for a question closing within 15 s; held picks sent at the set close | Not modelled (mock data only) |
| Admin AD0 to AD7 | No admin screens in the design yet (desktop admin is designed later) |
| AD3 card crop preview | Not built (the card exists as `C.qcard`) |
