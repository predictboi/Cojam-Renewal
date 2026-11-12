# Cojam relaunch prototype: independent review, round 2

Reviewer did not build these pages. Reviewed in English (`?lang=en`) on 2026-11-12 at commit `bfa4ed4`, served with `python3 -m http.server 8831 -d site`. Korean spot check at the end.

Method, mobile first:

- Touch only flows in Playwright with the `iPhone 15` profile (393x659 viewport, iOS user agent) and a 360x740 Android profile (isMobile, hasTouch, DPR 3).
  - `?env=mobile-browser`: open the sheet, inspect deep link targets, Kaia view, Copy link, Back, Esc, backdrop tap, WalletConnect pick, connect.
  - `?env=inapp-kaia`: one tap connect, a bad amount (`1e5`), then `20,000`, simulated keyboard (viewport cut to 420 px), approve, swap, the 10% credit, the lot and the celebrate frames.
  - Reload with `?days=7.01`, claim it yourself. New swap, then `?days=8`: the keeper has released it.
- Desktop 1440x900 by keyboard: Tab order, skip link, sheet trap with `desktop-none` and `desktop-ext`, Enter, Esc, `?`, the wallet menu with arrows and Esc, `/` on admin.
- Motion:
  - Held touch through CDP with frame strips of press and ripple.
  - Celebrate frames, track fill frames, tilt and FAQ open frames, and video in `review2/flow/vid-*` and `review2/motion/vid-*`.
  - Layout shift by PerformanceObserver during load and during the swap.
  - Reduced motion by `reducedMotion: 'reduce'`.
- Captures: 62 by `tools/design/shot.js` (393 full page mobile, 360 mobile, 1440 desktop), every swap state, every page, status loading and error, admin `?keeper=late&gas=low`, KO. All are in `/tmp/claude-0/-home-user-Cojam-Renewal/b3270fa9-0a00-5483-ac13-fc0e6a3d97c3/scratchpad/review2/`. I looked at every one of them.
- `tools/design/audit.js` at 360 `--mobile` and 1440 on all pages and six swap states: no overflow, no text under 4.5:1, no mobile target under 44 px in the rendered DOM, accent only on primaries, the current nav item and selected segments.

## Scores

| Page | Design /100 | Usability /40 | Mobile /10 | Interaction /10 | Delta design | Delta usability | Target (85 / 34) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Landing `/` | 86 | 35 | 9 | 7 | +4 | +1 | Met |
| Swap app `/migrate/` | 83 | 36 | 8 | 8 | +2 | +3 | Usability yes, design no |
| Status `/status/` | 81 | 35 | 8 | 7 | +1 | +2 | Usability yes, design no |
| Docs `/docs/` | 84 | 36 | 8 | 7 | +2 | +2 | Usability yes, design no |
| Admin `/admin/` | 78 | 35 | 7 | 7 | +5 | +2 | Usability yes, design no |

Every page now reaches the usability target. On design, only the landing reaches 85. The swap app is the page that matters most, and three things hold it back:

- On a phone the success moment happens below the fold, under a toast.
- The page head repeats on every step.
- Kaia Wallet, the recommended wallet, still has no tap through from a mobile browser.

---

## Round 1 items: verified

