# Review: Concept A, Daily Paper

Self review by the designer who built it (no independent reviewer was run for this variant). Method: capture every screen with Playwright, run `tools/design/audit.js` on every screen, look at every capture at full size, score, fix, capture again. Two full rounds, plus a first build pass, then a focused motion round (last section; the motion spec is `MOTION.md`).

## How it was checked

- **Captures:** `node tools/capture-all.js` writes `captures/<screen>-<lang>-<width>.png`: every screen at 390 x 844 in EN and KO, home, home partial, done and ranking also at 360 x 780, and home, done, ranking and results in JA at 390. Device scale 2, touch on, fonts loaded, motion settled.
- **Audit:** `sh tools/audit-all.sh <lang> <width> <height>` runs the repository audit on 31 URLs (screens and their main states). Run in EN, KO and JA at 390 x 844 and in EN at 360 x 780.
- **Flow:** `node tools/flow-test.js` plays the day on the card view: a touch swipe right, Undo (the card comes back and the count returns to 0), a swipe left, a tap, an arrow key, two more swipes, "Finish now", and the day done screen with the reward (points go from 1,250P to 1,350P). It passes.
- **Guidelines:** the pinned Web Interface Guidelines (`web-design-guidelines`) were walked against `components.css`, `assets/app.js` and the screens.

## Audit result, last round

| Check | Result |
| --- | --- |
| Horizontal overflow | 0 on every screen, at 390 and at 360 |
| Text contrast under 4.5:1 | 0 on every screen, including the first visit nudge on home (fixed in the motion round: the hint is now a full strength proof stamp, ink on the sheet, that steps in and out) |
| Touch targets under 44 px | 0 |
| Accent use | Every blue fill, text and border listed by the audit is one of the four jobs: primary action, text link, reward (the "+100P" figure, HIT stamp and mark, the success figure in a sheet), the player's own row |
| Monospace | Flagged only on full addresses (hex groups that contain letters), the invite code and the invite link. These are the three places the data face is meant for |

## Scores, last round (each out of 10)

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 9 | One thing leads each screen: the question on home, "+100P" on done, the pool and the leader on ranking, the CT balance on wallet, the interest on staking. Three clear levels: slab figure or headline, bold text, grey text |
| Typography | 9 | Besley for headlines and figures, Pretendard for everything operated or read in rows; Hahmlet and Noto Serif JP keep the same sturdy voice in Korean and Japanese while numerals stay Besley. Sizes far apart (12 to 16 for text, 21, 26, 32, 44, 56, 88 for display). Weak spot: Noto Serif JP is a mincho, lighter in colour than the slab |
| Colour discipline | 9 | Paper, ink, one blue with four jobs, two answer inks, three status colours used only for status. Home at rest has no blue except the mark |
| Spacing rhythm | 8 | 16 px gutter, 20 px between blocks, 16 px above a section rule, 12 px inside. The home screen fits 390 x 844 and 360 x 780 without scrolling. Convert and first run leave a quiet middle on tall phones |
| Component consistency | 8 | One masthead, one dateline, one tab bar, three button looks, one segmented pattern, one row pattern for both ranking lists, one notice between rules, one hold notice, one sheet. The list view "Pick" buttons are heavier than the rest of that screen |
| Brand character | 9 | Recognisable from any crop: thick and thin rule, dateline with the issue, slab figures, halftone pictures, stamps, numbered boxes. No screen falls back to a generic app look, including wallet and profile |
| Affordance | 8 | Everything pressable has a frame or an underline; the two answers are the only coloured blocks on home; a control that is off says why beside it. The question meta line (source and settle time) is a button whose only cue is the small info icon |
| Motion | 9 (was 7) | After the motion round: the sheet lifts, turns about the hand and is thrown; the answer stamp is a proof, presses in with a recoil and an ink ring, and comes down on the pick; Undo pulls the sheet back; the fuse is a printer's rule; day done is an extra edition; stamps land in results; the ranking sets like type; sections turn like pages. Transform, opacity and clip-path only, everything interruptible, reduced motion handled. Not a 10 because nothing has been felt on a real phone yet |
| Density | 8 | Ranking shows the pool and six ranks above the own bar at 390 x 844 (five at 360 x 780); results shows the summary, the filter and four rows; wallet shows both balances and Convert on the first screen |
| Polish | 8 | Rules align to the 16 px gutter, figures share baselines in the three figure rows, ticking digits do not shake, long names truncate, KO and JA wrap by phrase. Remaining roughness is listed below |
| **Total** | **85 / 100** (83 before the motion round) | |

## Round 1: what was found and fixed

