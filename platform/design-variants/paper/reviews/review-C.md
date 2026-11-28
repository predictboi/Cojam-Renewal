# Review C: Daily Paper (independent)

Reviewer C did not build these screens and did not read `REVIEW.md` or any other file in `reviews/` before scoring. Read beforehand: `CONCEPT.md`, `MOTION.md`, `STATES.md`, and the review loop in `docs/HANDOFF.md` section 7.

## Result

| Measure | Score | Target | Met |
| --- | --- | --- | --- |
| Design (10 criteria) | **83 / 100** | 85 | No |
| Nielsen usability | **35 / 40** | 34 | Yes |

**Verdict: ready to apply to the real app: yes after fixes.** The concept, the system and the core loop (deck, Undo, day done, results) are at release quality at 390 px in English and Korean. The points are lost on the entry screens (gate, login, first run), on short phones (360 x 640 and 320 x 568) and on the Japanese display face. Defects 1 to 7 below are the ones that hold it under 85.

## How it was judged

- Own Playwright captures (Chromium, deviceScaleFactor 1, touch context), fonts confirmed loaded per page (Besley, Hahmlet, Shippori Antique B1, Pretendard, Pretendard JP).
- 390 x 844: 59 states in EN, KO and JA (177 captures) plus 158 further states in one language each, rotating EN, KO, JA. 360 x 640 and 320 x 568: 20 screens in all three languages (120 captures). Eight full page captures.
- Used, not only looked at: mouse drag under and over the threshold, release, the 3 second Undo window frame by frame, tap then Undo, five picks by arrow key into the day done sequence (10 frames over 7 seconds), list view pick, copy address, "?" sheet, Rules sheet, Esc on a sheet, Tab order, the amount field with seven inputs.
- Measured by script on 20 screens at 390 and 320: sideways overflow, touch target size with hit probing, computed font sizes.
- Not verified: `prefers-reduced-motion`, a screen reader, real device rendering. The recorded videos in `captures/video/` were not used; motion was judged from my own frames.
- Owner constraints respected and not penalised: very little visible text, the exact 3 second Undo, English default with KO and JA.

## Design score

| # | Criterion | Score | Evidence |
| --- | --- | --- | --- |
| 1 | Hierarchy | 9 | Every screen has one slab figure or headline and one blue action: "+100P" on day done, "1,840.5 CT" on wallet, "14.7945 CT" on staking. Nothing competes with the question on the card. |
| 2 | Layout | 8 | Masthead, double rule, dateline and section rules hold every screen together. Lost points: the first run picture band moves and changes height between steps, the nameplate is cut on login and gate under 390 px, the install action on the gate sits below the first screen. |
| 3 | Spacing | 8 | Rows and fields keep one rhythm. Lost points: a section close rule followed 16 to 20 px later by a section open rule reads as a doubled line with a dead band (wallet, withdraw, deposit, invite, profile); the title touches the day boxes at 320 px. |
| 4 | Type | 8 | Besley and Hahmlet are an excellent pair: same colour, same sturdiness, numerals stay Besley in all scripts. Lost points: the Japanese face (see below), a unit letter that wraps alone ("+100" then "P", "9,850" then "P"), text under the stated 12 px floor at 320 px. |
| 5 | Colour | 9 | Black plus one blue with fixed jobs, persimmon and teal only for the two answers, red and amber only for real errors and warnings. At rest the home screen has blue only in the mark and one link. |
| 6 | Consistency | 8 | One masthead, one sheet, one button shape, one stamp. Lost points: framed things that are not controls, three different tab patterns, two tag skins (details in defect 8). |
| 7 | Density | 8 | Right at 390 x 844. On short phones the fixed chrome wins: ranking at 320 x 568 shows no complete row, staking at 360 x 640 hides the interest figure. |
| 8 | Copy | 9 | Labels of 1 to 3 words, buttons name the thing ("Stake 500 CT", "Withdraw 250 CT", "Fix the address"), errors carry the fix as a button. Small slips: a double gap in "Terms   and the", "Saving: Q1: Yes" with two colons. |
| 9 | Mobile | 8 | No sideways overflow in 455 captures; every control measured 44 px or larger (one 40 x 44 Back button at 320 px). Lost points: the 320 px defects on home, and the first run action below the screen at 360 x 640 in English. |
| 10 | Finish | 8 | Halftone pictures, proof stamp and pressed stamp, fuse rule, the press band and count up on day done all look made by hand and behave correctly. The overlapping "Example" tag, the peeking buttons at 320 px and the Japanese synthetic bold are visible unfinished edges. |
| | **Total** | **83** | |

### Does it look designed rather than generated?

Yes. The structure by rules, the square corners, the stamps at fixed angles, the answer colour that follows a pick as a small printed block and the dateline with one live fact form a system with its own logic. The only generic passage is the three icon and sentence lines under the login form.

