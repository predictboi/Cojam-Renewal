# Motion: Concept A, Daily Paper

The motion language is the print shop: sheets of paper, ink, stamps, type being set, a press running. No confetti, no glow, no bounce for its own sake.

## Rules of the system

- **Properties.** `transform` and `opacity` only, plus `clip-path` for one ink wipe. One accordion (the results clipping) animates `grid-template-rows`, because a height has no transform equivalent. Never `transition: all`.
- **Curves** (tokens in `tokens.css`):

| Token | Value | Job |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Everything that arrives: the next sheet, rows setting, letters, figures, the page turn |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheets and the ticker strip |
| `--ease-thunk` | `cubic-bezier(0.34, 1.56, 0.64, 1)` (ease out back) | A stamp landing, a sheet flicking back onto the stack |
| `--ease` | `cubic-bezier(0.3, 0, 0.2, 1)` | Colour and press feedback |
| linear | | Time being used up (the fuse), the press running |

- **Durations.** Press feedback 100 ms. UI moves 140 to 320 ms. The deck 420 to 440 ms because it is a gesture, not a menu. The only long piece is the reward (about 2.2 s, once a day, skippable).
- **Interruption.** Gestures are driven by the finger and retarget at any time; rapid things (toasts, press states, the figure roll while typing) are transitions or a retargeting roll, never restarting keyframes. Nothing blocks input: the page turn is 180 ms on the content only, and a pick is taken at the tap, before its animation.
- **Frequency gate.** Things done many times a day get nothing or almost nothing (arrow keys on the deck play the same 130 ms stamp and throw as a tap, never more). The delight budget is spent on the reward, once a day.
- **Calm money screens.** Staking, wallet and convert get a figure roll, the sheet, one stamp on success and the date stamp tick. Nothing plays on an error or a failed transaction.
- **Reduced motion.** `prefers-reduced-motion: reduce` switches off every animation and shortens every transition to nothing. States still change at once. The fuse keeps running because it is the time left. The deck cross fades instead of throwing. Details per moment below.
- **Layers.** The halftone picture, the colour wash, the stamps and the lift shadow each have their own compositor layer (`will-change`), so the three halftone filters run once per picture and never during a drag.

## 1. Swipe and pick

| Moment | Purpose | Trigger | Motion | Duration and curve | Reduced motion |
| --- | --- | --- | --- | --- | --- |
| Lift | Feedback: the sheet is in your hand | Drag locks horizontally (after 10 px) | The card scales to 1.012; a flat shadow of ink (16% opacity) appears 5 px right and 9 px below and follows the card | Shadow fades in 160 ms `--ease-out`; position follows the finger | No scale, no shadow |
| Rotation | Spatial: paper turns about the hand | During the drag | Up to 7 degrees with the travel. Held by the upper part the sheet leans with the drag; held by the lower 40% it leans the other way | Follows the finger | No rotation |
| Proof stamp | State: this is what a release would pick, not yet | Drag under the threshold (35% of the width) | The answer appears as an unfilled, dashed stamp (ink on the sheet, readable at once), growing from 0.8 to 1.0 with the travel | Follows the finger | Same, without scale |
| Stamp pressed | State and feedback: a release now picks | Drag crosses the threshold | The stamp fills with the answer's ink, comes down from 1.36 to 1.05 and recoils to 1.12; a 2 px ring of ink spreads to 1.24 and fades; the card gets a 20% wash; the answer button turns hot; 5 ms haptic tick | Press 210 ms `--ease-out`; ink ring 380 ms `--ease-out` | Fill and wash change at once |
| Thunk and throw | Feedback: the pick is made | Release past the threshold, a fling, a tap or an arrow key | The stamp hits once more (1.3 to 0.98 to 1.06). On a swipe the sheet leaves at once with the speed of the release, turned 18 degrees. On a tap or a key the sheet rises 3 px for 130 ms while the stamp lands, then is thrown. 12 ms haptic | Thunk 160 ms `--ease-out`; throw 190 to 380 ms from the release speed, `cubic-bezier(0.3, 0.55, 0.4, 1)` | The card fades out in 200 ms |
| Next sheet | Spatial: the next page comes off the stack | Any pick | The card below rises 7 px and grows from 0.972 to 1; the third takes its place | 420 ms `--ease-out` | Instant |
| Flick back | Feedback: nothing was picked | Release under the threshold | The sheet returns with a small overshoot | 440 ms `--ease-thunk` | Instant |
| Boxes ink in | State: which of the five are in | A pick is saved; also when a page with finished boxes opens | A box fills with ink from the bottom; its number turns to paper at 45% of the way; boxes follow each other 70 ms apart | 300 ms `--ease-out` | Instant |
| Undo: pulled back | Spatial: the same sheet returns from where it went | Tap Undo, or Z or Backspace | The thrown sheet comes in low from the side it left, turned 11 degrees, and settles on the stack with the same overshoot; the sheet that had risen goes back under it | 440 ms `--ease-thunk` | Instant |
| Fuse | State: how long Undo is open | A pick | A 3 px printer's rule along the bottom of the pick bar is used up from the right; when it is gone the pick goes to press. The same rule runs inside each Undo button of the list view and under "Finishing in 3" | 3000 ms linear | Keeps running: it is information |