| Round 1 item | Status | Evidence |
| --- | --- | --- |
| Landing: duplicate `#how-track` | Fixed | One track in the hero. How it works is four icon steps. |
| Landing: orphaned help icons | Fixed | The icons sit inline at the end of the sentence at 1440 and 393. |
| Landing: live window state in hero | Not done | The hero card still reads "Open for 1 year from launch, Dec 1, 2026 to Dec 1, 2027". This is acceptable before launch, but `/migrate/` already says "in 352 days". |
| Landing: second contract list in footer | Fixed | `data-foot="compact"` shows a "Contracts on Kaia" link. |
| Landing: timeline dot meaning | Not done | `landing.css` lines 37 to 39 still use ink, sky, ink and hollow. |
| Swap: help popovers clipped at 390 | Fixed | I tapped every visible `?` in 10 states at 360. No popover left 0..360, and Esc closes each one. |
| Swap: dead docs anchors | Fixed | `#gas`, `#exchange`, `#pool`, `#special` and `#contact` exist. "Get KAIA for MetaMask" is added. |
| Swap: `0×` glyph, wrapping chip | Fixed | The chip uses the data font and a short label under 400 px. It is 44 px tall in EN, KO and JA. |
| Swap: two countdowns on locked | Fixed | Only the track mid label remains. |
| Swap: shortcut button on touch | Fixed | It is hidden on `(hover: none), (pointer: coarse)`. |
| Swap: "You will receive 0 new CT" on invalid input | Not done | `abc` still shows "0 new CT (10%)" and "0 new CT (90%)". |
| Swap: claimed track too heavy | Fixed, overcorrected | It is now all `--line-strong`. A finished lot looks empty and disabled rather than done (see swap fix 5). |
| Status: aggregate track | Fixed | "Every swap on one track" uses `trackAggregate`. |
| Status: legend sums | Fixed | 318,849,225 + 73,248,784 = 392,098,009, and 39,209,801 + 279,639,424 = 318,849,225. |
| Status: skeleton and stale state | Fixed | `?state=loading` shows skeletons. `?state=error` shows "Could not reach Kaia. Figures are from 15:52 UTC." with Retry. |
| Status: one segmented control | Fixed | `.seg` lives in base.css. Selected uses brand tint. |
| Status: green live dot, term help | Half | The dot is sky. There are still no `?` toggles, but every figure now has a plain subline, which covers most of the need. |
| Docs: anchors and gas answer | Fixed | |
| Docs: scannable special cases | Partly | The titles are semibold and the list is readable. It is still heading plus paragraph. |
| Docs: one audit tag style | Fixed | `.tag-audit` is neutral on landing and docs. |
| Docs: TOC from the top | Fixed | |
| Docs: link in step 1 | Fixed | |
| Admin: one sample dataset | Fixed | Both pages show 392,098,009 CT, 431 wallets and 604 requests. |
| Admin: shared container | Not fixed, reversed | The header is back on `--container`, but the admin content is wider. The logo sits at x 192 and the H1 at x 112, so they are misaligned by 80 px. |
| Admin: aligned amounts | Fixed | Two decimals, right aligned. |
| Admin: CSV label and `/` | Fixed | "Export all 604 requests". `/` focuses `#lots-q`. |
| Admin: amber icons, 14 day chart | Fixed | Amber is used only for overdue releases, runway and the 24 hour note. |
| Site: forked seg, vocab, live dot | Mostly fixed | The new drift is described below: "Unlocked", "Being sent", "Sending to your wallet" and "Lock ended" all name one state. |
| Site: footer legal rule | Fixed | The rule is drawn inside the text column (`::before`, `border 0`). |
| Site: 110 px mobile sticky header | Fixed | Only the 57 px header row sticks. The banner (73 px at 360) and the nav row scroll away. |
| Site: skip link | Fixed | It is the first Tab stop and lands on `#main`. |
| Site: title pattern | Fixed | "Swap monitor: Cojam". |

---

## 1. Landing `/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | The H1, one primary and the hero card read in order. The How it works steps carry icons instead of a second track. |
| Layout | 8 | The hero card is still small for its column on desktop. The concept section is about 2.5 screens on a phone. |
| Spacing | 9 | Sections now breathe evenly. |
| Type | 9 | |
| Colour | 8 | Night ground, sky data and the one accent are right. The timeline dots still use three fills with no stated meaning. |
| Consistency | 9 | One audit tag style, a compact footer, one track. |
| Density | 8 | The concept mocks are long on mobile. |
| Copy | 9 | "Cojam is back on Kaia. Swap your old CT for new CT, one for one: 10% arrives at once, the rest 7 days later." |
| Mobile | 9 | The first screen shows the H1, the CTA and the track card. Nothing overflows at 360. |
| Finish | 8 | Measured load shift at 1440: CLS 0.128, because the JS injected header pushes `main` down 100 px after first paint. Tilt and lift on non interactive concept cards. |
| **Total** | **86** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 3 | The hero gives the date range, not "open now, N days left". |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 4 | |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 3 | |
| Aesthetic, minimal | 3 | The concept section is long on a phone. |
| Error recovery | 3 | |
| Help | 4 | FAQ and inline help that stays on screen. |
| **Total** | **35** | |

Mobile 9. Interaction 7:

- Good: FAQ rows open smoothly with a lift, primaries ripple, sections reveal once.
- Gimmicky: the concept mocks tilt and lift on hover and shrink on press, yet nothing in them can be pressed. A card that moves under the finger promises an action that does not exist.

### Top 5 fixes

1. **Stop the header popping in after first paint.**
   - Where: `site/index.html` and every page, `<div id="cj-top">` plus `shell.js` at the end of `body`.
   - Problem: Chromium paints `main` at top 0, then shell.js inserts the banner and header, and `main` jumps 100 px. Measured CLS at 1440: landing 0.13, migrate 0.48, docs 0.37, status 0.95.
   - Change: load `system.js`, `i18n/shell.js` and `shell.js` synchronously right after `<div id="cj-top"></div>` (before `<main>`), or write the static header markup into each HTML file and let shell.js only fill text.
2. **Take tilt and lift off cards that do nothing.**
   - Where: `site/index.html` `.mock` (`class="panel mock lift" data-tilt`).
   - Change: remove `lift` and `data-tilt`. If the section needs life, animate inside the mock once on reveal: draw the sparkline in, move the LTV bar to 40%, then select 3x. That shows what the product would do instead of implying a click.
3. **Live window line in the hero card.**
   - Where: `site/assets/pages/landing.js` `#hero-window`.
   - Change: before launch, "Opens Dec 1, 2026, in 19 days". After launch, reuse `win.open` from `i18n/migrate.js`, so landing, swap and status say the same thing.
4. **Give the timeline dots one rule.**
   - Where: `landing.css:37-39`.
   - Change: make past and fixed events ink, future events hollow, and the recurring "On every swap" a sky ring rather than a fill. Or put a sky "Today" marker between opens and closes.
5. **Shorten the concept section on phones.**
   - Where: `landing.css` under 600 px.
   - Change: show the four mocks as a horizontal snap row (`scroll-snap-type: x mandatory`, 85% card width, dots under it), so the section is one screen tall and the FAQ is reached sooner. Label the hero track card "Example" like the history example.

---

## 2. Swap app `/migrate/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | One named primary per state, sticky on mobile within thumb reach. |
| Layout | 8 | On a phone the page head (H1, a three line lede and a two line window note) takes about 330 px above the panel on every step, the success view included. |
| Spacing | 9 | |
| Type | 9 | The `0×` glyph is gone. Tabular figures throughout. |
| Colour | 9 | Accent only on the primary. Amber and red only on warnings and errors. |
| Consistency | 8 | One state has four names: heading "Unlocked", tag "Being sent", track "Sending to your wallet", track foot "Lock ended". |
| Density | 7 | The repeated page head, as above. The released lot is shown twice in full on mobile (panel and history). The closed window message appears twice in amber (head and note). Two releasing lots read "Swapped Dec 6, 2026" twice with no way to tell them apart. |
| Copy | 8 | Honest fee copy ("Free, paid by Cojam / Fee delegation with your wallet", "About 0.016 KAIA, you have 0.001 KAIA" for MetaMask). The releasing body repeats the heading and has a loose "it": "Unlocked. Cojam is sending it to your wallet; you can also claim it now." |
| Mobile | 8 | The sticky primary, the 16 px input, keeping the field in view above the keyboard (box at 122 to 176 in a 420 px viewport) and the bottom sheet with grip, Esc, backdrop and drag all work. Two things lose a point: the success track sits under the toast, and Kaia Wallet has no tap through. |
| Finish | 8 | The history totals wrap at 1440 ("112,500 new / CT", `.mg-totals dd` 45 px tall). The toast Undo button is 32 px tall. |
| **Total** | **83** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | Wallet wait, pending with elapsed time and tx link, "Confirming on Kaia" placeholder. No lot exists in the ledger until confirmation (verified: 0 lots during pending). |
| Match with real world | 4 | |
| User control | 4 | Back, Esc, Cancel, Undo. The sheet closes by Esc, backdrop, X and drag, and returns focus to the opener. |
| Consistency | 3 | The vocabulary drift above. |
| Error prevention | 4 | `1e5` is refused with "Write the full number, without e." and the button disabled. The review gate works above 1,000,000. |
| Recognition | 4 | |
| Flexibility | 3 | Enter, Esc and `?` work, the in-app wallet connects in one tap, and MetaMask gets a deep link. Kaia Wallet in a mobile browser is copy, switch app and paste. |
| Aesthetic, minimal | 3 | The repeated head and the duplicate lots. |
| Error recovery | 3 | Every fix lands on a real answer. "Contact support" on the reserve error leads to "Official support channels are to be announced", which is a dead end for that error. |
| Help | 4 | Popovers fit on a 360 screen and close by Esc. |
| **Total** | **36** | |