- **Numerals.** With `tabular-nums` on the body, Besley switched to a different, hairline zero ("1,25**0**P", "1**0**°C"). Fixed: tabular figures only in the text face; the slab keeps its own figures, and ticking slab figures get equal width digit cells.
- **Deck order.** The last card of the set was on top. Fixed with explicit stacking per position; the two sheets under the card now show at the bottom edge like a stack of papers.
- **Halftone.** The first pass printed the blue picture ground as white paper with outlines only. Rebuilt as a real screen (blur, multiply with a dot gradient, hard contrast), then lightened so the ground prints as a mid tone and the subject stays white.
- **Overflow on staking.** The amount field and the rate table pushed the page 20 px wide (grid children without `min-width: 0`). Fixed for every grid wrapper.
- **Question meta.** Two lines plus a separate 44 px button cost too much height on the card. Now one two line button (source, settle time) that opens "How answers are set".
- **Ranking header.** "Ends in" appeared twice (pool and dateline). The dateline keeps it; the pool row now pairs the figure with "How prizes work".
- **Ranking leader.** The prize of rank 1 ran past the right gutter. Lead rows now share one prize size and the columns hold.
- **Login.** The dateline's third cell overflowed with a long sentence. It now says "Opens at 09:00 KST".
- **Audit.** The language select was 42 px tall; the chosen lock period on a blocked form was grey on ink (2.3:1); the support email was set in the data face. All fixed.

## Round 2: what was found and fixed

- **Ranking at 360.** The pool figure broke between "C" and "T" and the link wrapped. The pool figure is one size smaller and never breaks; the row wraps as a whole if it must.
- **Ranking density.** Only four ranks were visible above the own bar. The leader row went from 78 to 66 px, ranks 2 and 3 from 58 to 52, the rest to 44: six ranks at 390 x 844, five at 360 x 780.
- **Empty home.** The countdown inherited the paragraph style (15 px grey) and the block sat at the top of an empty page. The countdown is now the 44 px figure and the block sits at optical centre.
- **List thumbnails.** Tried line art (too pale) and an enlarged crop (lost the subject on two pictures); kept the full picture with a finer screen.
- **First run.** The figure panel was a fixed 232 px and left a gap on tall phones; it now takes 38% of the height, between 232 and 330 px.
- **Home title.** The card view and the list view used different title sizes; both are 26 px, so the question stays the headline.
- **Sheets.** `overscroll-behavior: contain`, explicit colours on the native select, `touch-action: manipulation` on controls, `scroll-margin-top` on the "Around you" anchor, the success figure centred over its title.

## Web Interface Guidelines: findings kept open

- Copy: the guidelines ask for Title Case on headings and buttons; the house rule (CLAUDE.md and the current design) is sentence case. House rule kept.
- Loading labels do not end with an ellipsis ("Saving", "Loading"): the shared dictionary is unchanged by design.
- The language is the player's choice and is never detected from the device: a product decision carried over.
- `user-scalable` is not restricted; zoom works.

## What I would still improve

1. **Japanese display face.** Noto Serif JP at 900 reads lighter and more formal than Besley and Hahmlet. A heavier Japanese slab or antique face (for example Kaisei Tokumin ExtraBold or Zen Antique) should be tested on real question lengths.
2. **Halftone cost.** The screen is three CSS filters on a live element. It is fine on the one front card, but on older phones the drag could drop frames. In production the server should print the halftone once per picture (the look is deterministic) and ship a 1 bit PNG.
3. **List view thumbnails** are the weakest pictures: at 56 px the screen turns to texture on two of five pictures. A dedicated square crop per question would fix it.
4. **Reward moment.** Rebuilt in the motion round as the extra edition (see below). Still missing: sound. A short press and stamp sound, off by default, would complete it.
5. **Question meta affordance.** The source and settle line is a button with only an info icon as its cue; a short underlined "How answers are set" would be clearer at the cost of one line.
6. **Results rows on a long day** are tall (60 px and more). A denser table mode for players with weeks of history would help.
7. **Screens not rebuilt in this variant:** deposit and withdraw are sheets on the wallet (not full pages with every error state), the install gate, the maintenance, update and not found system screens, and the invite code sheet on profile. The admin is out of scope.
8. **An independent review** (a second reviewer using the pages by touch and keyboard, as the handoff method asks) has not been run. The scores above are my own.

## Motion round

Asked for by the founder after choosing this concept: stronger effects and motion, inside the newspaper language. Spec: `MOTION.md` (purpose, trigger, duration, curve and the reduced motion answer for every moment). Skills used: `animate` (the gate, the property and curve rules) and `motion-design` (choreography: one lead action, causes before effects, action and rest).

### What changed

