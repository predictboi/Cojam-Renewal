# Review: home-cards.html (H1 Home, card view)

Checked in KO at 390x844 and 360x780, EN and JA at 390x844 (JA and EN also at 360), touch profile and keyboard only. `audit.js`: no overflow, no contrast failures, no targets under 44px.

## Design: 66 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 7 | The card and its question lead. The blue header (205px) plus the view switch (70px) spend 290px before the deck starts, so the deck gets under half of the screen. |
| Layout | 6 | The page is 856px tall in an 844px viewport (832 in 780), so it scrolls by 12 to 50px for no reason. The hint line under the deck is clipped by the tab bar at KO 360, hidden completely in EN 390 and cut on its second line in JA 390. |
| Spacing | 7 | Card padding and the two choice buttons are even. The "Closes in" line hangs alone on a row under the progress bar when nothing is answered. |
| Type | 7 | Question 22px / 20px bold is readable. Meta lines wrap to an orphan ("UTC 0시)", "UTC") at 360 KO and EN 390. No line clamp: a long question grows to 4 lines. |
| Colour | 6 | Lime is spent on the points pill text, the coin illustration, the whole ground of card 5 and the sun. When a drag lights the "Yes" button lime, it competes with a lime coin right above it. |
| Consistency | 7 | Header, tab bar and segmented switch match the other screens. The question chip is a solid pill on card 1, a translucent pill on cards 3 to 5 and invisible on card 2 (ink on ink). |
| Density | 7 | One question, two meta lines, two buttons is right. The rear cards are blurred picture fragments that add noise and no information. |
| Copy | 7 | KO reads native ("좌우로 밀거나 버튼을 눌러 고르세요"). "AI가 자동으로 확정해요" is fine. The answer source line is useful. |
| Mobile | 6 | At 360x780 the card is 350px tall and the "picks are final" warning is under the tab bar. Buttons are 133x54, fine. |
| Finish | 6 | Labels baked into the art collide with the UI: "10°C" sits behind the headline on card 3, the "KAIA" pill sits under the category chip on card 5, "3+" is hidden behind the buttons on card 4. |

## Usability: 23 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| Visibility of status | 3 | Counter, striped pending segment and the "2번: 아니요" saving line are clear. The saving line appears at the very bottom edge, partly behind the tab bar at 360. |
| Match with the real world | 3 | Left is No, right is Yes, arrows on the buttons repeat it. Cards 4 and 5 use "2골 이하 / 3골 이상" and "하락 / 상승", good. |
| User control | 1 | No undo, no confirm, and the pick is final. Leaving to done.html happens 420ms after the fifth pick. |
| Consistency and standards | 3 | Tinder style deck behaves as expected. A drag back to the centre cancels. |
| Error prevention | 1 | Two taps 120ms apart on the same spot answer two questions; five quick taps finish the whole day (reproduced, landed on done.html). Two ArrowRight presses 100ms apart also answer two; `keydown` does not check `e.repeat`, so holding the key answers all five. |
| Recognition over recall | 3 | Answer source and settle time are on every card. |
| Flexibility and efficiency | 3 | Drag, fling, buttons and arrows all commit. Arrows do nothing until focus is inside the card: 7 Tab presses from page load. |
| Minimal design | 3 | The view switch is permanent chrome on the main screen for a preference most players set once. |
| Error recovery | 1 | A wrong pick cannot be recovered at all. |
| Help | 2 | The only instruction, including "한 번 고르면 바꿀 수 없어요", is the clipped hint, and it disappears after the first pick. |

## Swipe deck findings

- Thresholds measured on a 334px card: slow drag 60px and 100px return, 140px commits; fling 60px in 60ms commits, 40px in 40ms returns. Throws are reliable and the spring of the next card feels physical.
- At a held drag of 100px (30%) the "예" stamp is fully opaque and the "예" button is lime, but releasing snaps the card back. The stamp reaches full opacity at 31% (`k * 3.2`), the button lights at 20%, the commit needs 35%. The card promises a pick it then refuses.
- Diagonal drag (70, 120) does not commit and does not scroll. Vertical drags starting on the card did not scroll the page in the test.
- A 4 line question keeps the text readable, because the scrim grows with it, but the image is almost fully covered (dark mush). JA question 2 is already 3 lines at both widths.
- Keyboard focus ring is `#124CC4` on the ink card: about 2.6:1, under the 3:1 needed for a focus indicator.
- Reduced motion: the pick still commits and the deck advances.

## Top 5 fixes

1. **`App.deck` click and keydown handlers (`assets/components.js` lines 537 to 547).** Rapid taps and key repeat answer several questions, and picks are final. Ignore input for 400ms after a commit, return on `e.repeat`, and hold each pick for 4 seconds with an "Undo" button in the `#sync` line before it is sent.
2. **`paint()` in `App.deck` (line 477).** Stamp and button show a full "Yes" at 30% while the commit needs 35%. Drive `.qstamp` full opacity and `.choice.is-hot` from the same `armed` flag (35%, or 28% if the threshold is lowered); below it cap the stamp at 0.4 opacity.
3. **`#hint` paragraph and `.ph` header.** The "picks are final" warning is clipped or hidden on every checked size except KO 390. Move "한 번 고르면 바꿀 수 없어요" into the card under the buttons (or beside the question chip) and cut the header: drop `.ph-sub` and put "마감까지" on the same row as the counter, so the page fits 844 and 780 without scroll.
4. **Card images `assets/img/q3-seoul-weather.svg`, `q4-football.svg`, `q5-kaia.svg` and `.qcard h2`.** Art labels collide with the headline, chip and buttons. Remove text from the art, keep the focal object in the top 45% of the frame, clamp `h2` to 3 lines with a step down to 18px for long questions.
5. **`keydown` listener in `App.deck`.** Arrows need focus inside the card. Listen on `document` and act when no input, sheet or other control has focus; change the focus ring on `.qcard .choice` to white or lime.