Mobile 8. Interaction 8:

- Press works: scale 0.97 holds from pointerdown with a 90 ms minimum, the press shade shows, and the ripple starts from the touch point.
- Sheet slide up: 240 ms.
- View enter: 220 ms fade and rise.
- Track fill: the 10% block pops, then the ticks fill with a 50 ms stagger.
- Reduced motion: no ripple, sparks or ring, a still check, and no track arming.
- The success moment does not land on a phone.
  - On the 360x740 Android profile and on iPhone 15, the confirm view renders with the page head on screen.
  - The track (the 10% just received) sits at the bottom edge, and the "Swap confirmed. 2,000 new CT is in your wallet." toast covers it.
  - `CJ.celebrate` fires its check on top of the toast.
  - The "Done" button is at y 813 to 865 in a 740 px viewport.

### Top 5 fixes (ranked by impact)

1. **Make the success moment visible on a phone.**
   - Where: `site/assets/pages/migrate.js` `doSwap()`.
   - Change, after `render(true)`:
     - Scroll the new track to the middle of the screen: `panel.querySelector('.mg-view .track').scrollIntoView({block:'center'})`, smooth unless reduced motion.
     - Then celebrate from the 10% block, not the track centre: `CJ.celebrate(panel.querySelector('.mg-view .track-now'))`.
     - Drop the `toast.swapped` toast on this path. The heading, the lead and the live region already say it, and the toast sits exactly over the track.
   - Do the same for `doClaim()` with `toast.claimed`.
   - Make the `locked` and `claimed` actions sticky too (`stickyBar()` skips `.mg-actions-row`). Let "Done" stick and keep "Add new CT to wallet" inline above it.
2. **Give Kaia Wallet a real tap through from a mobile browser.**
   - Where: `site/assets/wallet.js` `paint()` mobile-browser branch, and `wl.*` copy in `i18n/shell.js`.
   - Problem: "Open in Kaia Wallet" (Recommended) leads to copy link, switch app, open the browser tab, paste. That is the weakest step for the founder's main audience.
   - Kaia Wallet ships WalletConnect (the App Store notes in wallet.js say v3.4.4). So make the Recommended row open the WalletConnect pairing with Kaia Wallet's registry deep link (one tap opens the app to approve). Keep copy link as the fallback line under it.
   - Verify before building: (a) Kaia Wallet's WalletConnect mobile link in the WalletConnect Explorer, and (b) that Kaia Wallet over WalletConnect signs fee delegated transactions. If (b) fails, the sheet must say WalletConnect pays KAIA.
   - Also check whether the Kaikas era app2app API (prepare a request, then open `kaikas://wallet/api?request_key=...`) still works in Kaia Wallet. If it does, it is a true one tap connect from Safari or Chrome.
   - Put the "Recommended" tag on the same line as the name: `.cj-opt-name { flex-wrap: nowrap }`, with the tag after the sub line at 360. Today it wraps and makes the first row 127 px against 76 px.
3. **Collapse the page head once a wallet is connected on mobile.**
   - Where: `site/migrate/index.html` `.mg-head`, `migrate.css`.
   - Change: under 600 px, when `L.wallet.connected`, hide `.mg-lede` and show `#mg-window` as one line ("Open until Dec 1, 2027, 352 days left"), or move it into the panel foot. This pulls every step's heading and its track about 200 px up, so the confirm view shows the track and Done on the first screen at 740.
4. **One name for a lot that has unlocked.**
   - Where: `i18n/migrate.js` `cl.title`, `cl.body.one`, `cl.body.many`, `tag.releasing`, `h.releasing`, and the `track.*` right caption and foot.
   - Change: use "Unlocked, sending now" everywhere (tag, total and track caption). Rewrite `cl.body.one` as "Your {amount} new CT unlocked on {date}. Cojam sends it to your wallet within 30 minutes, or claim it now." In the multi lot list, name lots by amount and time ("72,000 new CT, swapped Dec 6, 10:14") so two lots from one day are distinguishable.