### The Japanese display face (Shippori Antique B1)

It is a step in the right direction and not yet right.

- Good: at headline size (26 px, "明日の21時、ビットコインは10万ドルを超えている？") it has the weight and warmth of the Latin and Korean slabs, and the Besley numerals sit well inside it.
- Problem 1: the font has one weight, so the browser thickens it. At 32 to 44 px dense kanji fill in ("確認" in "ご確認ください", "週間").
- Problem 2: its kana are brush drawn and lean. Page titles that are mostly kana ("メールをご確認ください", "ウォレット", "ログインしてはじめる", "ステーキング") look slanted and loosely spaced next to the upright Besley and Hahmlet titles. They read as a shop sign, not as a newspaper headline.
- Problem 3: the full width "？" brings its own side bearing, so every question shows a gap before the mark.
- Judgement: acceptable for the prototype, not for release. See defect 4.

### Does a frame always mean a pressable control?

Mostly. Buttons, fields, "?" boxes, the address chip, Undo, lock period options, segmented controls and the question card all carry the ink frame and are pressable; tags, counts and day boxes carry tone only. The exceptions are listed in defect 8.

### Motion

Judged from frames of a real drag and a real five pick run. The proof stamp (dashed, unfilled) and the pressed stamp (filled, with a wash over the card) make the threshold legible; the fuse rule shows the 3 seconds honestly; the day box is hatched while the pick can still be undone and inks in after. The day done page never shifts layout through press band, Undo, "Saving your last pick", count up and "PAID" stamp. Focus on Undo pauses the fuse, as specified. Nothing decorative was seen. Motion quality is the strongest part of the work.

## Nielsen usability

| # | Heuristic | Score / 4 | Evidence |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 4 | Live dateline, fuse, hatched box, "Saving" then "Saved", skeletons, offline banner with the last update time, "Updated 14s ago", signing and sending sheets. |
| 2 | Match with the real world | 3 | Plain questions and answers. The newspaper words ("Extra", "FILED", the filter "Set", the five dashed boxes beside "Today") need one visit to learn. |
| 3 | User control and freedom | 4 | Undo by button, Z and Backspace; Esc closes a sheet and returns focus to the trigger; Back on every sub page; Cancel while signing. |
| 4 | Consistency and standards | 3 | Three tab patterns and the frame exceptions. |
| 5 | Error prevention | 4 | "-5", "1e5", "abc" are refused with a reason and the button stays disabled and named; above balance offers "Use 1,840.5 CT"; the withdraw review needs a ticked box; own address and contract address are caught. |
| 6 | Recognition rather than recall | 3 | Labels are present and short, the answer colour repeats everywhere. The day boxes and the results legend rely on memory. |
| 7 | Flexibility and efficiency | 3 | Arrow keys, cards or list, Max, Paste. No other accelerators, which fits the product. |
| 8 | Aesthetic and minimalist design | 4 | One figure and one action per screen. |
| 9 | Help users recover from errors | 4 | Inline message beside the cause, fix as a button ("Try again", "Deposit KAIA", "Send code to minji@gmail.com"), and "Your points and CT are safe on chain". |
| 10 | Help and documentation | 3 | "?" sheets are short and well placed. The iOS install hint covers the content it explains, and the first run action can be off screen. |
| | **Total** | **35** | |

## Defects, ranked by severity

