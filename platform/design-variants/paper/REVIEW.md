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
