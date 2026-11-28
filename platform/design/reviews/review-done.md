# Review: done.html?state=moment (H3 Day done)

Checked in KO at 390x844 and 360x780, EN and JA at 390x844, reached both directly and through the real five card flow. `audit.js`: clean.

## Design: 68 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 7 | Check badge, headline and five ticks land first. Then the countdown card, the lime button and the toast all ask for attention at once. |
| Layout | 7 | Header, countdown, one primary action, list. In EN the headline wraps to 3 lines and the header grows to 285px. |
| Spacing | 7 | Even rhythm. The countdown card is 160px tall for one number. |
| Type | 8 | The wide display digits in the countdown are the best type moment in the product. |
| Colour | 6 | Lime on the badge, five tiles, the "+100P" chip, the primary button, the toast edge and the tab: seven lime objects in one viewport, so the primary action no longer stands out. |
| Consistency | 7 | Same header and button as elsewhere. The five big tick tiles are a different shape from the thin progress segments on the home header they continue. |
| Density | 6 | Each list row truncates the question with an ellipsis after one line although there is room for two, and repeats "정답 대기 중" five times. |
| Copy | 6 | "+100P" is said three times: header pill 1,350P, the chip "+100P 지급 완료", the toast "+100P가 지급됐어요." |
| Mobile | 7 | Works at 360. The toast covers rows 2 and 3 of the list for about 4 to 5 seconds. |
| Finish | 7 | The pop of the badge and the fill of the ticks are tidy. The header pill moves from 1,250P to 1,350P after load. The moment itself is short and the screen is static after about a second. |

## Usability: 29 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| Visibility of status | 4 | Done, paid and next set time are all explicit. |
| Match with the real world | 3 | "오전 9시에 열려요" is plain. "정답 대기 중" is clear. |
| User control | 3 | Back returns to the home deck (mock resets to 0/5). Links to ranking and results. |
| Consistency and standards | 3 | Standard. |
| Error prevention | 3 | Nothing destructive here. |
| Recognition over recall | 3 | Picks are listed, but the truncated questions hide the number that matters ("...위에서 마감할"). |
| Flexibility and efficiency | 2 | No share, no reminder or notification opt in for 09:00, which is the natural next step of a daily game. |
| Minimal design | 2 | Triple reward message and five identical status labels. |
| Error recovery | 3 | Not applicable in this state; `saving` and `offline` states exist. |
| Help | 3 | The info note explains when the +50P per correct answer arrives. |

## Top 5 fixes

1. **Toast `+100P가 지급됐어요.` raised on load.** It repeats the chip and covers the list. Remove the toast in the `moment` state and let the `.done` chip carry the message, with the header pill counting from 1,250P to 1,350P.
2. **Day progress tiles and badge in the header.** Seven lime objects flatten the primary action. Keep lime on the five ticks (day progress) and the "주간 랭킹 보기" button; make the badge white with an ink tick and the "+100P" chip white on ink.
3. **Rows of "오늘 고른 답" (`.row` list).** One line ellipsis hides the threshold in each question. Allow 2 lines, and replace the five "정답 대기 중" labels with one line in the section header ("정답 대기 중 5개"), keeping the right column for the pick.
4. **Countdown card.** It is passive. Add one secondary action under it: "오전 9시에 알림 받기" (push opt in), which is the retention step this screen exists for.
5. **EN headline "TODAY'S 5 PREDICTIONS DONE".** Three lines at 390. Shorten to "ALL 5 DONE" or "5 OF 5 DONE" so the header height matches KO and JA.
