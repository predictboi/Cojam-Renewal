# Matchday motion

Motion speaks broadcast: slanted wipes, flip digits, banners that slide in on the cut. Everything animates `transform` and `opacity` only, is driven by CSS or the Web Animations API on the compositor, and can be interrupted by the next input. Under `prefers-reduced-motion: reduce` every duration collapses to an instant state change, the page wipe and the reward overlay are not shown, and live figures still update as plain text.

Easing tokens: `--e-out` `cubic-bezier(.2,.8,.2,1)` for arrivals, `--e-in` `cubic-bezier(.5,0,.9,.3)` for exits, `--e-snap` `cubic-bezier(.3,1.4,.5,1)` for the one overshoot (the whistle and the W and L marks).

| Moment | Purpose | Trigger | Duration and easing | Reduced motion |
| --- | --- | --- | --- | --- |
| Drag the fixture | Show which side is winning the pick before it is made | Finger moves more than 8 px sideways on the front card | The card follows the finger 1:1 with 0.04 deg of tilt per px; the chosen side's kit wipes in from its own edge, tied to the drag distance, with the answer in large type | Same, it is direct manipulation |
| Spring back | Cancel without penalty | Release under 88 px and without a fling | 260 ms, `--e-out`, card and wipe return together | Instant |
| Commit a pick | The chosen kit takes the whole card, then the card leaves towards its side | Release past 88 px, a fling, a tap on a side, or an arrow key | Wipe covers the card in 145 to 230 ms `--e-out`; the card flies out in 240 ms (swipe) or 380 ms (tap or key, with a 35% hold so the wipe is seen) `--e-in`; the next fixtures step forward in 260 ms `--e-out` | Instant swap |
| Undo bar | Offer three seconds, and show them passing | After each pick | Bar rises 10 px in 260 ms `--e-out`; the yellow line drains by `scaleX` over 3 s, linear | Bar appears, the line does not drain |
| Undo | The card comes back from where it left | Tap Undo | From its current flight position to rest in 320 ms `--e-out`; the stack steps back | Instant |
| Fifth pick panel | Mark the end of the match card and give the last Undo | After the fifth pick | Panel wipes in from the left (18 px, 4 deg skew) in 420 ms `--e-out`; a flip digit counts 3, 2, 1 | Appears, digit changes without the flip |
| Full time (reward) | The one celebration of the day, in the concept's own language | Arriving on day done after the fifth pick | 2.25 s plus a 340 ms exit: blue and yellow sweeps cross the screen (0 to 610 ms), "Full time" slams in with one overshoot (260 to 560 ms), the score board rises (520 to 800 ms), the two flip digits count up to your left and right picks (from 760 ms, 150 ms a step), the +100P banner slides in on the cut (1340 to 1640 ms), points roll up (1500 to 2000 ms), then the whole overlay leaves to the left and the settled screen rises. Any tap, key or the Skip button jumps to the end | Not shown: the settled screen appears with the final values |
| Flip digit | Make a changing figure feel like a board | A digit changes (countdowns, final score) | 240 ms `rotateX` from 90 deg, `--e-out` | Text changes in place |
| Figure roll | Tie a new total to the action that caused it | Points after the reward and after a convert, pool and week points on arrival | 500 to 800 ms, cubic ease out, tabular numerals so nothing shifts | Final value at once |
| Results reveal | Read the table as results coming in | Arriving on Results, changing the filter | Blocks rise 10 px, 45 ms apart, 420 ms `--e-out`; W and L marks flip in 320 ms `--e-snap`, 70 ms apart | All visible at once |
| Ranking reveal | Read the table from the top, then find yourself | Arriving on Ranking | Rows slide 14 px from the left, 38 ms apart, 260 ms `--e-out`; the blue promotion edge of each prize row grows downward after its row; your row arrives last in order | All visible at once |
| Ticker | Rotate secondary live figures without a marquee | Every 3.6 s on Home | Old line rolls up and out, new line rolls up and in, 420 ms `--e-out` | First line only, no rotation |
| Tab change | A broadcast cut between sections | Tap another tab | The active marker scales in (260 ms `--e-out`); a dark slanted panel sweeps off the new screen in 300 ms `--e-in` | No sweep |
| Sheet | Bring a task forward | Deposit, withdraw, stake review, info | Up in 420 ms `--e-out`, down in 260 ms `--e-in`; backdrop fades to 55% in 260 ms; Escape and backdrop close it | Instant |
| Press | Confirm a touch | Pointer down on a button, a side, a tab | Scale to 0.975 (buttons), 0.985 (sides), 90 ms ease out | Instant colour change only |
| Progress bars | Show how far a stake has run | Arriving on My stakes | `scaleX` from 0 in 600 ms `--e-out` | Final length at once |
| Loading | Say that content is on its way | State `loading` | Blocks pulse between 100% and 55% opacity, 1.2 s | Still blocks |

Performance notes: the dragged card and its two wipes are the only promoted layers during a swipe (`will-change: transform`); clip paths are static and never animated; no animation touches layout properties; timers for the Undo window and the reward are cancelled when the user acts first.
