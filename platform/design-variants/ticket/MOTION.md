# Ticket: motion

Rules for all of it: transform and opacity only, every moment can be interrupted, and under `prefers-reduced-motion: reduce` nothing travels (durations collapse to near zero, the deck cross fades) while information keeps running (the Undo drain, countdowns). Curves are tokens in `tokens.css`: `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer` `cubic-bezier(0.32, 0.72, 0, 1)`, `--ease-snap` `cubic-bezier(0.34, 1.4, 0.64, 1)` (one soft overshoot, used only where paper snaps or a stamp lands).

| Moment | Purpose | Trigger | Duration and easing | Reduced motion |
| --- | --- | --- | --- | --- |
| Drag the ticket | Feedback: the ticket is in your hand | Pointer drag on the front ticket, locked to horizontal after 10 px | Follows the finger 1:1, `translate(dx, 0.05 dx)` and up to 8 degrees, body and stub pivot on the centre of the perforation | Same (direct manipulation) |
| The snap (armed) | State: this release will pick, and which answer | Drag passes 35% of the width | The stub lets go and returns to rest in 180 ms `--ease-snap`, filled with the answer ink and label; 5 ms vibration. Dragging back under 35% re-joins it | Stub changes ink at once |
| Spring back | Feedback: nothing was picked | Release under the threshold without a fling | 380 ms `--ease-snap`, body and stub together | Instant |
| Commit: tear and drop | Spatial: the answer goes into your tray | Release past 35%, a fling (96 px at 0.5 px/ms or 56 px at 1.1 px/ms), a tap on a choice, or an arrow key | Body leaves on its side in 420 ms `--ease-out`; after 150 ms the stub travels to its tray slot and shrinks to fit in 340 ms `--ease-in-out`, then lands with a 240 ms `--ease-snap` settle. The next ticket rises to the front in 420 ms `--ease-out` | Cross fade, the tray slot fills at once |
| Undo | Spatial: the same ticket comes back | Undo button, Z or Backspace, within 3 s | Stub lifts back from the tray in 320 ms `--ease-in-out`, body returns in 400 ms `--ease-out`, then a strip of tape presses on over the tear in 320 ms `--ease-snap`. Can be pressed while the stub is still dropping | Ticket and tape appear at once |
| Undo drain | Information: time left to undo | A pick | The yellow bar under Undo empties in 3 s linear (`scaleX`) | Keeps running |
| First time nudge | Explanation: the ticket moves both ways | First ticket of a fresh day, once | 1.5 s `--ease-in-out`, 26 px right then left | Never plays |
| Finishing panel | State: the day is about to close | Fifth pick | Rises 8 px and fades in 260 ms `--ease-out`; the numeral counts 3, 2, 1 | Appears at once |
| **Reward: print and stamp** | Delight, once a day | "Finish now" or the end of the fifth Undo window | About 2.2 s in all, skippable by any tap or key. The strip feeds up out of the printer bar one segment at a time (6 steps of 190 ms: move for 95 ms on `--ease-out`, rest for 95 ms), a 260 ms jolt as it stops, +100P is stamped at 1.30 s (300 ms `--ease-snap`, from 2.1x and -16 degrees), the strip jolts again under the stamp, the points pill bumps (420 ms) while its digits roll to the new total (900 ms), then the actions rise in with a 60 ms stagger | Strip, stamp and total shown at once; the digits still change |
| Results reveal | State: which tickets were checked | Results opens | Punch marks land one by one, 300 ms `--ease-snap` from 1.9x, 55 ms stagger | All marks shown |
| Ranking reveal | Preventing a jump on a long board | Ranking opens | Places rise 8 px and fade in, 380 ms `--ease-out`, 45 ms stagger from first place; the pool figure rolls | Shown at once |
| Figure roll | State: a number changed | Points paid, the pool on open | Each digit is a column moved by `translateY`, 900 ms `--ease-out`, 40 ms stagger | Digits swap |
| Staking interest | Information | Every second on My stakes | Text update, no motion | Every 10 s |
| Certificate meter | State: days served | My stakes opens | `scaleX` from 0 in 700 ms `--ease-out` | Final width |
| Sheet | Spatial: a slip slides over the counter | Review, deposit, withdraw, how answers are set | Up in 380 ms `--ease-drawer`, scrim fades 260 ms; leaves the way it came | Fades |
| Tab change | Spatial: where you are | A tab opens | The punched hole on the top edge of the tab bar slides to the new tab in 420 ms `--ease-in-out`; page content settles in 320 ms with a 40 ms stagger | Hole is in place, no settle |
| Press | Feedback | Pointer down on buttons, answers, options, rows, tabs | Scale 0.97 (0.96 on answers, 0.9 on tab icons) in 120 ms `--ease-out`, held at least 90 ms so a fast tap is seen | Colour change only |
| Toast | Feedback | Copy, save, a finished transaction | 260 ms `--ease-out` up 16 px, leaves the same way after 2.6 s (a transition, so repeats retarget) | Fades |

Recordings (KO, 390 x 844) are in `captures/video/`: `swipe-undo-ko.mp4`, `five-picks-reward-ko.mp4`, `results-ranking-reveal-ko.mp4`, with stills `still-mid-swipe-ko.png` and `still-reward-1-ko.png` to `still-reward-5-ko.png`. Regenerate with `node tools/motion-run.js`.
