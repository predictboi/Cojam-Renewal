# Matchday review

Two full critique and fix rounds were run on the captures at full size (EN, KO, JA; 390 and 360 px), followed by the scripted checks. This file records the last round's scores, what each round fixed, the check results and what is still open.

## Checks (last run)

| Check | Result |
| --- | --- |
| `tools/design/audit.js`, 46 screens and states, EN at 390 x 844, mobile, `AUDIT_ACCENT=#124CC4` | 0 overflow, 0 contrast failures, 0 small targets on every page (`tools/audit-en.txt`) |
| Same audit, KO at 390 x 844 | 0 / 0 / 0 on every page (`tools/audit-ko.txt`) |
| Same audit, JA at 360 x 780 | 0 / 0 / 0 on every page (`tools/audit-ja-360.txt`) |
| `node tools/flow-test.js` (touch swipe, short drag, tap, arrow key, Undo, Undo on the fifth pick, finish, reward plays, reward ends, reward skip, points and final score) | 16 of 16 pass, no page errors |
| `node tools/lang-switch-check.js` (hub, login, first run, profile at 360, 390, 440 px in EN, KO, JA) | 45 checks, 0 failures: one line, unclipped, 44 px tall |
| Web interface guidelines pass (pinned rules) | fixed: sheet overscroll containment, balanced display heads, input names, spellcheck off on email, code and name fields, image dimensions, hover states for pointer devices. Left as is: dates and numbers use small hand written formatters to match the base prototype's wording |

## Scores, last round (each out of 10)

| Criterion | Score | Why not higher |
| --- | --- | --- |
| Hierarchy | 8.5 | Home is clear (question, then the two kits). On the wallet the points board and the CT panel compete a little |
| Typography | 8.5 | Barlow Condensed with Do Hyeon and M PLUS 1p holds together in all three languages; Do Hyeon has one weight, so Korean display lines cannot step between weights the way Latin does |
| Colour discipline | 8.5 | Five hues with strict homes (blue, orange, bulb yellow on the board, green for W, red card for errors). Green appears in a few tags outside results |
| Spacing rhythm | 8 | 14 px block rhythm and 16 px gutters throughout; a few inline style overrides remain in the screen code |
| Component consistency | 8 | Banner, board, table, panel and key and value rows repeat everywhere; the two disclosure styles (details and menu rows) could be one |
| Brand character | 9 | The face-off, the score bug and the league table are recognisable at a glance and belong to no real league |
| Affordance | 8 | Both sides are large buttons with arrows and words; the drag hint is one quiet line, and the list view is one icon away |
| Motion | 8.5 | The wipe follows the thumb and the whistle sequence reads in 2.2 s; frame rate was checked only in desktop Chromium recordings, not on a mid range phone |
| Density | 8 | Home fits 360 x 780 without scrolling in all three languages; results rows are tall when a question wraps to two lines |
| Polish | 7.5 | Office screens are correct but plainer than the pitch screens; question illustrations are the shared ones, not redrawn for this concept |

## Round 1: findings and fixes

- The league table class collided with the large flip digit modifier and painted the final score white. Renamed the table class.
- Board figures inherited the small note style (pool figure rendered at 13 px). Scoped the note style.
- The card stack behind the front card was invisible. Stack now scales from the top edge and peeks above the front card with an ink outline.
- The illustration took too much of the card. Title raised to 34 px, the face-off to 124 px with 36 px answers, illustration band shrinks first.
- Solid plates behind the left answer's words broke the stripes. Removed: white on either stripe colour passes (5.25:1 and 7.2:1).
- Final score: team labels drifted away from the digits. Rebuilt as swatch plus condensed label hugging the tiles.
- My stakes: three figures collided on the board. Tighter board variant at 27 px.
- Wallet showed available plus staked as one unlabeled total. Now the big figure is the available CT, with staked and KAIA as rows.
- Audit: hidden cards and wipes were read as zero contrast text, the info button on back cards was scaled under 44 px, the withdraw checkbox was 24 px, the invite link was set in the address face. Back cards and idle wipes are `visibility: hidden`, the checkbox has a 44 px hit area with a drawn box, the link uses the body face.
- Form guide wrapped to two lines. Limited to the last eight marks on one line.
- Full page captures showed the sticky tab bar mid page. The capture now grows the viewport to the page height.

## Round 2: findings and fixes

- Mid swipe the answer label on the wipe was clipped at the card edge. The wipe now reaches further (62% of travel) and its label sits 5% from the leading edge.
- A committed card stayed visible as a sliver at the screen edge. It flies further and is hidden when the flight ends; Undo makes it visible again from the same position.
- Pitch lines tried behind the full time sequence crossed the score digits. Removed: the sequence is ink, two sweeps, type and digits only.
- Opening a sheet drew a focus ring on the close button for touch users. Focus now lands on the sheet itself; the ring still shows for keyboard users on every control.
- No hover feedback on pointer devices. Added inside `@media (hover: hover)`.
- Profile: the name sat on top of the login line. Spacing added.
- Small note under KAIA rendered in the condensed face. Notes inside value cells now use the body face.

## Still open

- Measure the swipe and the reward on a real mid range Android phone; clip paths are static, but that has not been verified on a device.
- Redraw the five question illustrations as match programme art in the Matchday palette (they are copied from the base prototype so the data stays identical).
- Results rows do not expand to show answer, evidence and set time; the base prototype has that detail.
- Deposit and withdraw are sheets on the wallet, not separate pages; the install gate, the maintenance and the forced update screens were not rebuilt.
- The office screens could carry more of the system (for example a lower third on each panel) without losing calm.
- Korean display type would benefit from a second weight; a licensed condensed Hangul face would be the real fix.