## 2. The fifth pick and day done: the extra edition

Purpose: delight, once a day, earned by finishing. About 2.2 seconds from the page opening. A tap or a key anywhere skips to the settled page (the tap still does what it was aimed at). It plays once; a reload shows the settled page.

| Time | What | Motion | Duration and curve |
| --- | --- | --- | --- |
| 0 ms | The press runs | Under the dateline the band is an ink frame with vertical bars running to the left, while the status says "Saving your last pick". The dateline still reads "Closes in" | 420 ms loop, linear |
| 80 ms | The headline is set | "All 5 done" drops in letter by letter from above (0.55 em, 1.12 scale), 30 ms apart | 240 ms each, `--ease-out` |
| 900 ms | Paid (the mock save ends) | The band inks in from the left and reads "Extra" with the issue ("Day 5, week 48"); the press stops | `clip-path` 280 ms `--ease-out` |
| 980 ms | The figure prints | "+100P" appears in the blue spot ink and its three figures roll like reels, each through a few digits, stopping one after the other | 520, 670 and 820 ms, `--ease-out` |
| 900 ms | The fifth box, the points | The fifth box inks in; the points in the masthead count up from 1,250P to 1,350P; a haptic pattern | 300 ms and 400 ms |
| 1660 ms | The stamp | A "Paid" stamp lands on the right of the figure at minus 9 degrees, from 1.6 to 1, with a ring of ink | 240 ms `--ease-thunk`, ring 420 ms |
| 1660 ms | The dateline | The live cell turns from "Closes in" to "Next set in": the words drop in from above | 220 ms `--ease-out` |
| 2400 ms | Settled | Nothing moves. The layout is exactly the settled done page | |

Reduced motion: the band, the figure, the stamp and the dateline change state at once when the points are paid; no letters, reels or landing.

## 3. Results

| Moment | Purpose | Trigger | Motion | Duration and curve | Reduced motion |
| --- | --- | --- | --- | --- | --- |
| Stamps land | State: these answers are set | The list first appears (and "Show earlier days") | Each HIT, MISS and Corrected stamp lands from 1.6 to 1 with a ring of ink, 70 ms apart in list order (capped at the tenth). Each stamp has its own small angle from a fixed table by its place in the list, so it is the same on every visit | 230 ms `--ease-thunk` | Stamps are simply there |
| Going to press | State: this answer is not set yet | Always, on waiting rows | A 18 x 10 px frame with bars moving slowly to the left, beside "Waiting, 09:00" (it replaces the clock icon and is labelled "Going to press" for screen readers) | 1100 ms loop, linear | Bars stand still |
| Totals count up | Feedback: what each day paid | The list first appears | The day totals of the first two days count from 0 | 520 ms, ease out (quartic) | Final value at once |
| Clipping | Preventing a jarring change | Tap a row with a set answer | The detail unfolds under the row below a dashed cut line; closes the same way | 240 ms `--ease-out` on `grid-template-rows` | Opens at once |

## 4. Ranking