- **Swipe and pick.** The sheet scales to 1.012 and casts a flat ink shadow while held; it turns up to 7 degrees about the hand (held low, it leans the other way); the throw keeps the release speed. The answer stamp is now three states: a dashed proof under the threshold, pressed in at the threshold (fill, 1.36 to 1.05 to 1.12 recoil, a ring of ink, haptic tick), and brought down on the pick. A tap or an arrow key holds the sheet 130 ms so the stamp is seen landing before the throw. The next sheet rises in 420 ms; a release under the threshold flicks back with an overshoot; the numbered boxes ink in from the bottom, 70 ms apart.
- **Undo.** The sheet is pulled back in low from the side it left and settles with the same overshoot. The 3 seconds are a 3 px printer's rule along the bottom of the pick bar, used up from the right (also inside the list view's Undo buttons and under "Finishing in 3"). The ring is gone.
- **Day done.** An extra edition in about 2.2 seconds: the press runs while the last pick is saved, the headline is set letter by letter, the band inks in as "Extra" (호외, 号外) with the issue, "+100P" prints with three rolling reels, a "Paid" stamp lands, the fifth box inks in, the dateline turns from "Closes in" to "Next set in", the points in the masthead count up. A tap or a key skips to the settled page, which is the same layout with nothing moving. It plays once.
- **Results.** Stamps land in list order with a ring of ink, each at its own fixed angle; waiting rows carry a small "going to press" mark instead of the clock; the day totals count up; a row opens like a clipping under a dashed cut line.
- **Ranking.** Rows set from the top 34 ms apart, the prizes of the first three roll, the own bar slides up like a ticker strip, and This week and Last week turn like a page (120 ms out, 200 ms in), with the control switching at once.
- **Staking, wallet, convert.** The result figure rolls and retargets while typing; sheets rise on the drawer curve; a "Done" stamp lands on success; countdowns tick like a date stamp (only the changed digit moves). Nothing plays on errors.
- **Chrome.** A page turn of the content between sections (180 ms, direction by tab order, chrome still), the current tab's bar growing in, pressed states on every control (rows and chips darken, framed controls go down 1 px, links thicken), the browser's tap highlight switched off, the toast as a slip of paper pushed up from under the tab bar.
- **First visit nudge.** No more text at 40% opacity: each lean shows a full strength proof stamp and lights the answer button on that side.
- **Wording added** (`assets/paper-i18n.js`, three languages): "Extra", "Paid", "Going to press" (screen reader label of the mark).
- **Hub.** The language switch in the hub masthead clipped and stacked at phone widths. It now uses short labels (EN, 한, 日) in fixed 48 px cells and never shrinks; segment labels never wrap anywhere. `node tools/lang-switch-check.js` checks the language control on the hub, login, first run and profile at 360, 390 and 440 px in three languages: 36 checks, 0 failures.

### Verification of the motion round

- **Scripted runs** (`node tools/flow-test.js`, `node tools/motion-run.js all`): touch swipe, Undo, a release under the threshold, tap, arrow key, five picks, "Finish now", the extra edition, results with rows opened, ranking with two page turns, staking from typing to success, tab changes. **No page errors.**
- **Frame intervals during a drag** (a 2 second scripted drag across both thresholds, driven from `requestAnimationFrame`, device scale 2): 121 frames, average 16.67 ms, p95 16.7 to 16.8 ms, maximum 16.8 ms, 0 frames over 20 ms, at CPU throttle 1x and at 4x. One earlier run at 4x showed 4 frames at 33 ms. This measures the main thread only.
- **Paint and raster cost of the same drag** (`node tools/motion-trace.js`, Chromium trace): with the layer promotion, raster tasks took 37.7 ms in total over the 2 seconds (186 tasks); without it 90.8 ms (327 tasks). A second pair of runs gave 40.1 and 112 ms. Layout 4.5 ms in 18 events, style 41 ms, paint 25 ms. So the halftone is no longer re-rastered when a stamp arms or the wash changes: raster work during a drag fell by about 60%.
- **Honest limits of these numbers:** headless Chromium on a server rasters in software and has no real display, so absolute times do not predict a phone, and compositor frame drops are not visible to `requestAnimationFrame`. The comparison between the two variants is the meaningful part. Nothing was measured on a device.
- **Audit:** rerun on every screen after the round; the result is in the table at the top of this file.
- **Recordings:** `captures/video/` holds five flows as mp4 and webm (390 x 844, KO, and the done moment also in EN) and 18 still frames taken mid animation.

### What I would tune on a real phone

