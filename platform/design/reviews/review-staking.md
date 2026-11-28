# Review: staking.html (S1 New stake)

Checked in KO at 390x844 and 360x780, EN and JA at 390x844. Typed empty, 0, 50, 100.123456789, 2000, abc, "1,000", 999999; staked 500 CT through to success; cancelled midway; pressed Escape; used Max and changed the period. `audit.js`: clean.

## Design: 72 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 8 | Amount, period, summary, action: the order of the decision. Interest is the largest figure in the summary. |
| Layout | 7 | Clear single column. The primary button sits at about y 811 at 390x844, behind the tab bar (top at 782), so the action is not visible on the first screen. |
| Spacing | 7 | Even. The summary card rows are generous (5 rows, 225px). |
| Type | 8 | Period buttons with wide digits and a rate under them are the clearest control in the product. |
| Colour | 8 | Lime only on the switch, the chosen period, the primary button and the tab. Correct use. |
| Consistency | 7 | Same switch and button as elsewhere. The summary card has no ink border while the form card has one. |
| Density | 7 | "수량 구간" and "원화 환산" rows add little for 500 CT. |
| Copy | 7 | "원화 환산 약 97,500원" does not say what is converted (the principal). The rules paragraph is dense but correct and native. With an invalid amount the button says "수량을 입력하세요" although an amount is entered. |
| Mobile | 6 | Action below the fold at both sizes; at 360 the page is 1,116px. |
| Finish | 7 | Error state with a one tap fix ("100 CT로 맞추기") is well made. The summary keeps showing interest for an invalid amount (1.4795 CT for 50 CT). |

## Usability: 30 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| Visibility of status | 4 | Signing, approve, stake, sending and success are each shown with steps and a tx hash. |
| Match with the real world | 3 | "예치 기간", "연 이율", "잠금 해제일" are the bank words Koreans expect. |
| User control | 2 | One tap on the button starts a 90 day lock that has no early exit. "취소" exists for about 2 seconds, then becomes "숨기기". Escape does not close the sheet. |
| Consistency and standards | 3 | The review sheet appears only from 10,000 CT, so the same action behaves differently by amount. |
| Error prevention | 2 | No review below 10,000 CT. "100.123456789" is accepted and silently becomes 100.1235. |
| Recognition over recall | 4 | Balance, minimum, rate, interest and unlock date are all on screen. |
| Flexibility and efficiency | 3 | Max and fix buttons. No quick amounts (25%, 50%). |
| Minimal design | 3 | Good, minus two weak summary rows. |
| Error recovery | 3 | Errors say the limit and offer the fix. A cancelled transaction gives no confirmation message. |
| Help | 3 | Rules paragraph and a rate table in "스테이킹 안내". |

## Top 5 fixes

1. **`txCfg().review` in `staking.html` (`a >= 10000 ? ... : null`).** A 90 day lock with no early exit starts on one tap for any amount under 10,000 CT. Show the review sheet for every amount, with amount, period, rate, unlock date and "중도 해지 불가" above the confirm button.
2. **`#go` primary button.** Hidden behind the tab bar on the first screen at 390x844 and 360x780. Pin it above the tab bar (sticky bar with the "수수료 없음" line), or shorten the page by removing the "수량 구간" and "원화 환산" rows.
3. **`go.querySelector("span").textContent` when invalid.** "수량을 입력하세요" shows for 50 and 2,000. Use the reason: "최소 100 CT부터" or "보유 수량 초과", and blank the `#sum` interest row while the amount is invalid.
4. **Transaction sheet `.sheet` during signing.** Escape and the scrim do nothing, and "취소" turns into "숨기기" after 2 seconds without a word. Let Escape trigger the visible button, and after a cancel show a toast "스테이킹을 취소했어요. CT는 그대로예요."
5. **Row `s.value` "원화 환산".** Rename to "맡기는 금액 (원화)" or move the won value under the amount input as a caption ("약 97,500원"), where it belongs.
