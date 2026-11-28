# Pixel concept: review log

Method: build, capture every screen with Playwright, look at each capture at full size, score against ten criteria, fix, capture again. Two full rounds plus an interface guidelines pass. Scores are my own and deliberately strict; an independent reviewer has not seen this yet.

## Audit (tools/design/audit.js, AUDIT_ACCENT #124CC4, mobile profile)

| Run | Screens and states | Overflow | Contrast under 4.5:1 | Targets under 44 px | Mono misuse | Page errors |
| --- | --- | --- | --- | --- | --- | --- |
| 390 x 844, EN | 54 | 0 | 0 | 0 | 0 | 0 |
| 390 x 844, KO | 54 | 0 | 0 | 0 | 0 | 0 |
| 390 x 844, JA | 54 | 0 | 0 | 0 | 0 | 0 |
| 360 x 780, EN and KO (home, finishing, done, ranking, staking, wallet) | 12 | 0 | 0 | 0 | 0 | 0 |

Also checked by script: the swipe (a drag past 35% of the card commits, a 60 px drag springs back), Undo inside 3 seconds returns the card and the count, five picks open the finishing panel and then `done.html`, arrow keys and Z work, no label wraps on any button, answer key, segment or tab at 360 and 390 in EN, KO and JA, and under `prefers-reduced-motion` the deck cross fades, the confetti is removed and the Undo fuse still runs.

## Round 1: what was wrong and what changed

| Finding | Fix |
| --- | --- |
| Frames and dither ignored local colours (the tokens were resolved once at the root), so cells on the band had no outline and the band edge was the wrong colour | Frame, dither and dotted rule tokens are declared on every element and read the local `--line` and `--dc` |
| "Today's picks" wrapped to two lines beside the Cards / List switch | The switch became two icon keys with spoken labels; the ranking's week switch moved out of the band into the body |
| The question title in the regular cut looked spindly next to the chunky keys | Question titles use the bold cut at 24 px |
| Section heads and row titles in Galmuri14 were too light to carry hierarchy | Section heads are 24 px bold; row titles, values and disclosure labels get the bitmap double print |
| The card did not fit 360 x 780: the settle line was cut off | The question number and category chips sit on the picture, the pick bar and band tighten under 800 px of height, and the picture grows on tall screens instead of leaving a hole |
| The markets picture (axis and tiny candles) read as noise | Redrawn as three large candles on a dotted chart ground |
| Answer pills on the day done list collapsed to one letter | Removed the percentage width that collapsed inside the grid |
| "Convert points" was truncated in the sub page header | Sub pages drop the coin from the score, and the P unit under 375 px |
| Audit: Terms and Privacy links 15 px tall; the invite link flagged as mono words | Links are 44 px tall; the invite link uses the reading face (only addresses are mono) |
| The second place name on the podium truncated twice at 360 px | Podium names use the 12 px bold cut |
| The sheet opened with a focus ring on its close button | Focus goes to the sheet itself; Tab is still trapped inside |

## Round 2: what was wrong and what changed

| Finding | Fix |
| --- | --- |
| Japanese bold was made by printing every glyph twice, which hollowed large digits such as "+100P" | Latin, digits and kana use the drawn bold again; only kanji fall through to a second family name and are thickened by the browser |
| Jam's raised arms read as detached horns | The cheer frame keeps the body and adds two sparks and happy eyes; the cheer is carried by the frame swap |
| Buttons felt lighter than the answer keys, so I tried 24 px bold labels | Rejected after measuring: 16 labels wrapped at 360 and 390 px (even Deposit / Withdraw). Buttons stay at 15 px with the double print; the weight difference between an answer key and a command button is now deliberate |
| The "On the way" and "Waiting" chips were dithered and hard to read | Solid pale blue chips; dither stays for cells, marks, loading and disabled states |
| Values in list rows ("1,500 CT", "2.4") were thinner than their labels | Double print on row values |
| Dead space in the middle of first run steps 2 and 3 | The illustration band is taller; still the weakest composition (see below) |
| Guidelines pass | Hover states for fine pointers, `touch-action`, `overscroll-behavior` on the sheet, balanced headings, scroll margin for anchors, `translate="no"` on the wordmark |

## Scores after round 2 (each out of 10)

| Criterion | Score | Why not higher |
| --- | --- | --- |
| Hierarchy | 8.5 | Every tab root has one figure in the band and one primary action; results is dense and its day headings compete a little with the totals |
| Typography | 8 | One pixel family across three languages at whole multiples only, Pretendard for sentences. Japanese bold mixes drawn and synthesised weights; Galmuri14 bold is a double print, not a drawn cut |
| Colour discipline | 9 | Sixteen inks, each with one job; yellow means score or current selection everywhere. Ember and mint have nearly equal lightness, so they lean on position, words and arrows |
| Spacing rhythm | 8 | Everything is a multiple of 4. Frames need a 4 px margin, so a framed block and a plain row do not share exactly the same left text edge (20 px against 16 px) |
| Component consistency | 8.5 | One frame, one key, one chip, one segment, one row rule. Notes use a clipped fill while lists use a frame: two container looks where one might do |
| Brand character | 9 | Recognisable from any crop: HUD, dither edge, cartridge card, high score table, Jam. Nobody would mistake it for a template |
| Affordance | 8.5 | Keys stand proud and drop; disabled is dithered and flat with the reason beside it. The card under the front card is a blank plate, not the next question, so the deck hints less than it could |
| Motion | 8 | Throw, rise, stamp, wash, fuse, coin and confetti all step in frames and stop for reduced motion. Judged from code, scripted runs and stills only: it has not been felt on a real phone, and the six frame throw may want eight |
| Density | 8 | Home and day done fit 360 x 780 without scrolling; staking needs a scroll to reach the lock warning before the pinned button |
| Polish | 8 | Pixel edges are crisp at 2x and 3x. Remaining: sprite detail (weather and culture are plain), first run steps 2 and 3, hover on desktop is minimal |
| **Mean** | **8.35** | |

## What I would still improve

1. Draw the next question under the front card so the deck shows real depth during a drag, and test throw timing on a phone.
2. Give each of the five questions its own picture (today Bitcoin and KAIA share the coin), and add two more frames to Jam's cheer.
3. Commission or draw a true bold cut of the 15 px face, and a bold kanji subset, so no weight is synthesised.
4. First run steps 2 and 3: fill the lower half with a small playable demo instead of leaving the paper empty.
5. Deposit and Withdraw are sheets here, with the key facts only; the full screens of the current design (QR code, address validation errors) are not redrawn in this variation, nor are the Gate and the system screens.
6. Self host the three Galmuri files that are used (about 1.2 MB as shipped by the CDN) as subsets before any production use.
