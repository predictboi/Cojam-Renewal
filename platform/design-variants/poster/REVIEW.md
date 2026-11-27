# Review: Poster

Two full critique and fix rounds, each on every capture at full size (390 x 844 EN and KO, 360 x 780 for home, done and ranking, JA for home, done, ranking, login and wallet), plus the recorded videos read frame by frame.

## Checks run

| Check | Result |
| --- | --- |
| `tools/design/audit.js`, 53 screens and states, mobile, `AUDIT_ACCENT=#FFD400` (`sh tools/audit-all.sh <lang> <w> <h>`) | 0 overflow, 0 contrast failures, 0 small targets at 390 x 844 in EN, KO and JA and at 360 x 780 in EN and KO |
| `node tools/flow-test.js` (real touch events through CDP) | 20 of 20 pass: short drag springs back, vertical drag never commits, swipe past 35% commits, fling commits, Undo returns the card, the 3 s window closes, a double tap answers one card, five picks, Undo on the fifth pick, Finish now, the automatic finish, the reward moment plays the picks just made, a tap skips it, arrow keys, no page errors |
| `node tools/lang-switch-check.js` | 180 language buttons (360, 375, 390, 414, 440 px; EN, KO, JA; hub, login, first run, profile): none wrapped or clipped |
| Interface guidelines pass (by hand, the `web-design-guidelines` skill was not loaded) | focus rings on every control, labels on icon only controls, live regions for picks and status, `aria-pressed` and `aria-current` on switches and tabs, reduced motion, no `transition: all`, transform and opacity only, hover gated to fine pointers |

Not done: a test on a physical phone (frame rate was judged from Chromium with touch emulation and the recordings only), a screen reader pass, and the Hallmark automated sweep (its scripts are not packaged here; the Floor was walked by hand).

## Round 1: what was wrong and what changed

1. The answer preview was a 40% tint over the poster and turned olive on yellow. Redesigned: a solid red or blue sheet slides in from the trailing edge, covers under half below the threshold and snaps across at it. It is now the most "poster" moment in the app.
2. The answer word sat on the side of the card that leaves the screen. Moved to the side that stays visible.
3. `+100` clipped its "P" at 390 px. Resized from the viewport and re-checked at 360.
4. The countdown on day done ran into "Opens at 09:00 KST"; the pool figure ran into "Monday 09:00 KST". Both restacked.
5. Inter Tight turned `0x` into a multiplication sign in addresses. Contextual alternates are off everywhere.
6. List view numerals overlapped the question. Column widened to 72 px.
7. The white 5 on the login cover sat under the lede. The glyph is smaller and the lede has its own measure.
8. Card numeral and form were too timid. Numeral raised to 66% of the card height, form to 60% of its width.
9. Decorative state glyphs failed contrast in grey. They are now ink, which is also more in character.

## Round 2: what was wrong and what changed

1. Japanese headlines broke inside a phrase ("ログインし / てはじめる"). Phrase aware breaking for Japanese heads and its own cover size.
2. Pool figure collided again at 360 px. Sized from the viewport.
3. Terms and Privacy links were 43 px tall. Now 46.
4. The fine print's full stop wrapped alone. The links are inline again with padded hit areas.
5. A spring back hid the answer sheet at once. It now slides back out the way it came.
6. Home on hold and error still said "5 left today". Removed.
7. The invite total clipped in its column. Trio figures scale with the viewport.

## Scores after round 2 (out of 10)

| Criterion | Score | Note |
| --- | --- | --- |
| Hierarchy | 9 | One giant figure per screen; the eye has one place to land |
| Typography | 8 | Tight heavy grotesque holds in all three languages; Korean heads at 900 are a little dense at 22 px, and Latin word spacing at -0.045em tracking is at its limit |
| Colour discipline | 9 | Red is left, blue is right, yellow is "yours now", black is action; no exception found in the audit list |
| Spacing rhythm | 7 | 8 px unit holds, but section paddings are set per screen in places and convert leaves a large empty middle |
| Component consistency | 8 | One button set, one segmented control, one row, one field; a few inline styles in the screen scripts should become classes |
| Brand character | 9 | Recognisable from any single screen; the mark's blue lives naturally as the right answer |
| Affordance | 8 | Answers, Undo and primary actions are unmistakable; the two peeking sheets say "stack", but there is no first time nudge for the swipe |
| Motion | 8 | Sheet slide, throw, Undo return and the reward composition all speak one language; not yet verified on a real mid range phone |
| Density | 8 | Home fits 360 x 780 without scrolling; results is long but scannable |
| Polish | 7 | Clean in the audit, but the geometric forms are plain, the QR is a drawn stand in, and deposit and withdraw are sheets with fewer states than the reference |

Average: 8.1.

## What I would still improve

- A first time swipe nudge (the front poster leans right, then left, once).
- Deposit and withdraw as full screens with every error state of the reference (bad address, own address, contract address, too little KAIA), and the full transaction progress sheet.
- A proper spacing scale applied through classes instead of inline paddings in the screen scripts.
- Give each category form more intent (the markets bars could carry the day's direction, the weather arc the temperature).
- Real device test of the throw and the reward moment at 60 fps, and a VoiceOver and TalkBack pass.
- Results: the row should open in place with the answer, evidence and set time (the reference does this; here only the summary line shows).