1. The throw: release speed to duration mapping (190 to 380 ms) and the 18 degree exit angle, with real thumbs at both screen edges.
2. The 130 ms hold before the throw on a tap: it must feel like a stamp, not like lag. If it reads as lag, drop it to 90 ms.
3. The overshoot of the flick back and of Undo (ease out back at 440 ms): on a high refresh screen it may want less.
4. The lift shadow: 16% ink, 5 and 9 px. On an OLED phone in sunlight it may need to be stronger or closer.
5. Haptics: the 5 ms tick at the threshold and the 12 ms hit on the pick are guesses; iOS Safari ignores `navigator.vibrate`, so the installed app needs its own haptic path.
6. The extra edition's length. 2.2 seconds is right once; if players finish daily, a shorter cut after the first week (band, figure, stamp, about 1.2 seconds) would respect them.
7. Halftone on low end Android: if the first raster of a new front card shows up as a hitch when the stack advances, ship server rendered 1 bit pictures.
8. The page turn between tabs is a cross document entrance only. With the View Transitions API (or a single page shell) the old page could leave as well.

## Production coverage round (state parity, copy reduction, two independent reviews)

This section replaces the audit table and the "Screens not rebuilt" note at the top where they differ. Independent reviews are in `reviews/review-A.md` (design 77, usability 33) and `reviews/review-B.md` (design 82, usability 31); both scored earlier states of the folder. A second independent scoring has not been run yet, so there is no new score here: my own scores above are not updated on purpose.

### What was added

- **State parity with `platform/design/index.html`:** 17 screens, 215 states, under the same `?state=` names (`STATES.md`, `assets/states.js`). New here: the install Gate (16 states), deposit and withdraw as full pages (5 and 14 states), the system screens (maintenance, update, offline, not found, account on hold), and every state that had been left out of login, first run, home (slow, reconnect, other device, closed, no image), list view, staking (full, max 20, signing, steps, slow, hidden), my stakes (claim, on hold with and without KAIA), convert (minimum, global cap), profile (name errors, the invite code within 24 hours with all code states, session, update, other device) and invite (shared).
- **Example questions** that follow the decided rule (the outcome becomes known only after the day ends at 09:00 KST): the sets of `platform/shared/src/devQuestions.ts` in EN, KO and JA. The results mock follows the same rule: today's five all wait.
- **Copy reduction** by the founder's rule (`COPY.md`: the rule, the word counts before and after, where each sentence went, the twelve sheets behind "?").
- **Japanese display face:** Shippori Antique B1, with proportional kana and tighter tracking, and phrase based line breaks.

### Review A: what was fixed

| Finding | Fix |
| --- | --- |
| Cryptic chips ("90d", "13%", "22 / 90", "≥ 10 CT", "= 1 CT", "+50P 22:10") | Labelled facts in the text face: "Lock 90 days", "13% a year", "Day 22 of 90", "Min. claim 10 CT", "1,000P = 1 CT", "+50P at 22:10" |
| "No early exit" was a small chip; rates not marked as yearly | The lock is its own line in ink and bold with the date; "Rate a year" over the options; "No fee: Cojam pays" under the action |
| Withdraw success showed neither address nor balance | Both rows added |
| A frame should mean pressable | Tags, counts, the day boxes, step numbers and icon tiles lost their frame (second paper tone instead); only controls are framed |
| Hairline zero in the prizes sheet | `tabular-nums` removed from every element set in the slab |
| Addresses in two faces, "0x" turned into "0×" | Every short address is set in the data face (`App.name`), contextual alternates off |
| Day done: the stamp overlapped "+100P" in Korean and left the gutter | The stamp has its own row under the figure, inside the gutter in every language |
| Day done: the reels showed unrelated amounts | The figure counts up from 0 to 100 and never shows anything else (checked in `flow-test.js`) |
| Day done: a 22 px layout jump when paid | The row under the figure has one height in every phase: 0 px shift, measured |
| Home after the day still said "Closes in" | "Next set in" |
| A 3.5 s wait between the fifth swipe and the reward | The day done page opens at once; the Undo of the fifth pick lives there with its fuse; a tap means "finish now" |
| Progress shown three times on home | The "0/5" figure is gone (kept for screen readers); the boxes and the card number stay |
| The answer wash tinted the other button | The two answers sit above the wash |
| List view below the card view | Thumbnails are the card's own halftone, cropped on the subject; "Pick" sits on the row's right edge; answered rows stay in ink |
| Convert, first run and login half empty | Convert: the result is an 88 px figure on a sheet band with "Points left" and three labelled facts. First run: the nameplate over the rule, a larger figure panel, a card that leans to show the gesture, page marks above the action. Login: the three facts are back |
| Results waiting rows were an icon and a time | "Answer at 21:00" with the same dashed mark as the legend and the day header, and "+50P if hit"; the clipping spans the row |
| The own row showed twice under the pinned bar | The pinned bar steps aside while the own row is on screen |
| A blank frame in the ranking page turn | The new page is in place at once and slides in; never blank |
| The language switch scrolled to the top | The scroll position is kept across the reload |
| Narrow targets ("List", "Skip", "Cards", "Terms") | 44 px wide as well as tall |
| Disabled primary was a pale blue slab | Second paper tone with a grey edge; the label says why |
| Empty staking amount showed a dash | "0 CT" in grey |
| "Updated 9s ago" on staking and wallet said nothing | Removed (shown only when a balance could not be refreshed) |
| "Day 5, week 48" twice on the done page | The band says only "Extra" |
| Success stamp and the link under it both said "Done" in Korean | The stamp says "Filed" (접수 완료, 受付済) |