| Moment | Purpose | Trigger | Motion | Duration and curve | Reduced motion |
| --- | --- | --- | --- | --- | --- |
| The table sets like type | Spatial: a table being composed, top first | The screen opens, and after a page turn | Rows drop in from 10 px above, 34 ms apart | 240 ms `--ease-out` | Instant |
| Prizes roll | Feedback | With the rows | The prizes of ranks 1 to 3 count up from 0.00 (ten rolling figures would be noise, so the rest stand still) | 560 ms, 90 ms apart | Final value at once |
| Ticker strip | Spatial: your own line arrives under the table | 240 ms after the screen opens, and after a page turn | The pinned own bar slides up from behind the tab bar | 320 ms `--ease-drawer` | Instant |
| Page turn | Spatial: this week and last week are two pages | Tap the segmented control | The old table leaves 18 px towards its side while fading (120 ms), the new one comes in from the other side (200 ms) and sets again. The control switches at once and a second tap during the turn wins | `--ease-out` | Content swaps at once |

## 5. Staking and wallet

| Moment | Purpose | Trigger | Motion | Duration and curve | Reduced motion |
| --- | --- | --- | --- | --- | --- |
| Figure roll | Preventing a jarring change | The amount or the lock period changes; convert amount changes | The interest figure (and "You get") rolls from its current value to the new one. A new keystroke retargets from where the figure is | 260 ms, ease out (quartic) | Final value at once |
| Proof sheet | Spatial: a sheet laid on the desk | Review, deposit, withdraw, any sheet | The sheet rises from the bottom edge under its heavy rule; the scrim fades | 320 ms `--ease-drawer` | Appears at once |
| Stamp on success | Feedback: it is done | A transaction succeeds | A "Done" stamp lands beside the amount, from 1.6 to 1 with a ring of ink, 210 ms after the sheet changes | 230 ms `--ease-thunk` | Stamp is simply there |
| Date stamp tick | State: time is passing | Every countdown, each second | Only the digit that changed is replaced; it drops into place from 40% above | 150 ms `--ease-out` | Digit changes at once |
| Errors and failures | | | Nothing plays | | |

## 6. Navigation and chrome

| Moment | Purpose | Trigger | Motion | Duration and curve | Reduced motion |
| --- | --- | --- | --- | --- | --- |
| Page turn between sections | Spatial: which way you went | A screen opens | The content (not the masthead, not the tab bar) comes in 16 px from the right when the new tab is further right or the screen is a sub page, from the left when going back, and only fades when the section is the same. Input is live from the first frame | 180 ms `--ease-out` | None |
| Current tab | State | A screen opens | The 4 px ink bar over the current tab grows from its centre | 180 ms `--ease-out` | None |
| Pressed | Feedback | Pointer down on any control | Framed controls go down 1 px; rows, segments and chips darken to the second paper tone; links thicken their underline and darken; the primary button darkens | 100 ms `--ease` | Colour only |
| Dateline | State | Each second | The date stamp tick above | 150 ms | Digit changes at once |
| Toast | Feedback | A message | A slip of paper (sheet colour, ink frame, heavy top rule) is pushed up from under the section index, turned 1.5 degrees, and settles; it leaves the same way | In 240 ms, out 200 ms, `--ease-out`, as transitions | Appears and disappears in place |

## 7. First visit nudge

Purpose: explanation, once ever. 700 ms after the very first card appears, the sheet leans right and then left (34 px, 2.6 degrees, 1500 ms). Each lean shows the answer of that side as a proof stamp at full strength and lights that answer button. The stamp steps in and out, so it is never half visible: the earlier version showed it at 40% opacity, which failed the contrast check. Any touch or key stops it. Never under reduced motion, never again after the first time.

## Verification

- `node tools/flow-test.js`: touch swipe, Undo, tap, arrow key, five picks, "Finish now", the extra edition and the settled page.
- `node tools/motion-run.js video|stills|perf`: the five recorded flows, the stills, and the frame intervals of a scripted drag. `node tools/motion-trace.js`: paint and raster cost of the same drag. Numbers are in `REVIEW.md`.
- `sh tools/audit-all.sh`: the repository audit on every screen.
