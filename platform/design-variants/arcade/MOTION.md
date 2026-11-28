# Motion: Pocket Arcade

Motion is how the toy feels in the hand. Things are slapped, pressed, popped and dropped; nothing fades in slowly and nothing loops for decoration.

Rules for every moment:

- Only `transform` and `opacity` are animated (the only other property that changes is `visibility`, at once, to take a hidden sticker out of the page). No layout property, no shadow and no colour is animated.
- Everything is interruptible: the drag follows the finger with no transition, a second tap wins over a running transition, the reward can be skipped by a tap or a key, sheets can be dragged while they rise.
- One overshoot curve gives the toy feel: `--ease-pop` `cubic-bezier(0.34, 1.56, 0.64, 1)`. Entrances use `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`, sheets `--ease-drawer` `cubic-bezier(0.32, 0.72, 0, 1)`.
- Reduced motion (`prefers-reduced-motion: reduce`): every keyframe animation is off and transitions are instant, so each state simply appears. The spinner and the Undo fuse keep running because they are information. JavaScript reads the same setting (`App.reduce`): no card tilt, no throw path, figures jump to their value, waits are shortened.
- Animations pause while the tab is hidden.

Durations and curves are tokens in `tokens.css`; keyframes are in `components.css`; the drag and the throw are in `assets/app.js` (`App.deck`).

## The moments

| # | Moment | Purpose | Trigger | Duration | Easing | Reduced motion |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Press** on any key (buttons, answers, Undo, segments, periods) | The key is a real, thick thing | Pointer down; held for at least 90 ms so a quick tap is still seen | 90 ms down and up | `--ease-out` | No travel; the state change alone |
| 2 | **Card drag** | The card is in your hand | Horizontal drag past 10 px on the front card | Follows the finger, no transition | Linear to the finger; the card tilts up to 11 degrees about the hand (the other way when held by its lower part) and lifts 2%, a flat shadow shape follows under it | The card moves without tilt or lift |
| 3 | **Sticker grows, then is slapped on** | Shows which answer a release would make, and exactly when it commits | Drag travel: the sticker of that side grows from 55% to 85% and turns towards its angle; at 35% of the card width it snaps to full size | Follows the finger; the slap is 220 ms | `--ease-pop` (scale 1.35 to 1) | The sticker appears at full size at the threshold |
| 4 | **Throw (commit)** | The pick is made and the card is gone | Release past 35% of the width, a fling, a tap on an answer key, or an arrow key | 190 to 380 ms from the release speed; a tap or key first holds the card 170 ms while the sticker comes down (scale 1.5 to 1, 260 ms) | Throw `cubic-bezier(0.3, 0.55, 0.4, 1)`, fade `--ease-in`; the card leaves turning 24 degrees | A 200 ms fade, no path |
| 5 | **Deck advances** | The next card is ready | A card leaves the stack | 420 ms | `--ease-pop`: the card behind straightens from its 2.6 degree lean and settles with one overshoot | Instant |
| 6 | **Flick back** | The pick was not made | Release under the threshold | 460 ms | `--ease-pop` | Instant |
| 7 | **Sticker on the sheet** | The day is filling up | A pick is taken: its slot in the five slot sheet gets a sticker (dashed while it can be undone, solid when saved) | 300 ms, scale 2.2 to 1 with a turn | `--ease-pop` | The slot changes at once |
| 8 | **Undo key and fuse** | Three seconds to take it back, visible as a bar that runs out | A pick is held | Key pops in over 260 ms; the fuse runs 3000 ms and is already part used if the bar is redrawn | Key `--ease-pop`; fuse linear (`scaleX`) | The key appears at once; the fuse still runs |
| 9 | **Undo** | The card comes back to your hand | Tap Undo or press Z | 460 ms: the card flies in low from the side it left, still turned 11 degrees, and lands on the stack; the card that had advanced drops back behind it | `--ease-pop` | The card is simply back |
| 10 | **First run nudge** | Teaches the swipe once | 700 ms after the first ever home screen, never again, cancelled by any touch or key | 1500 ms: the card leans right, then left, and shows each sticker in turn | `cubic-bezier(0.45, 0, 0.25, 1)` | Never plays |
| 11 | **All five wait** | The day is about to be sent | The fifth pick leaves the deck | Jam and the text rise 320 ms; the fuse runs the rest of the 3 seconds; "Finish now" skips it | `--ease-pop` | Appears at once |
| 12 | **The reward: the capsule** | The +100P for all five is the best moment of the day | Arriving on Day done after the fifth pick (`done.html?state=moment`) | About 2.2 s in total, see the beat list below | See below | The settled page appears within 300 ms; points and stickers are simply there |
| 13 | **Points count up** in the header | The points landed in your balance | The pay beat of the reward; any credit | 400 ms, the chip pops 240 ms | Quartic ease out; `--ease-pop` | The figure jumps |
| 14 | **Results: stickers land** | Each answer is given, one after the other | Opening Results | 300 ms each, 70 ms apart, at most 10 steps; each sticker keeps its own fixed angle | `--ease-pop` (scale 1.8 to 1 with a 14 degree turn) | Stickers are in place |
| 15 | **Results: a row opens** | Detail on demand | Tap a row | 220 ms rise of the detail block | `--ease-out` | Opens at once |
| 16 | **Ranking: the podium** | First, second and third are a ceremony | Opening Ranking or switching the week | Blocks rise from the floor 520 ms each (third at 0 ms, second at 90 ms, first at 220 ms); avatars and names drop onto them 420 ms (from 380, 480 and 620 ms); the three prizes roll up over 620 ms; rows 4 to 10 follow 300 ms each, 35 ms apart; the own rank bar pops up from the dock at 500 ms | `--ease-pop` for blocks, avatars and the bar; `--ease-out` for rows | Everything is in place; figures show their value |
| 17 | **Ranking: week switch** | This week and last week are two pages | Tap the segment | 120 ms out, 200 ms in, 18 px sideways; a second tap during the turn wins | `--ease-out` | Swaps at once |
| 18 | **Figure rolls** (staking interest, convert result, rates) | The number answers your typing | Typing an amount, choosing a period | 260 to 400 ms; a new value retargets from where the figure is, it never restarts from zero | Quartic ease out | The figure jumps |
| 19 | **Countdown tick** | Time is live | Each second | 180 ms on the digit that changed only | `--ease-pop` | Digits change without a move |
| 20 | **Bottom sheet** | A decision comes up from the bottom of the toy | Deposit, withdraw, review, how answers are set | 340 ms up; the scrim fades 240 ms; the grip drags the sheet and lets go to close past 80 px | `--ease-drawer` | Appears at once |
| 21 | **Transaction success** | The money moved | A mock transaction finishes | The "Done" sticker lands 300 ms after the sheet is up | `--ease-pop` | In place |
| 22 | **Toast** | A short notice | Copy, save, errors | 280 ms pop from 14 px below at 94% size; 160 ms fade out | `--ease-pop` | Appears and goes at once |
| 23 | **Tab and page change** | You moved inside the toy | A tab, a sub page, back | 220 ms on the content only (never the header or the dock): 16 px from the side you are going to; the same section again only fades 180 ms. Input is live from the first frame | `--ease-out` | No move |
| 24 | **Current tab key** | Where you are | Page load | None: the blue key simply stands 6 px higher than the tray | n/a | Same |