Not done from review A: page 1 of first run is not yet a card the player really swipes (it shows the gesture with a leaning card); the home tab icon and the profile avatar were left as they are; the weather picture still prints lighter than the others.

### Review B: what was fixed

| Finding | Fix | Check |
| --- | --- | --- |
| B1 (blocker): the answer buttons were cut on short screens | The picture gives way first (down to nothing); if the card still does not fit, the deck grows to what the card needs and the page scrolls. Nothing in the card is clipped | `tools/small-check.js`: 6 viewports (320 x 568, 360 x 560, 360 x 640, 375 x 667, 390 x 844, 844 x 390) x 8 card states x 3 languages = 144 checks, 0 failed |
| M1: masthead, language control and tab labels left the screen at 320 px and at 130% and 200% text | The nameplate's words give way first (then only the mark), the two buttons never shrink off screen; tab labels stay on one line; figures side by side wrap to rows; the dateline wraps; addresses wrap | Same tool: 5 width and text size settings x 17 screens x 3 languages = 255 checks, 0 failed |
| M2: Undo for 3 seconds only | The rule stays (decided). Undo is the next focus stop after a keyboard or screen reader pick; the announcement is "Picked Yes. Undo, 3 seconds."; the fuse waits while Undo has keyboard focus; the list view marks a sent answer "Final" | `flow-test.js`: after an arrow key pick the focus is on Undo and the pick is still held after 3.6 s |
| M3: focus hidden under the tab bar | A focused control is scrolled clear of the bars; scroll padding on the page | `tools/focus-check.js`: 201 focus stops on 12 screens, 0 hidden |
| M4: long questions and answers | The question is never truncated (two type steps, then the picture gives room); long answers step down and wrap | In `small-check.js` (no clamp, no clipped headline) |
| M5: the disabled action gave the wrong reason | Convert says "Available Dec 1, 10:35", "Limit reached until 09:00 KST", "Converting is paused"; withdraw says "Fix the address" or "Deposit KAIA" | State check |
| M6: short flicks sprang back | 48 px at a peak of 0.6 px/ms commits; across must be 1.3 times down | `flow-test.js`: 80 px in 96 ms picks, 80 px in 400 ms and a 160 by 150 px diagonal do not |
| Minors | Full width digits are read as digits; an empty name says "Name removed. Your address is shown."; a name already on the board is refused; one announcement on the reward; the tab link reads "Home, predictions left today"; countdowns are one spoken sentence a minute; the "?" is beside the heading, not in it; closed result details are `hidden`; the summary reads label, then figure; a banner landmark on the cover screens; a back arrow on the hold page; the retry toast stays 60 s; the checkbox is 24 px; no text under 12 px; at 320 px the ranking drops its points column so names keep their room | |

Not done from review B: a static masthead and skeleton in the HTML for slow lines (the shell is still built by script), one language per file and self hosted fonts (smaller issue 23); the manifest orientation lock (the card now reflows and scrolls in landscape instead); eligibility in the ranking's own bar (it is in the "How prizes work" sheet).

### Verification of this round

| Check | Result |
| --- | --- |
| `node tools/state-check.js` (every state, EN, KO, JA: page errors, missing copy keys, overflow, empty pages) | 215 states x 3 languages = 645 pages, 0 problems |
| `sh tools/audit-all.sh en 390 844 all` (the repository audit on every state) | 215 URLs. 212 came back with 0 overflow, 0 contrast failures, 0 small targets. Two had one finding each and were fixed and audited again at 0: the number of the fifth box was grey on ink for a moment while it inked in (`done.html?state=moment`), and the required checkbox was 24 px (`withdraw.html?state=review`). One URL returns no result: `login.html?state=returning` finishes its setup and moves on to home while the audit runs (the same screen is covered by `setup` and `busy`) |
| `sh tools/audit-all.sh` on the 17 screens and the hub in KO and JA at 390 x 844, EN at 360 x 780, KO at 320 x 568 | 72 URLs, 0 overflow, 0 contrast failures, 0 small targets |
| `node tools/small-check.js` | 399 checks, 0 failed |
| `node tools/focus-check.js` | 201 focus stops, 0 hidden |
| `node tools/lang-switch-check.js` (hub, gate, login, first run, profile at 360, 390, 440 px, three languages) | 45 checks, 0 failed |
| `node tools/flow-test.js` | All steps as expected (flick rules, keyboard Undo, five picks, Undo on the done page, finish now, the figure only ever counts up to 100, 0 px layout shift, dateline "Next set in") |
| `node tools/motion-run.js all` | Five flows recorded, 19 stills, no page errors. Drag frame intervals: 121 frames, average 16.67 ms, maximum 16.8 ms at CPU 1x and 4x |
| `node tools/motion-trace.js` | Raster during a 2 s drag: 20.6 ms with layers, 62.6 ms without |