| # | Severity | Screen and state | Viewport | Language | What is wrong | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | High | `login.html` (all states), `gate.html` (all states) | 360 and 320 | EN, KO, JA | The nameplate is cut by the language select: "Cojam Daily" loses its last letter at 360 px and reads "Cojam Dai" at 320 px. These are the first screens a visitor sees. | Use the same giving way order as the app masthead: drop the words and keep the mark under about 380 px, or show the select as a globe plus a two letter code so that it is 72 px wide. Never clip the wordmark. |
| 2 | High | `first-run.html?state=2`; `results.html` | 390 (first run); 320 (results) | EN, KO, JA | A unit wraps alone: "+100" with "P" on the next line beside an unbroken "+50P"; "9,850" with "P" below it in the All time cell. | `white-space: nowrap` on every figure plus unit, then step the figure size down (first run: 56 to 44 px; results cell: 21 to 18 px) until it fits. |
| 3 | High | `gate.html` (every state); `gate.html?state=ios` | all three | EN, KO, JA | (a) The "Example" tag lies on top of the card kicker ("Crypto", "암호화폐", "暗号資産" are half covered). (b) The floating "The Share button is down here" slip covers step 1 and 2 at 390 px, the answer buttons at 360 px and the card headline at 320 px. (c) The install action starts at the bottom edge of the first screen. | (a) Put the tag on the top edge outside the card, or in the kicker row in place of "No. 1 of 5". (b) Reserve bottom padding equal to the slip, and hide the slip while the steps list is in view. (c) Shorten the sample card (no source line, picture strip 56 px) or move "Get the app" above it so the primary action is on the first screen at 390 x 844. |
| 4 | High | Every Japanese page title and headline; clearest on `login.html?state=code`, `wallet.html`, `ranking.html`, `staking.html` | all three | JA | Shippori Antique B1 is thickened by the browser: dense kanji fill in at 32 to 44 px, kana titles look slanted and loose, and "？" is preceded by a gap. | Licence a true heavy antique for production, as `CONCEPT.md` already says. Until then: set `font-synthesis: none` for `:lang(ja)` display roles at 32 px and above and accept the regular weight at a size one step larger, or use a face with a real 900 weight for page titles only; tighten kana titles with `font-feature-settings: "palt"` and about -0.02em; trim the mark with `text-spacing-trim` or by removing the space before "？" in the copy. |
| 5 | Medium | `home.html` (default); `home-list.html` (default) | 320 x 568 | EN and JA (home); EN (list) | The answer buttons of the next card show as orange and teal slivers under the top card and, in Japanese, run into the swipe hint. In English "Today's picks" wraps to two lines and its second line touches the day boxes. | Clip the under sheets (`overflow: hidden` on the stack edges, or hide the content of cards 2 and 3 until they rise). Step the title to 26 px under 340 px or let the Cards and List switch drop under the title. |
| 6 | Medium | `first-run.html?state=1`, `2`, `3` | 390 (band); 360 x 640 and 320 x 568 (action) | all (band); EN (action) | The picture band is 285 px tall on step 1, 245 px on step 2 and 130 px on step 3 and is anchored to the text below, so an empty strip of 30 to 210 px opens between the masthead and the band and the band jumps on every step. At 360 x 640 in English the three line headline pushes "Next" off the screen. | Give the band one fixed height and a fixed top for all three steps. Pin the action row to the bottom and let the headline step down (44 to 32 px) on heights under 700 px. |
| 7 | Medium | `ranking.html`; `staking.html` | 360 x 640 and 320 x 568 | EN, KO, JA | Fixed chrome leaves too little: ranking shows two rows at 360 x 640 and no complete row at 320 x 568 under the pinned own bar; on staking the pinned action covers the lock period options at 320 px and the interest figure is off screen at 360 x 640. | On heights under 700 px: fold the pool and "How prizes work" into one row, drop the page title size, and make the own bar a 44 px single line. On staking, show the interest figure inside the pinned bar ("Stake 500 CT, +14.7945 CT") or unpin the action on short screens. |
| 8 | Medium | `ranking.html` own bar; `login.html`, `gate.html` panels; `deposit.html` QR; several | 390 | all | Frame and pattern drift. The "27" in the own bar has a frame and is not pressable. The login form and "Get the app" are framed panels with framed fields inside them. Three patterns switch views: underlined words (Cards, List), an inverted segmented control (This week, Last week; All, Waiting, Set) and underlined tabs on a rule (New stake, My stakes). Tags have two skins: tone ("Final", "Locked") and inverted ink ("Finished first day", "On hold"). | Remove the frame from "27" (slab figure on ink). Draw the login and gate panels as a sheet band between rules, as on convert, so only the field is framed. Keep two switch patterns at most: segmented control for filters of one list, underlined tabs for sub pages; move Cards and List to one of them. Use the tone tag everywhere except the hold status. |
| 9 | Low | `wallet.html`, `withdraw.html`, `deposit.html`, `invite.html`, `profile.html` | all | all | A closing hairline and an opening ink rule sit 16 to 20 px apart with nothing between them and read as a mistake. | Let the last row of a section drop its bottom hairline when a section rule follows. |
| 10 | Low | Tab bar; `ranking.html` column heads; `staking.html` lock labels | 320 | all | Text under the stated 12 px floor: tab labels 10.6 px, "Rank, Player, Prize" 10.2 px, "30 days" 11.2 px. | Hold 12 px as the minimum in the fluid scale; shorten Japanese tab labels if needed. |
| 11 | Low | `login.html`; home pick bar | all | EN | "Terms   and the" has a visible double gap; "Saving: Q1: Yes" has two colons. | Remove the stray spaces around the link; write "Saving Q1: Yes". |
| 12 | Low | `home.html` card 5 (XRP) | all | all | The fifth picture is a solid black block while the other four are light line drawings, so one card looks like another set. | Redraw it on the light ground, or set a maximum ink coverage for the server halftone job. |
| 13 | Low | `done.html` against `results.html` | all | all | The mock shows 1,350P in the masthead on day done and 1,250P with today's "+100P" on results. | Share one ledger value across the two pages. |

## What must not be lost when fixing

- The deck: proof stamp, pressed stamp, fuse, hatched then inked day box, Undo returning the same sheet.
- Day done: one page, no layout shift from Undo to "PAID".
- Error handling: reason beside the field and the fix as a button.
- Colour discipline: blue only for action, link, reward and the own row.
