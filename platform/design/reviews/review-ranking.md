# Review: ranking.html (K1 Weekly ranking)

Checked in KO at 390x844 and 360x780, EN and JA at 390x844; opened the prize explainer, scrolled, switched to last week. `audit.js`: clean.

## Design: 64 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 6 | On the first screen at 390x844 KO no leaderboard row is fully visible: header, switch and the 320px prize card fill the space above the pinned "나" bar. The pool figure outranks the ranking itself. |
| Layout | 6 | Prize amounts sit on two lines ("385.2" then "CT"), making every row 96px tall for two facts. |
| Spacing | 7 | Consistent row rhythm. The prize explainer grid is cramped at 5 columns. |
| Type | 7 | Wide display digits for prizes read well. Rank numbers 4 to 10 are grey and small next to the lime medals. |
| Colour | 6 | Lime on the pool figure, medals 1 to 3, the pinned rank tile and the pinned points: four uses that are not primary action, selection or day progress. |
| Consistency | 6 | Header pill says 1,250P while the pinned row says 1,350P, with no label telling balance from weekly points. "Top 10" is left in English in KO while JA has "トップ10". |
| Density | 6 | Ten rows need 980px of scroll. |
| Copy | 6 | "참여 자격을 갖춘 1,284명 x 1 CT, 최대 10,000 CT" reads as a formula. "동점" chips are not explained. |
| Mobile | 7 | Fits at 360; the pinned bar plus tab bar take 130px of the 780. |
| Finish | 7 | Solid card and medal work. The "13초 전 업데이트" dot has no way to refresh. |

## Usability: 27 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| Visibility of status | 3 | Own rank, gap to Top 10 and time left are always visible. Freshness shown. |
| Match with the real world | 2 | yuki.m and 하늘 are both 2,350P and marked "동점", yet they are rank 3 and 4 and receive 192.6 and 128.4 CT. Ranks 8 and 9 are tied with equal prizes. The rule that separates a tie is nowhere on the screen or in the explainer. |
| User control | 3 | This week and last week switch in place. |
| Consistency and standards | 2 | Two different point totals for the same player on one screen. Explainer rounds 89.88 to 89.9 while the row shows 89.88. |
| Error prevention | 3 | Read only. |
| Recognition over recall | 3 | Prize split is one tap away. |
| Flexibility and efficiency | 2 | The pinned "나" bar is not tappable and there is no way to see ranks 11 to 27 around the player. |
| Minimal design | 3 | Reasonable. |
| Error recovery | 3 | Error and offline states exist. |
| Help | 3 | The explainer covers eligibility and payout time. |

## Top 5 fixes

1. **`.krow` rows with the "동점" chip and the explainer text.** Tied players get different prizes with no reason shown. Either split the combined prize evenly between tied ranks, or state the tie break in the chip itself ("동점, 먼저 달성") and add the rule as one sentence to "상금은 이렇게 정해져요".
2. **Prize card above the list.** It pushes the whole leaderboard off the first screen. Reduce it to one row (pool on the left, time left on the right, explainer as a small "어떻게 정해지나요?" link) so at least ranks 1 to 3 show at 390x844.
3. **`.pin-pts` in the pinned bar and the header points pill.** 1,350P and 1,250P read as a bug. Label the pinned figure "이번 주 1,350P" and keep the pill as the balance.
4. **Prize column in `.krow`.** Put the unit on the number line ("385.2 CT") and cut row height from 96px to about 64px, so ten rows fit in two screens.
5. **Lime on `.fig--volt` (pool), `.krow-rank` 1 to 3, `.pin-rank`, `.pin-pts`.** Lime should mark only the segmented selection here. Make the pool figure white, the medals white with an ink edge, and the pinned rank tile white; translate "Top 10" for KO ("상위 10명").