## Round 3 (reviews C and D)

Review C scored 83 / 100 and 35 / 40, review D 81 / 100 and 33 / 40. Both are in `reviews/`. Every finding is mapped below. The rules that were not to be lost stayed: far less text, a 3 second Undo and then the pick is final, labelled values, critical facts on the surface.

### Review C: finding by finding

| # | Finding | What was done |
| --- | --- | --- |
| 1 | Nameplate cut by the language select on log in and gate at 360 and 320 px | The language control on cover screens is now a globe and a two letter code (44 px, native list behind it), so "Cojam Daily" is whole at 320 px in all three languages. `system.html` and `hold.html` drop the words and keep the mark when the hold tag leaves no room |
| 2 | A unit wraps alone ("+100" then "P", "9,850" then "P") | Figure and unit are one unbreakable piece everywhere; the figure size is fluid (`clamp` with a 12 px floor) so the pair steps down instead of breaking |
| 3 | "Example" tag over the card kicker; the iOS slip covers the content it explains | "Example" sits in the kicker row of the demo card. The gate shows the install panel first and the demo below it at a fixed 400 px; the iOS steps are in the panel, and the floating Share hint shows only while those steps are out of view, so it never lies over the content it explains |
| 4 | Japanese display face thickened by the browser | At 32 px and above the real weight is used with `font-synthesis: none`, one size step larger, proportional kana and tight tracking; synthetic bold remains only up to 26 px, where it stays open. Question titles end in a Latin question mark. A licensed heavy antique is still the production answer (see "Not fixed") |
| 5 | Next card's answers show as slivers at 320 x 568; the title row breaks | Cards under the front card hide their content and show an edge only. The title row is fluid and the view switch drops under the title when it does not fit |
| 6 | First run picture band changes height and place; action below the screen | The band has one height and one place on all three steps, the art scales inside it, and the action is pinned to the foot at every size |
| 7 | Ranking and staking leave too little on short phones | Under 700 px and again under 600 px of height the title, the own bar and the paddings compact; ranking shows complete rows above the own bar at 320 x 568; on staking the interest figure moves into the pinned bar beside the action, so it is always on screen. A pinned bar taller than a quarter of the view unpins |
| 8 | Frame and pattern drift | The "27" in the own bar has no frame. Login and "Get the app" are bands of sheet colour between rules, not framed panels. The QR keeps a white quiet zone without an ink frame. One tag skin. Two switch patterns only: the segmented control switches in place, underlined words lead to another view (CONCEPT.md) |
| 9 | Closing hairline and opening rule 16 to 20 px apart | The last row of a section drops its hairline when a section rule follows |
| 10 | Text under 12 px at 320 px | 12 px is the floor of every fluid size; the tab bar grows instead of shrinking its labels |
| 11 | "Terms   and the", "Saving: Q1: Yes" | Stray gaps removed; the bar reads "Saving Q1: Yes" |
| 12 | The fifth picture is a solid black block | Redrawn as a light line drawing (`assets/img/q5-xrp.svg`). The tone limit for real pictures belongs to the server halftone job and is noted in CONCEPT.md |
| 13 | 1,350P on day done and 1,250P on results | Both read one ledger value |

### Review D: finding by finding

