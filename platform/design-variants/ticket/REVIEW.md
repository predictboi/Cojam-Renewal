# Ticket: review

## What was checked

| Check | How | Result |
| --- | --- | --- |
| Audit | `bash tools/audit-all.sh en`, `ko`, `ja`: `tools/design/audit.js` at 390 x 844 mobile, `AUDIT_ACCENT=#124CC4`, on 43 screens and states per language | 0 px overflow, 0 contrast failures, 0 targets under 44 px on every screen and state, in all three languages |
| Audit, monospace note | same run | 2 advisory notes remain by decision: the full wallet address in the deposit sheet and the invite code `MINJI7Q` are set in the serial face (an address and a code are what that face is for). Every other mono string is digits and symbols only |
| Touch flow | `node tools/flow-test.js` (real touch events through CDP) | 14 of 14 pass: slow swipe past 35% picks, Undo returns the ticket with tape, a short drag springs back, a vertical drag never picks, a fling picks, Undo closes after 3 s, a double tap answers one ticket only, tap and arrow key pick, the fifth pick shows the finishing panel, Undo on the fifth pick cancels it, "Finish now" prints, the reward ends on Day done with 1,350P, the reward is skippable, the list view reaches finishing |
| Language switch | `node tools/lang-switch-check.js`: 360, 375, 390, 414, 440 px, three languages, four screens | 60 of 60: one line, nothing clipped |
| Captures | `node tools/capture-all.js`: 34 screens and states at 390 x 844 in EN and KO, home, done and ranking at 360 x 780, six key screens in JA | read at full size or on contact sheets after each round |
| Motion | `node tools/motion-run.js`: three recordings and six stills | watched as frame sheets; the stills show the armed stub, the strip feeding, the stamp mid slam and the settled screen |

Not run: the Hallmark `sloplint` script (not packaged in this copy of the skill). Its floor was walked by hand: tokens only, no `transition: all`, no animated layout properties, `overflow-x: clip`, focus rings, reduced motion, no eyebrows or tracked capitals, no middle dot strings, no emoji, no card in a card.

## Round 1: findings and fixes

1. Results rows showed every answer detail open (`hidden` lost to `display: grid`). Fixed, rows open on tap.
2. The back tickets of the deck were dimmed to 20%, which read as broken print and failed contrast. The next ticket now sits behind at full strength, so the next question is honest when the front one is dragged away; the third is hidden.
3. The ticket body was a pictogram in a grey box over a headline: generic. Added a field row printed like a real ticket ("Answer set: after 18:00 tomorrow" and "Hit +50P"), which gives the body ticket density and trims the picture.
4. The day done stamp covered the status text. The strip got its own last coupon for the total, with room for the stamp, and the stamp shrank one step.
5. Segmented controls were 38 px tall, inline links in notes were 14 px tall, the info button on the scaled back ticket measured 42 px. All now 44 px or more.
6. Points written as mono "+50P" mixed letters into the serial face. The figure is mono, the unit is the text face.
7. The sheet opened with a focus ring on Close after a touch. Focus now goes to the sheet itself.
8. The on hold list marked "You cannot convert" with a check. The list now has one line of what works and four of what is paused.
9. Onboarding step 3 wrapped "1,000P"; figures never wrap now.

## Round 2: findings and fixes

1. Control edges and perforations were 2.9:1 on stock. `--line-strong` darkened to `#78827A` (4.0:1 on stock, 3.2:1 on ground).
2. The invite bonus row on Results split "+15" and "P" to opposite sides. Fixed.
3. Figures in a row of three sat at different heights when a Korean label wrapped (My stakes). Figures now align to the bottom of the cell.
4. The rolling points figure sat a pixel above its unit in the header pill. The pill figure is now a single line box.
5. The list view serial was as loud as the question. Reduced to 12 px.
6. The "On the way +50P" tag had a gap inside the amount. Fixed.
7. Fresh state capture caught the first time nudge mid way; the capture script waits for it.

## Scores after round 2 (out of 10, my own, honest)

| Criterion | Score | Why not higher |
| --- | --- | --- |
| Hierarchy | 8 | One hero per screen (the ticket, the strip, the pool, the CT pass). Results is dense: the day header and the rows compete a little |
| Typography | 8 | Archivo at width 88 with Pretendard holds together in all three languages; Korean heads are a touch heavier than the Latin ones at 28 px |
| Colour discipline | 8.5 | Yellow is points only, blue and red are answers plus action and error. Blue doing both "right answer" and "primary action" is the one overlap |
| Spacing rhythm | 7.5 | 4 px base holds; the pick bar on Home leaves a quiet band above the tab bar at 844 px, and sub pages are looser than tab pages |
| Component consistency | 8 | Ticket, slip, rows, tag, punch reused everywhere; the three "three figure" blocks differ slightly in padding |
| Brand character | 8.5 | The stub, tray, strip and punch card are specific to this product; the Cojam mark and primary blue carry the brand |
| Affordance | 8 | Answers are labelled buttons with arrows on the side they fly to; the tray is not interactive and may look tappable |
| Motion | 8 | The snap at 35%, the drop into the tray and the print and stamp are the concept; the body of an undone ticket returns a little fast to read the tape landing |
| Density | 7.5 | Home fits 360 x 780 with nothing cut; Results in EN runs long because every row is two lines plus a label |
| Polish | 7.5 | Perforation bites are masks, so the ticket shadow is a filter and slightly soft on the bite edges; pictograms are plain |

## What I would still improve

- Draw the five pictograms with more character (they are honest one ink signs, but plain), and add one per category for past questions.
- Let the tray stubs open a small recap of that pick, since they look tappable.
- A sound and stronger haptic design for the snap and the stamp on a real device; tune the fling thresholds on mid range Android.
- Give Results a compact mode (one line per row) and group "waiting" rows of the same time.
- A dark counter theme (ink ground, same stock) was not built.
- The reward strip could carry the real stubs from the tray up into the printer, so the tray visibly empties as the strip prints.
- Deposit has no QR code: I did not want to draw a code that encodes nothing; production should render the real one.
