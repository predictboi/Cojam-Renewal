# Night Desk: review

Self review by the designer of this variant. An independent reviewer has not scored it yet, so read the scores as a hard self assessment, not as the judge.

## Method

- Captures with Playwright (Chromium, device scale 2, touch on, fonts loaded, 900 ms settle) in `captures/`, named `<screen>-<lang>-<width>.png`: every screen and main state at 390 x 844 in EN and KO; home, home partial, home list, done and ranking at 360 x 780 in EN and KO; home, done, ranking, staking, wallet and results in JA at 390. Long screens also have a full page capture (`<screen>-full-<lang>-390.png`). The interaction captures (`home-drag-hint`, `home-drag-armed`, `home-drag-armed-left`, `home-undo`, `home-finishing`, `done-after-play`) come from a scripted touch session.
- Audit: `node tools/design/audit.js <url> <w> <h> --mobile` on 57 URLs (every screen and state in the hub) at 390 x 844 in EN, KO and JA and at 360 x 780 in EN, KO and JA. Final result on every run: **0 px overflow, 0 contrast failures, 0 targets under 44 px, 0 page errors**. `AUDIT_ACCENT` stays at `#124CC4`: the audit then lists brand blue fills, which appear only as the avatar and the player's own ranking row. The audit's "MONO misuse" list is not zero by design: it reports the mono numerals at display size, which is this concept's material.
- Interaction test (scripted touch, 390 x 844): a short drag springs back (0/5); a drag past the mark commits (1/5); Undo restores (0/5); a pick left alone is saved after 3 s; a double tap 100 ms apart answers one card only; arrow keys pick; the fifth pick shows "Finish now" and opens `done.html` by itself.
- Every capture was looked at at full size, then two full critique and fix rounds were run against the ten criteria below.

## Round 1: what I found and fixed

| Finding | Fix |
| --- | --- |
| Mono commas and points tore figures apart ("1 , 840 . 5") at display size | One rule pulls every comma and point in a figure in by the same amount; units after a space go to the text face |
| Staking overflowed the screen (a grid without a minimum of 0) | `minmax(0, 1fr)` on every single column grid |
| Table heads and gap words were set in mono | Mono only on numeral cells; words in Pretendard |
| The question picture was a grey wash on light illustrations | Printed in one ink: luminosity blend on a navy plate, 40% strength, scrim to the desk |
| Section rules doubled under cells, lists and disclosures | One rule per section, owned by the section; lists and disclosures drop theirs at the seam |
| Waiting chips with hatch behind the words were noisy four in a row | Hatch moved to a 7 px strip at the chip's left edge, the same sign as the hold notice and the "+50" on the way |
| Ranking opened on a weak row of small cells | The pool became the hero figure with the prize split bar directly under it, as one object |
| Cell labels were cut off ("Interest over 9...") and values lost their common baseline | Labels wrap; cells share a row grid (subgrid) so labels, values and sub lines align across the row |
| Result rows had a right column of changing width | Fixed right column; state chip and points always in the same place |
| Segmented controls were 42 px tall; the drag stamp failed contrast while hidden | 44 px; the stamp is `visibility: hidden` at rest |

## Round 2: what I found and fixed

| Finding | Fix |
| --- | --- |
| Units under 12 px in the header ("P" at 9.9 px) and an 11 px tab count | Units never under 12 px |
| Japanese broke "CT", "最大" and "10" across lines | No `overflow-wrap: anywhere` on the body; controls and chips keep one line |
| Home, empty state showed a pointless "0/5" cell | One cell: the countdown with when the set opens |
| "3 days 9 hours to go", the support address, the fee text and a placeholder were mono | Text face |
| First run pictures were small in a tall empty column | The picture panel takes the free height; figures enlarged; arrow centred |
| An unlocked stake still said "Unlocks Nov 26" | Shows the start date beside the "Unlocked" chip |
| The open question in the list repeated "3/5" next to "03" | Removed |
| No hover states, no `overscroll-behavior` on sheets, inputs without names (web interface guidelines pass) | Added; also `touch-action: manipulation`, picture dimensions, `translate="no"` on the brand name |

## Scores of the last round (each out of 10)

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 8 | One figure leads each screen (the card, +100P, the pool, the balance, 10%). Results and profile are long lists where the top cells carry most of the hierarchy and the rest is even. |
| Typography | 8 | Two faces with strict jobs, a fixed scale, punctuation fit in figures, aligned baselines in cells. The "%" unit at small sizes is thin, and Hangul titles at 22 px have less presence than the Latin ones. |
| Colour discipline | 9 | Amber and sky only for the two answers; blue only for "you"; red only for failure. Home at rest shows colour on the two answer buttons, the two rail marks and nothing else. |
| Spacing rhythm | 8 | 4 px grid, one gutter, one section recipe. The staking screen leaves a quiet band above the pinned action at 844 px; the card has an empty middle when a question is short. |
| Component consistency | 8 | One shell, one cell row, one row, one notice, one sheet, three button looks, hatch always means held. Rows for KAIA and for a stake's interest use two slightly different label and value patterns. |
| Brand character | 7 | The mark tile, the brand sky as the right answer and blue for "you" keep Cojam present, and the rail is its own. Wallet, staking and profile lean on structure alone and could belong to another careful dark app. |
| Affordance | 8 | Buttons look like buttons, links are underlined, the rail shows the commit point, switched off controls say why. The swipe itself has no first time teaching nudge in this variant. |
| Motion | 7 | Throw, spring back, card rise, Undo fly back, drain bars, count up, sheet rise; transform and opacity only, reduced motion handled. No motion on tab changes and none on the list view picks. |
| Density | 8 | Home fits 390 x 844 and 360 x 780 without scrolling in three languages; tables are compact with 48 px rows. Results could show more per screen with a tighter row. |
| Polish | 7 | Clean audit in three languages at two widths, states drawn (loading, empty, error, offline, hold). Not yet done: an independent review, a 430 px pass, focus order checks with a screen reader, the long tail of states the current prototype covers. |
| **Total** | **78 / 100** | |

## What I would still improve

1. **Brand presence on the quiet screens.** Wallet, staking and profile need one more Cojam owned element. Candidates: the mark's notch as the cut of the progress bars, or the brand sky used for the live "Updated 7s ago" line.
2. **Real data for the desk.** A pick split bar after each question closes and a seven day points sparkline would make results and ranking feel alive, but only once the API serves them; the mock has neither, so neither is drawn.
3. **First time teaching.** The card should lean right, then left once on a player's very first visit, with the needle moving on the rail, as the current design does.
4. **State coverage.** This variant draws 57 states; the current prototype has about 200 (transaction steps, slow saving, other device, cap and pause states, the gate). They should be ported with the same components before any build.
5. **Results density and answers.** Rows should open in place to show the answer, the evidence and the time it was set, and the day sections could collapse.
6. **An independent reviewer.** These scores are my own. The handoff method asks for a separate reviewer using the page by touch and keyboard at both sizes; that round has not happened.