| # | Finding | What was done |
| --- | --- | --- |
| B1 | The "?" beside Points on the wallet cannot be tapped | The "?" has its own stacking level above the row link. `tools/state-check.js` now tests every control with `elementFromPoint` at its centre and at four inner points, so a covered or partly covered target fails the check in every state |
| B2 | "0.0000001" reaches a "Send 0 CT" review; the form stays armed | Amounts below the smallest unit and more than the allowed decimals are refused with a reason and the action stays disabled. After a withdrawal or a conversion the form is cleared, the wallet opens and the balance comes from one session ledger |
| B3 | Picture rule misfires at 375 x 667; next card shows through | The picture shows only with at least 96 px of room, otherwise it is dropped whole; the deck grows when the card needs more. Cards behind hide their content |
| M1 | The 3 second rule line is hidden on short screens | "+50P if right. Undo for 3 seconds." shows at every size. The Rules sheet says "A pick can be undone for 3 seconds. After that it is final." |
| M2 | Undo of the fifth pick moves and is easy to lose | On day done the Undo is in a pick bar pinned above the tab bar, bottom right as on the deck, and takes the focus. Only a tap on the headline area or the primary action finishes early; the list and scrolling do not |
| M3 | 200% text on home | The dateline wraps to its own row, titles break between words only, the skip link is moved off with a transform that does not depend on text size, pinned bars unpin when they pass a quarter of the view |
| M4 | A 365 day stake shows the same date at both ends | Stake dates carry the year whenever the two ends are in different years |
| M5 | Screen reader dateline contradicts the visible one | The visible countdown is `aria-hidden`; the spoken sentence is complete for its state ("Closes in 3 hours 11 minutes") |
| M6 | Unlocked stake withdrawal and convert sign with no review | Both open a short review sheet first (stake, interest and total; points, CT and points left). The convert review and its "?" sheet say "Points cannot be converted back." |
| M7 | Small finish defects | See C1, C2 and C10 |
| M8 | Address input 14 px; Skip and Back under 44 px; Undo after an Enter pick; stale live region; language names without `lang`; dark picture; real offline; fonts | The address input is 16 px. Skip and Back are 44 x 44. After a keyboard pick the focus goes to Undo. When the window closes the live region says "Final". The language options carry `lang`. The picture was redrawn. The prototype listens to the browser's `online` and `offline` events: the offline banner shows and actions disable with the reason. Font caching is a production task (see "Not fixed") |

### Not fixed, and why

| Item | Why |
| --- | --- |
| A licensed heavy Japanese antique | Needs a paid licence; the free face has one weight. The interim rule (real weight at 32 px and above) is in place |
| Halftone made by the server | The prototype draws it in CSS; production should render it once per picture with a tone limit. Described in CONCEPT.md |
| Self hosted fonts and offline caching | A build and service worker task, outside a static prototype |
| First run step 1 is a picture, not a swipeable card | The founder's rule is one action per screen; a second practice deck would add a step. Open for a decision |
| Capped chrome text at 200% (tab labels, points pill, answer buttons) | Review D accepts it as the trade off; growing them would clip the answers at 320 px |
| Shortcut list and last used address | Review D lists them as absent, not as defects; both add surface text against the founder's rule. The last used address also needs real account data |
| "Extra", "FILED", "Set" need one visit to learn | They carry the concept and each has a labelled neighbour or a "?" sheet |
| `login.html?state=returning` gives the audit no result | The state finishes its setup and moves on to home by design; `setup` and `busy` cover the same screen |

### Verification of round 3

| Check | Result |
| --- | --- |
| `node tools/state-check.js` with the new covered target test: EN at 390 x 844, KO at 320 x 568, JA at 360 x 640 | 215 states each, 645 pages, 0 problems (page errors, missing copy keys, overflow, empty pages, covered or partly covered controls) |
| `node tools/small-check.js` (320 x 568, 360 x 640, 375 x 667, text at 130% and 200%, the round 3 rules) | 621 checks, 0 failed |
| `node tools/focus-check.js` | 201 focus stops, 0 hidden |
| `node tools/lang-switch-check.js` | 45 checks, 0 failed |
| `node tools/flow-test.js` | All steps as expected: flick rules, keyboard Undo, five picks, Undo on day done 16 px from the right and 65 px above the bottom with the focus on it, a tap on the list does not finish, the figure only counts up to 100, 0 px layout shift, convert review says "Points cannot be converted back.", wallet 1,840.5 to 1,841.5 to 1,591.5 CT across convert and withdraw, "0.0000001" keeps the action disabled, the form is cleared after sending, the unlocked stake withdrawal is reviewed (Stake, Interest, Total) |
| `sh tools/audit-all.sh` (the repository audit): EN every state at 390 x 844; KO and JA base screens at 390 x 844; EN at 360 x 640; KO at 320 x 568 | 287 URLs. 282 came back with 0 overflow, 0 contrast failures, 0 small targets. Five had one cause each of two and were fixed and audited again at 0: small buttons inside a note were 43 px tall (a rule meant for text links also caught them), and the hidden iOS hint was still read at opacity 0 (it is now `visibility: hidden` when away). `login.html?state=returning` moves on to home during the audit, as before |
| `node tools/motion-run.js all` and `node tools/motion-trace.js` | Five flows recorded again, 19 stills, no page errors. Drag: 121 frames, average 16.67 ms, maximum 16.8 ms at CPU 1x and 4x. Raster during a 2 s drag: 17.6 ms with layers, 58.9 ms without |
| Captures | 168 stills in `captures/` retaken (three languages, 390 and 360 px, and 320 x 568, 360 x 640, 375 x 667 for home), 6 videos and 19 frames in `captures/video/` |

