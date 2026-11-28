# Review: login.html and login.html?state=unsupported (A1 Login)

Checked in KO at 390x844 and 360x780, EN and JA at 390x844, both states. Walked the flow: empty submit, a typo address (minji@gmial.com), a valid address, a 3 digit code, "다른 이메일 쓰기", a full code, setup, arrival on first-run.html. `audit.js`: clean.

## Design: 71 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 8 | Headline, one field, one lime button. Nothing competes. |
| Layout | 6 | The panel ends at y 585 of 844: the lower 40% is empty blue grid. In the unsupported state at 360x780 the panel runs to the bottom edge and the page scrolls by 2px. |
| Spacing | 7 | Even inside the panel. Two help rows directly under the button make the panel feel like a form with three actions. |
| Type | 8 | The EN wide display headline and the KO heavy headline both hold the blue ground well. |
| Colour | 8 | Lime only on the one action. The amber note is distinct from the red field edge. |
| Consistency | 7 | Language select shows "EN" beside "한국어" and "日本語". On the code step the page headline and lede still say "이메일을 입력하면 코드를 보내 드려요". |
| Density | 7 | Right for a first screen. |
| Copy | 6 | "이용약관과 개인정보 처리방침" are plain text, not links. "동의하게 돼요" is stiff; the provider list appears twice in the unsupported state (note and the help row). |
| Mobile | 7 | Field 58px, button 52px, correct input mode and autocomplete. |
| Finish | 7 | Same family as the landing: grid ground, logo chip, lime pill with hard shadow. Plainer than the landing: no sticker or tilted element anywhere. |

## Usability: 28 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| Visibility of status | 3 | Sending, code sent to the address, 60 second resend timer, three setup steps. |
| Match with the real world | 3 | Plain words; "Kaia 지갑은 Cojam이 만들어 드려요" removes the wallet fear. |
| User control | 3 | "다른 이메일 쓰기" returns with the address kept. |
| Consistency and standards | 3 | The code field submits itself at 6 digits and also has a "로그인" button. |
| Error prevention | 2 | The provider rule is hidden behind a help row until the player fails. "gmial.com" gets the unsupported note with no "gmail.com?" suggestion. The field is not focused on load. |
| Recognition over recall | 3 | The address is repeated on the code step. |
| Flexibility and efficiency | 2 | No social or passkey route, no paste button for the code. |
| Minimal design | 3 | Two help rows plus the fine print under one field. |
| Error recovery | 3 | The unsupported note names every accepted provider. A 3 digit code gets "코드가 맞지 않아요" instead of "6자리를 모두 입력해 주세요". The note stays after the address is corrected, until the next submit. |
| Help | 3 | Both help rows answer real questions. |

## Top 5 fixes

1. **`.fine` paragraph (`a.fine`).** Terms and privacy are not links. Make "이용약관" and "개인정보 처리방침" links and rewrite to "계속하면 이용약관과 개인정보 처리방침에 동의한 것으로 봐요."
2. **`emailErr()` and the `#prov-note` note.** A typo domain is treated as an unsupported provider. Detect near matches (gmial, gamil, naver.co, hanmail.com) and offer one tap "minji@gmail.com으로 바꾸기", in the same style as the staking fix button; clear the note on input.
3. **Field caption under `#email`.** The provider rule appears only after failure. Show a quiet caption before submit ("Gmail, Naver, Kakao, iCloud 등 주요 메일만 가능해요") and drop the "어떤 이메일을 쓸 수 있나요?" row, which removes the duplicate list in the unsupported state.
4. **`h1` and `.auth-lede` on the code and setup steps.** They keep the email step text. Swap them per step (code: "메일로 보낸 코드 6자리", setup: "게임을 준비하고 있어요") and remove the duplicate `h2` inside the panel.
5. **`.auth-main` vertical placement and the empty ground.** 40% of the screen is empty. Add one brand element from the landing in that space (the tilted "YES 62%" sample card or a sticker row showing "하루 5문제, 1분"), and focus `#email` on load.
