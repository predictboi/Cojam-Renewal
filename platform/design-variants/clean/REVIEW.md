# Concept D "Clean": review log

Two full critique and fix rounds after the first build, each against the same ten criteria, followed by a check against the Web Interface Guidelines. Scores are my own and deliberately strict; an independent reviewer has not scored this variant yet.

## How it was checked

- `node tools/design/audit.js <url> 390 844 --mobile` on 60 screen and state URLs per language, in Korean, English and Japanese. Final result in all three languages: 60 of 60 with 0 px overflow, 0 contrast failures and 0 targets under 44 px.
- Captures with Playwright at 390 x 844 (EN, KO, and JA for the main screens) and 360 x 780 (home, done, ranking), 153 files in `captures/`. The capture script also reports a page error or a home screen that scrolls: none in the final run.
- Looked at full size: home (fresh, armed, finishing), day done, ranking, staking, my stakes, wallet, results, login in Korean, plus a live mid drag frame. The remaining screens and the English, Japanese and 360 px versions were looked at side by side at 390 px per screen (contact sheets), which is enough to judge layout and wrapping but not single pixels.
- Behaviour, scripted in Chromium: a drag past 35% arms the card and the right answer button, release commits and shows Undo; Undo restores the card and the pick; a 60 px drag springs back without a pick; arrow keys and both buttons pick; the fifth pick shows the finish ring and opens the done screen after 3 seconds; `+100P` counts to 100 and the points pill follows to 1,350; the list view reaches "Finish now"; staking recalculates (1,200 CT for 90 days gives 13% and 38.4658 CT) and the review sheet runs to "Staked 1,200 CT"; the deck also works under reduced motion.

## Round 1: what the first build got wrong and what changed

| Finding | Fix |
| --- | --- |
| Korean question broke inside a word ("달 / 러") | `word-break: keep-all` for Korean, `word-break: auto-phrase` and strict line breaking for Japanese |
| Points pill read "1,250 P" with a gap | Removed the flex gap so the unit sits on the figure |
| Home scrolled by 1 px | The screen reader live region sat below the page; pinned to the top |
| While dragging, the next card was a blank, smaller blue shape with a 50 px step at the top | The next card now rises to 97% with its question readable during a drag, so the swipe shows what comes next |
| The finish panel repeated the headline ("That is all five" twice) and left an empty band where the answers were | Panel keeps only the ring, the status and "Finish now"; the answer row is removed so the panel takes the space |
| My stakes: "Interest so far" broke into three lines (a CSS rule for labels caught the ticking figure) | Scoped the label rule to direct children |
| Results: a grey note block for the invite bonus under every day made the list heavy and repetitive | The bonus is now a quiet last row of the day with its points on the right |
| Ranking: the column label carried a middle dot ("Player · points") | Label is "Player"; points already sit under each name |
| Segmented tabs sat 8 px above the headline on ranking and staking | A headline after a section gets 20 px of air |
| View switch looked heavier than the countdown beside it | Track tightened to 2 px padding, 96 px wide, 44 px targets kept |
| Audit: hidden text of the back cards and the hidden Undo bar counted as contrast failures, their buttons as small targets | Hidden content is now `visibility: hidden` as well, which also takes it out of the tab order and the accessibility tree |

## Round 2: what still looked generic or wrong and what changed

| Finding | Fix |
| --- | --- |
| Login facts were three icon tiles in a row, the stock "feature list" look | Plain ticks with one line each; no tiles |
| Results: a waiting row said "Waiting for answer" and "Waiting, 09:00" | One line with the time, and "+50P if hit" under it |
| Sheet showed a blue focus outline around the whole sheet when opened | Programmatic focus on the sheet has no ring; controls inside keep theirs |
| Invite code sheet: the Apply button dropped below the field | Inline action keeps its place inside sheets |
| Convert, 7 day wait: the sentence showed a raw `{date}` | The date is passed in |
| Withdraw: a long address is cut by the field, so a valid address could not be read in full | The valid message echoes the whole address in two grouped lines |
| Withdraw review: the 24 px checkbox was the only target under 44 px | The whole row is the target, with a drawn 24 px box |
| The concept said "one blue object per screen" but the done screen has the tick, the figure and the button | Rule reworded to what the build does: solid blue only on the reason of the screen and its one primary action |
| Guidelines check | `touch-action: manipulation` on controls, `overscroll-behavior: contain` on sheets, size attributes on the QR mark, `spellcheck` off on email and codes, `translate="no"` on the brand name and addresses |

## Scores after round 2 (each out of 10)

| Criterion | Score | Why not higher |
| --- | --- | --- |
| Hierarchy | 8.5 | Sentence, figure, block, action reads in that order on every screen. On home the headline (26 px) and the question (26 px) are the same size; colour separates them, size does not |
| Typography | 8 | One family, six steps, tabular figures, native wrapping in KO and JA. The 14 px caption carries a lot of secondary copy on staking and invite |
| Colour discipline | 8.5 | Blue, ink, one grey, two answer colours, red for errors only. The wallet shows two pale blue buttons and one solid blue button close together |
| Spacing rhythm | 8 | 4 px base, 20 px gutters, 20 or 32 px between sections. Login and the sub pages leave a tall empty band above the pinned button at 844 px |
| Component consistency | 8.5 | One block, one row, one segmented control, four button looks, one sheet. The list view answers are outlined while the card view answers are tinted |
| Brand character | 7 | The blue card, the answer colour takeover and the spoken headlines are its own; the supporting screens (wallet, profile) would still pass for a well made fintech app of another brand if the mark were removed |
| Affordance | 8 | Full width buttons, arrows on both answers, chevrons only on rows that navigate, reasons next to switched off controls. Pale answer buttons at rest are quieter than solid ones would be |
| Motion | 7.5 | Every motion has a purpose and a reduced variant, and the flows were verified by script. The feel of the springs and the count ups has not been judged on a real phone |
| Density | 8 | Home fits 390 x 844 and 360 x 780 without scrolling; results and ranking are long but scannable |
| Polish | 7.5 | Clean at capture size in three languages. Question pictures are simple, and the monospace address face differs per platform |

Average: 7.95.

## What I would still improve

1. Brand character on the quiet screens: one owned detail that repeats outside home, for example the ring of the Cojam mark as the progress and countdown shape everywhere (it already is on Undo, finish and the tick) taken into staking progress and the ranking countdown.
2. The question pictures: five flat drawings are enough for a prototype, but the real set needs an illustration rule a non designer can follow for a new question every day, and a no picture fallback.
3. Feel on a device: tune the throw, the snap back overshoot and the 700 ms count up on a real phone, and add the first time nudge of the current design (the card leaning once each way).
4. Home headline against the card: try the headline one step smaller (22 px) once the card is on screen, so the question is the only 26 px line.
5. Empty band on short forms: on login, convert and withdraw the space between the content and the pinned button could carry the fact that reassures (fee, limit) instead of white.
6. States not rebuilt in this variant (the current design has about 200): gate and install, the slow and failed save banners on home, other device, the transaction failure and slow paths, deposit and withdraw error cases, profile invite code states, maintenance, update and not found.
7. Form `name` attributes and placeholders are prototype grade; production needs the full form pass.