## Round 4 (review E)

Review E scored 81 / 100 and 35 / 40 (`reviews/review-E.md`, written without reading the earlier reviews). Every defect and the lower notes are mapped below.

### Review E: finding by finding

| # | Finding | What was done |
| --- | --- | --- |
| 1 | After a pick at 320 x 568 the Undo bar sits behind the tab bar | The pick bar is no longer part of the scrolling area: it is pinned directly above the tab bar at every size, as on day done. `tools/small-check.js` now picks a card at 320 x 568, 360 x 640, 375 x 667 and 390 x 844 in EN, KO and JA and requires Undo to be fully visible and to win the hit test at its centre |
| 2 | Japanese titles at 32 px and above are light and collide with heavy Besley letters and numerals | One rule: every Japanese title uses the emboldened face and none is set above 28 px (fluid 22 to 28 px), so the kana, the kanji and the Besley letters and figures in one line have one weight. Applies to page titles, log in, first run, the gate, system screens and sheets. CONCEPT.md is updated |
| 3 | A blank band of about 80 px inside the card at 375 x 667 | The picture stays as a strip down to 64 px. Under that it is dropped and the question block is centred between the kicker rule and the answers, with the headline one size up when it fits |
| 4 | The swipe hint is cut by the tab bar at 320 x 568 | The hint leaves when the view is under 600 px tall; it also lives in the pinned bar now, so the tab bar cannot cut it at any size |
| 5 | Collisions at 320 px (ranking prize line, convert rate row and title, profile JA stats) | Below 360 px these stack as rows: the link to the prize rules goes under the pool figure, the three convert facts and the three profile figures become label and value rows, a two line sub page title fits inside the masthead, and the own bar on ranking drops its second label instead of cutting the sentence |
| 6 | Korean headline breaks between "10%" and its particle | A word joiner is set between a figure (with its unit) and the Korean or Japanese character that follows it, in all text, also in text rendered later. The invite headline, "5問", "3秒間" and the like can no longer part |
| 7 | Empty and blocked states use the stock empty state; system screens differ | One notice pattern for home empty, closed, other device and hold, results empty, stakes empty, convert short and the four plain system screens: left aligned under a section rule, an ink stamp that names the state in place of the icon tile, the slab headline, one line, the action |
| 8 | Static things carry the ink frame | List thumbnails and the no image tile have no frame, the toast is an ink slip, the gate example card has a hairline, the stake progress is ink on a hairline track |
| 9 | Black hero zeros on wallet and convert | The grey plain zero of staking is used for the wallet balance, the wallet points, the convert result and the points figure of the short state |
| 10 | The error sentence is repeated inside the disabled primary button | The sentence stays under the field; the disabled action keeps its own words on convert and staking |
| 11 | The fuse merges with the tab bar rule | The fuse runs along the top edge of the pick bar, on home and on day done |
| 12 | "+50P if hit" on every waiting row | Said once, in the legend beside "Waiting" |
| 13 | List view, open row: kicker under the headline | The kicker sits above the headline, as on the card; the empty foot row is gone |
| 14 | Success sheet amounts in blue | Ink; the stamp alone is blue |
| 15 | "Prizes sent." twice on ranking | The tag is dropped; the notice with the link stays |
| Notes | Day totals black although they are rewards; "Fee: you pay" hangs under its row on wallet hold; results JA at 320 px too tight; legal links narrower than 44 px; the pick bar on day done showed only a tick; icon benefit rows on log in and gate; the proof stamp lands on the headline at 320 px | Day totals that paid are blue, a zero total is grey. The fee line sits right aligned under the KAIA value in the text face. The legend no longer pulls up into the segments below 360 px. The two legal links have targets of 50 to 134 px by 44 px with no gap in the sentence. The day done bar names the question when the pick is not in the session. The three benefit lines are plain lines between hairlines, without icons. With no picture the proof stamp lands above the headline |

### Not changed, and why

| Item | Why |
| --- | --- |
| The five day boxes have no visible label | The home screen is kept as the founder approved it; the boxes are named for screen readers and the card carries "No. 3 of 5" |
| No entry to the rules from closed list rows | The open row has it; a link on every closed row adds five repeats against the low text rule |
| Tab order starts in the deck on home | Deliberate for a game: the first key press answers. |
| Wallet sets two equal figures | CT and points are the two balances of the screen; review E lists it as an observation, not a defect |
| Gate example card answers stay coloured | They show the product; the card has a hairline and "Example" in the kicker row, and is inert |
