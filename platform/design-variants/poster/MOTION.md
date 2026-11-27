# Motion: Poster

Motion is paper. Sheets slide in from the side they belong to, stop dead and lock; nothing bounces, glows or fades for mood. Everything animates `transform` and `opacity` only. Entrances and exits use `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; the bottom sheet uses `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`; countdown bars are linear. Gesture driven motion is set per frame from the pointer, and anything a player can fire twice is a transition or a cancellable Web Animation, so it retargets instead of restarting.

Reduced motion (`prefers-reduced-motion: reduce`): durations and delays drop to near zero in CSS, and the script switches the throw to a cross fade and never plays the reward moment. Countdowns (Undo bar, finishing numeral) keep running because they are information.

| Moment | Purpose | Trigger | Duration and easing | Reduced motion |
| --- | --- | --- | --- | --- |
| Card follows the finger | Feedback | Horizontal drag on the front poster (locks after 10 px; a vertical drag goes to the page) | Per frame: `translate(dx, dy * 0.18)` and up to 8 degrees of rotation, no easing | Same (it is direct manipulation) |
| Answer sheet hint | State indication: which answer this drag would give | Any drag below 35% of the card width | The red or blue sheet slides in from the trailing edge and covers up to 42% of the poster, showing only its triangle; 150 ms ease-out smoothing | Sheet position is set without transition |
| Answer sheet commit | Feedback: the pick is now armed | Drag passes 35% | The sheet snaps across the whole poster in 150 ms ease-out and the answer word is set; the matching answer button grows to 1.03; 5 ms vibration | Instant |
| Throw | Spatial consistency: the sheet leaves on the side of the answer | Release past the threshold, a fling (96 px at 0.5 px/ms or 56 px at 1.1 px/ms), a tap on an answer, an arrow key | 240 ms from a drag, 380 ms from a tap, ease-out, to 135% of the width with 14 degrees | 200 ms opacity fade |
| Next poster comes forward | Preventing a jarring change | Any commit | 420 ms ease-out: the poster behind moves from `translateY(-8px) scale(0.955)` to rest; the third moves up one place | Instant |
| Spring back | Feedback: nothing was picked | Release below the threshold | 420 ms ease-out back to rest; the sheet slides back out in 150 ms | Instant |
| Progress tile fills | State indication | Any commit | The tile's colour sheet slides in from the answer's side, 260 ms ease-out | Instant |
| Undo | Spatial consistency: the same sheet comes back from where it went | Undo button, Z or Backspace within 3 s | 360 ms ease-out from 120% of the width; the tile sheet slides back out | Instant |
| Undo countdown | Information | A pick is held | Yellow bar on the Undo button, `scaleX` 1 to 0 over 3 s, linear | Kept |
| Finishing numeral | Information and a breath before the reward | Fifth pick | Giant 3, 2, 1: each numeral drops in 8% and fades up in 260 ms ease-out; the panel itself enters in 260 ms | Numerals change without motion |
| Reward moment | Delight (once a day) | Day done opens after the fifth pick (`done.html?moment=1`) | 2.2 s in total, tap or any key skips to the end state. 150 to 1050 ms: the five tiles slide in, 520 ms ease-out each, 95 ms apart, red tiles from the left and blue tiles from the right, each numeral rising inside its tile. 1060 ms: the grid locks (scale 1.012 to 1 in 200 ms) and four registration marks snap in (160 ms). 1180 ms: the yellow sheet slides up from under the grid (520 ms). 1320 ms: the figure rises and counts 0 to 100 (620 ms, quartic ease-out). 1900 ms: the status line. 2050 ms: the rest of the page, 60 ms apart | Not played: the composition is shown complete |
| Results reveal | Preventing a jarring change, and a small stamp on a hit | Results opens | Rows rise 10 px and fade, 380 ms ease-out, 45 ms apart; Hit chips scale from 0.9, 320 ms, after their row | Instant |
| Ranking reveal | Explanation: the bars are a chart, so they draw | Ranking opens | Rank numerals rise 60% inside their own box (460 ms), bars grow with `scaleX` from the left (620 ms), names follow (360 ms); 55 ms between ranks | Instant |
| Figure roll | Feedback: this number is live | A hero figure first shows (wallet CT, points, pool, staked), or the convert result changes | 700 ms (320 ms on convert), quartic ease-out, from 60% of the value (from the last value on convert), tabular numerals so nothing shifts | Value set at once |
| Stake progress bar | Explanation | My stakes opens | `scaleX` from 0, 700 ms ease-out, 200 ms delay | Instant |
| Bottom sheet | Spatial consistency | Review, deposit, withdraw, log out | Up: 420 ms on the drawer curve, backdrop to 55% in 260 ms. Down: the same path back | Instant |
| Tab change | Spatial consistency | A tab is opened | The new screen slides 18 px from the side of the tab pressed and fades in, 260 ms ease-out | Instant |
| Toast | Feedback | Copy, save, a finished action | Rises 16 px and fades in 260 ms ease-out, leaves the same way | Instant |
| Press | Feedback | Pointer down on a button, answer, segment, option, tab | Scale 0.97 (tab label 0.92) in 120 ms ease-out, held at least 90 ms so a quick tap is seen | No scale |
| Loading | State indication | Loading states | Skeleton blocks pulse opacity 1 to 0.45, 1.2 s alternate | Static blocks |

## Notes for build

- The deck uses Pointer Events with capture; the throw and the Undo return are Web Animations so an Undo during a throw cancels it cleanly.
- The reward moment is CSS only (delays on one class, `.is-play`), so it stays smooth while the page loads; removing the class is the skip.
- Hover effects are gated behind `(hover: hover) and (pointer: fine)`.
- Not verified on a physical mid range phone: checked in Chromium with touch emulation and in the recorded videos only.