5. **Small finish items.**
   - Done state: `.track.is-claimed` is all `--line-strong`, which reads as empty. Use `--sky-tint` fill with the check icon on the right end, so a finished lot looks complete and calm.
   - Invalid amounts: show "No amount yet" in the two split rows (or the last valid figures in `--ink-2`) instead of "0 new CT".
   - `.mg-totals` at 1440: use `grid-template-columns: repeat(2, minmax(0,1fr))` inside the 1fr history column, or `white-space: nowrap` with a 13 px figure, so "112,500 new CT" stays on one line.
   - `.toast .btn`: `min-height: 44px`.
   - Closed state: drop the amber `#mg-window` line when `note-warn er.closed` is shown.

---

## 3. Status `/status/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | 392,098,009 CT at display size, then the parts. |
| Layout | 7 | At 1440 "Old CT swapped per day" ends about 250 px above "Every swap on one track", which leaves a dead block. |
| Spacing | 8 | |
| Type | 9 | |
| Colour | 8 | Sample data and the error note are both amber and stack in the error state, so the error does not stand out. |
| Consistency | 8 | Shared seg, shared data and the track are in. Time left reads "353 days" here but "352 days" on swap and admin (`status.js:112` uses `Math.ceil`, the others `F.rel`). Recent swap amounts mix 0, 1 and 2 decimals (49,787, 4,089.6, 174,413.78). |
| Density | 8 | |
| Copy | 8 | Each figure has a one line meaning. |
| Mobile | 8 | Cards by default and no overflow. The aggregate track ticks are mostly empty outlined boxes at 393, because one day (55.5M) sets the scale. |
| Finish | 8 | Skeleton and error states are well made. Load shift at 1440 is CLS 0.95 (shell injection, plus the content grows under it). |
| **Total** | **81** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | Live stamp, "Last read at 15:52 UTC" when stale. |
| Match with real world | 4 | |
| User control | 3 | |
| Consistency | 3 | 353 against 352 days, the decimals. |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 4 | Table and Cards remembered, keyboard chart. |
| Aesthetic, minimal | 3 | |
| Error recovery | 4 | Skeleton, stale note and Retry. |
| Help | 3 | Sublines, no popovers. |
| **Total** | **35** | |

Mobile 8. Interaction 7: count up holds width (no shift) and the aggregate track rises. Recent swap cards (`.st-card.lift`) lift and shrink on press but are not links. Either make each card open its transaction on Kaiascan (the whole card a link, which is a real action) or drop `lift`.

### Top 5 fixes

1. **One days left function.** `site/assets/pages/status.js:112` `Math.ceil((C.windowEnd - m.now) / DAY)` should call the same helper as `migrate.js` `paintWindow` and `admin.js`. Move a `CJ.daysLeft()` into `system.js` and use it on all three pages.
2. **Fix the dead block under the daily chart.** In `status.css`, at 1024 px and up, either span the aggregate track panel full width under the chart (track left, "Unlocking next" list right) or put the "Unlocking next" list in its own row. Both columns should end level.
3. **Make the aggregate track readable.** In `CJ.trackAggregate` (`system.js` around line 400), give every tick a 4 px minimum fill and print the CT figure under each tick at 1024 px and up. Label the ends "Unlocks in 7 days" (left) and "Unlocks today" (right), and list "Unlocking next" in the same left to right order, so the track and the list read the same way.
4. **Separate the error from the sample note.** In the error state, render "Could not reach Kaia" as `note-error` (or put it in the header row next to the live stamp, replacing it) and keep the sample note neutral (`note-info`). Two amber blocks of equal weight hide the one that matters.
5. **One amount format in recent activity.** In `status.js` recent rows and cards, use whole CT for amounts of 1,000 and above and two decimals below, the same rule as the figures. Or use admin's fixed two decimals everywhere.

---