## The reward, beat by beat

All times are from the page load of `done.html?state=moment`. A tap or any key at any time jumps to the settled page (`settle()` finishes every running animation), and the tap still reaches whatever was under the finger.

| Time | Beat |
| --- | --- |
| 0 to 520 ms | A closed capsule (blue lid, cream cup) drops in from above, turned 14 degrees, and lands with one overshoot. The headline already reads "All 5 done"; the status says the last pick is being saved; the fifth slot of the sticker sheet is still dashed |
| 520 to 850 ms | The capsule rocks 4 degrees each way: it is saving |
| 850 ms | Paid. The capsule squashes (112% wide, 84% high) and springs back over 420 ms |
| 850 to 1470 ms | The lid flies up and comes to rest above the cup (620 ms). Jam jumps out of the cup with arms up (520 ms, bigger overshoot). Eight small flat bits in the four colours burst outwards and are gone by 1670 ms |
| 1150 to 1570 ms | The "+100P" coin sticker is slapped on from double size with a turn. The headline pops once. The points in the header count up from the old balance |
| 1370 to 1730 ms | The fifth sticker lands on the sheet |
| 1490 to 1810 ms | The "Paid" sticker lands under the coin. The live chip turns from "Closes in" to "Next set in" |
| 2250 ms | Settled: the page is exactly the Day done screen and nothing moves |

A device that supports it gives a short double buzz at the pay beat. The moment plays once per day: a reload shows the settled screen.

## Performance notes

- The dragged card and the stickers have `will-change: transform`; the card art is inline SVG with no filter, blend or mask, so the card is one cheap layer.
- Depth is drawn with a pseudo element under each key that is moved with `transform`, so a press does not repaint a shadow.
- The fuse is a `scaleX` on one element; the podium blocks are `translateY` inside a clipping box; the capsule is five elements moved with `transform`.
- `tools/motion-run.js perf` drives a two second drag from `requestAnimationFrame` at CPU throttle 1x and 4x and writes the frame intervals to `captures/video/perf-drag.json`.