## 4. Docs `/docs/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 8 | Special cases are still heading plus paragraph. |
| Layout | 9 | The TOC starts beside the H1 with a comfortable measure. |
| Spacing | 8 | |
| Type | 9 | |
| Colour | 9 | |
| Consistency | 9 | One audit tag, anchors match the app. |
| Density | 8 | |
| Copy | 8 | Step 2 says approval "is its own transaction and costs a little gas" (`docs.step2.b`). With Kaia Wallet it costs nothing, and the Fees section and the app say so. A holder reading the steps gets the wrong idea. |
| Mobile | 8 | |
| Finish | 8 | Load shift 0.37 at 1440 (shell). |
| **Total** | **84** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 3 | The step 2 gas line contradicts Fees. |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 3 | |
| Aesthetic, minimal | 4 | |
| Error recovery | 4 | Every app fix link lands on its answer. "Get KAIA for MetaMask" is practical. |
| Help | 3 | Contact is "to be announced", so the page cannot yet say where to get help. |
| **Total** | **36** | |

Mobile 8. Interaction 7.

### Top 5 fixes

1. **Correct step 2.** In `site/assets/i18n/docs.js`, change `docs.step2.b` to "The first time, your wallet asks you to let the swap contract move the old CT you chose. It is its own transaction: free with Kaia Wallet, a small KAIA fee with MetaMask." Update KO and JA the same way.
2. **Make special cases scannable.** Render `#special` as a bordered list. Each case gets a 16 px semibold title row with an icon (exchange, pool, multisig, lost key, small balance) and the answer under it. Collapse each case on mobile with `details.smooth`.
3. **Add a "Which wallet should I use?" block above Step by step.** On mobile, show the three paths (in Kaia Wallet's browser, MetaMask deep link, WalletConnect) with the same names as the connect sheet, so the docs match what the sheet offers.
4. **Contact: say what to do now.** Until channels exist, link the safety section and say "Check announcements on the official site only". This also gives the app's reserve error fix something real to land on.
5. **Lock rules track: label it "Example".** It shows 12,500 and 11,250 without saying they are an example. The history panel uses an "Example" tag for the same thing.

---

## 5. Admin `/admin/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 8 | |
| Layout | 7 | The content container (1280) is wider than the shared header (1120). The H1 starts at x 112 while the logo is at x 192. |
| Spacing | 8 | |
| Type | 9 | Two decimal right aligned amounts. |
| Colour | 8 | Amber marks overdue releases, low runway and the 24 hour unlock, which is right. |
| Consistency | 8 | Same data as status. |
| Density | 7 | About 8,800 px on mobile, request cards about 195 px each. |
| Copy | 8 | |
| Mobile | 7 | It works, but it is long. |
| Finish | 8 | |
| **Total** | **78** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | Overdue and runway tiles under `?keeper=late&gas=low`. |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 3 | |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 4 | `/` focuses search, export names its count. |
| Aesthetic, minimal | 3 | |
| Error recovery | 3 | |
| Help | 3 | |
| **Total** | **35** | |

Mobile 7. Interaction 7.

### Top 5 fixes

1. **Align with the header.** In `site/assets/pages/admin.css`, either give the header the same width on this page (`body[data-page="admin"] .cj-header .container, .cj-footer .container { max-width: 1280px }`) or drop the admin content back to `--container` and let the table scroll inside its panel. Left edges must match.
2. **Mobile request rows at about 72 px.** Under 600 px, show wallet, amount and status on one line and "6 d 23 h left" on a second, with the tx and copy icons behind a row tap that opens the existing wallet sheet. That shortens the page by about 1,200 px.
3. **Put the alert tiles first on mobile.** With `?keeper=late` the "Releases overdue" tile is the eighth tile. Order the tiles by urgency: overdue, runway, unlocking in 24 hours, then the totals.
4. **Collapse the KPI grid on mobile.** Show the four totals as a 2x2 grid of compact tiles (label and figure only, sublines in a `details`) instead of eight full width rows.
5. **Explain the sheet's per wallet limit.** The gas wallet panel should show the per wallet fee limit and how many wallets hit it today. That is the cause of the app's sponsor error, and ops need to see it.

---

## Site wide issues

1. **The shell is injected after first paint.** On desktop Chromium the page paints without banner and header, then everything drops 100 px.
   - Load CLS: landing 0.13, migrate 0.48, docs 0.37, status 0.95.
   - This is invisible in captures but felt on every slow phone load as a jump.
   - Fix: run `shell.js` synchronously before `<main>`, or ship static header markup.
2. **Success and claim toasts cover the content they announce on phones.** The toast is fixed at `bottom: 24px` and sits over the track.
   - Fix: no toast on view changes that already carry a heading and a live region (swap confirmed, claimed, connected), and `min-height: 44px` on `.toast .btn` (Undo is 32 px today).
3. **Days left differ by one between status (353) and swap or admin (352).** Use one `CJ.daysLeft()`.
4. **Lift and tilt sit on things that are not actions:**
   - landing concept mocks (`.mock.lift[data-tilt]`)
   - status recent cards (`.st-card.lift`)

   Keep press and lift for real targets (buttons, FAQ rows, links, history lots with a claim), and make cards links when there is a natural target (tx on Kaiascan).
5. **Unlocked state vocabulary drifts** across heading, tag, totals and track (see swap fix 4). Define it once in `i18n/shell.js` (`tag.*`) and reuse it.
6. **Kaia Wallet from a mobile browser** is still copy and paste (see swap fix 2). MetaMask deep link (`https://link.metamask.io/dapp/<host><path>`) and WalletConnect are present, and the in-app Kaia and MetaMask browsers connect in one tap.

## Project rules check

| Rule | Result |
| --- | --- |
| One accent only for primary action and current selection | Pass (audit at 360 and 1440). |
| One primary per view | Pass. The landing has hero and closing "Swap CT", a page apart. |
| Units on figures | Pass. |
| No dash as a sentence break, no tracked capitals, no eyebrows, no middle dot | Pass (grep of i18n and CSS, captures). |
| No card inside a card | Pass, with the dashed "Example" box in the history panel as an inset group. |
| 44 px targets | Pass in the audit. Fail in use: toast Undo is 57x32. |
| 4.5:1 text | Pass. |
| Visible focus | Pass, including the language select through `.cj-lang:focus-within` and the sheet options. |
| No horizontal scroll at 360 | Pass on every page and state, popovers included. |
| Reduced motion | Pass: no ripple, sparks, ring or tilt, a still check, no track arming, the view enter at 0.01 ms. |
| Never a lot before the mock chain confirms | Pass: 0 lots in the ledger during pending, and history shows "Confirming on Kaia". |
| Concept previews labelled not live | Pass: each mock has "Concept preview, not live" and the section lede says every number is an example. |
| Sample data labelled | Pass on status and admin. The landing hero track and the docs lock rules track are unlabelled examples. |
| Honest wallet and fee copy (MetaMask pays KAIA) | Pass in the app: sheet sub lines, fee row, no-gas error, help popovers. Fail in docs step 2 ("costs a little gas" with no wallet named). |

## What works and must be kept

- The mobile swap path: the one tap connect in a wallet's browser, a sticky named primary within thumb reach, the 16 px input with `inputmode="decimal"` and `enterkeyhint="go"`, and the field kept above the keyboard while the sticky bar steps aside.
- The connect sheet: bottom sheet with grip, drag to close, Esc, backdrop tap, X and focus return; the environment aware options; the honest sub lines ("No KAIA needed: Cojam pays the network fee", "Pays a small KAIA fee for each step"); the MetaMask dapp deep link; and "Cojam never asks for your seed phrase" in the sheet.
- The press system: scale and shade from pointerdown, held 90 ms so quick taps still show, a ripple from the touch point on primaries only, transform and opacity only, and a full reduced motion fallback.
- The swap track as the one signature: the 10% pop and day fill, now also aggregated on status.
- The state machine and its recovery: rejected, sponsor busy with "Pay the fee myself", no gas with "Switch to Kaia Wallet", partial approval resume, closed window with claims still working, RPC retry with skeleton.
- The amount parser and its messages.
- Status loading and stale states, and the shared sample data with admin.
- Help popovers anchored to the panel on phones.
- Docs anchors that every app fix link lands on.
- Token discipline and a clean audit at 360 and 1440.

## Korean spot check (`?lang=ko`)

- Landing, swap ready and locked at 393 read naturally. Particles and endings are complete, e.g. "기존 CT를 신규 CT로 교환" and "교환 완료".
- No missing keys. No overflow.
- The header wallet button is 44 px tall in KO ("지갑 연결", 102 px wide) and JA.
- One nit: "12,500 신규 CT(10%)" needs a space before the parenthesis, as in EN.
