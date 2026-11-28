# Review D: Daily Paper, independent usability and accessibility score

Date: 2026-11-27. Reviewer: independent agent, did not build the variant and did not read `REVIEW.md` or other files in `reviews/` before scoring.

Rubric: `docs/HANDOFF.md` section 7 (10 design criteria of 10 points, Nielsen 40 points by use). Targets: 85 and 34.

| Result | Score | Target |
| --- | --- | --- |
| Design | **81 / 100** | 85 |
| Nielsen usability | **33 / 40** | 34 |
| Verdict | **Ready to apply to the real app: yes after fixes** (the 3 blockers and majors 1 to 6 below) | |

## How it was tested

All tests were run with my own Playwright scripts (Chromium, touch emulation, CDP touch events) against `http://localhost:8851/`.

- Sweep of all 215 states in EN at 390x844, KO at 320x568 and JA at 360x640 (645 pages): console and page errors, failed requests, sideways overflow, target sizes, accessible names, contrast, font sizes, `lang`, `h1`, live regions. All 215 EN captures were looked at as contact sheets, plus KO and JA sets.
- Second sweep of the same 645 pages for tap targets that are covered by another element (9 sample points per control).
- Deck: real touch drags at several distances and speeds, flick, drag out and back, vertical and diagonal drags, tap answers, Undo at 1.5 s, 2.7 s and 3.25 s, rapid double picks, the fifth pick and its Undo on the day done page, list view pick and Undo.
- Keyboard only walk on home, withdraw, staking, ranking and wallet with the focus ring read from computed style; arrow keys, `z`, Enter, Esc, sheet focus trap.
- Screen reader semantics from the accessibility tree and DOM (roles, names, `aria-live`, `aria-invalid`, `aria-describedby`, dialog attributes).
- Viewports 320x568, 360x640, 375x667, 390x844 plus 375x812, 360x740, 360x800, 393x852, 412x915 for the card; a 150 character question with long answers in EN, KO and JA; root text at 130% and 200%.
- Reduced motion (running animations compared with and without the preference), colour vision simulation (protanopia, deuteranopia, tritanopia, achromatopsia, by matrix and by Chromium emulation).
- Money flows operated end to end: withdraw (junk, short, own, contract, lower case and padded addresses; 10 amount strings; Max; review; checkbox; send), convert (8 amount strings), stake (5 amounts, every period, review, the two step transaction), claim, withdraw of an unlocked stake, deposit copy (clipboard read back).
- Every "?" on 16 screens opened by touch in EN, KO and JA.
- On hold, offline (state and a real offline context) and error states.

## Design score: 81 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 9 | Every screen leads with one slab figure or one headline and one blue action; the dateline keeps the live time in the same place on every tab root. |
| Layout | 8 | Rules instead of boxes hold up on all 17 screens; pinned bars hide the lock line on staking at 320x568 and all but two ranking rows at 360x640, and the card leaves a 69 px void at 375x667. |
| Spacing | 8 | Even rhythm in rows, sheets and forms; the day boxes collide with a two line title at 320 px and the dateline runs into the title at 200% text. |
| Type | 8 | Besley, Hahmlet and Shippori carry the concept well; "+100 / P" (first run page 2, EN 390), "9,850 / P" (results, KO 320) and "Toda / y's" (home, 200%) break badly, and KO tab labels render at 10.6 px at 320 px, under the concept's own 12 px floor. |
| Colour | 9 | No text pair under 4.5:1 found in 645 pages (lowest measured 6.3:1); blue keeps its four jobs; the two answer inks stay apart under protan and deutan simulation and never stand alone. |
| Consistency | 8 | One masthead, one sheet, one button shape everywhere; Undo sits bottom right on the deck but top left on day done, a disabled action gives its reason on convert and withdraw but only "Stake" on staking, and a withdraw or convert does not show on the wallet afterwards while a stake does. |
| Density | 8 | The low text rule works (labelled facts, sheets behind "?"); the pinned "You" bar plus tab bar leave very little table on short phones. |
| Copy | 8 | Short, concrete, the action names the amount ("Withdraw 250 CT"), errors say the fix; the stake bar shows an end date without a year, and the card line that states the 3 second rule is removed on short screens. |
| Mobile | 7 | No sideways overflow anywhere and answers never clip, but the picture rule misfires at 375x667, a "?" cannot be tapped on the wallet, 200% text overlaps on home, and the nameplate is cut mid word at 320 px on log in, gate and on hold. |
| Finish | 8 | 645 pages with zero page errors, motion is purposeful and fully answers reduced motion, the stamps and hatched save boxes are a real signature; the defects listed below are visible to a first time user on common phones. |

## Nielsen score: 33 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| 1. Visibility of system status | 4 | Hatched box while a pick saves, "Saving: Q2: No", the 3 second fuse, transaction steps with hash, countdown on the dateline, `aria-live` on all of them. |
| 2. Match with the real world | 4 | Plain labelled facts ("Lock 90 days", "13% a year", "Fee: you pay"), address shown in groups of four, questions read as headlines. |
| 3. User control and freedom | 3 | Undo by tap, `z` and Backspace with a separate window per pick, Esc and Cancel on every sheet including while signing; the Undo of the fifth pick moves across the screen and any other tap ends it. |
| 4. Consistency and standards | 3 | Shared components throughout; Undo position, disabled button reasons, and review before an action (stake and send have one, unlocked stake withdraw and convert do not) differ. |
| 5. Error prevention | 3 | Own address, contract address and bad checksum are refused, the send needs a ticked box, amounts over balance offer "Use 1,840.5 CT"; but "0.0000001" reaches a "Send 0 CT" review and the withdraw form stays armed after a send. |
| 6. Recognition rather than recall | 3 | Labels always visible, balance beside each amount field, pick colour block follows the answer everywhere; the 3 second rule line is hidden at 320x568 and 360x640. |
| 7. Flexibility and efficiency | 3 | Arrow keys, `z`, Max, "Use" chips, Paste, one time code autofill, card and list views; no shortcut list and no last used address. |
| 8. Aesthetic and minimalist design | 4 | One question, one figure or one action per screen; nothing decorative. |
| 9. Help users recover from errors | 4 | Inline message beside the field with the fix as a button ("Use 1,000P", "Deposit KAIA", "Try again"), failed transaction sheet says nothing was taken. |
| 10. Help and documentation | 2 | "?" sheets exist on every screen and read well in three languages, but the one beside Points on the wallet does not open by touch or mouse, and no sheet says that a conversion cannot be reversed. |

## Blockers (fix before the design is applied)

### B1. The "?" beside Points on the wallet cannot be opened by touch or mouse

- Screen and state: `wallet.html`, states (none), `new`, `error`, `offline`, `hold`. Viewports 390x844, 360x640, 320x568. EN, KO, JA.
- Reproduction: open `wallet.html`, tap the centre of the "?" next to "Points". Nothing happens. `document.elementFromPoint` at the centre of the button returns `p.fig` (the "1,250P" figure): 6 of 9 sample points of the 44x44 button are covered by the figure's line box. With the keyboard (Tab, Enter) the sheet "How points become CT" opens, so the content exists.
- Why it blocks: the product rule is that explanations live behind "?". Here the minimum, the rate and the fee for converting are unreachable for every touch user.
- Fix: give `.qbtn` `position: relative; z-index: 1` (or remove the negative margin or tall line box on `.fig` that overlaps the label row). Add the covered target check to `tools/state-check.js` (sample `elementFromPoint` on every visible control). The same check shows a partial overlap on the "?" beside "You get" on `convert.html` (3 of 9 points) and on the Terms link on `login.html` in JA at 320 px.

### B2. A withdrawal that rounds to zero reaches the review, and the form stays armed after a send

- Screen and state: `withdraw.html` (none), 390x844, EN (logic, so every language).
- Reproduction 1: enter a valid address, type `0.0000001` as the amount. The action becomes "Withdraw 0 CT" and is enabled; tapping it opens the review "Send 0 CT".
- Reproduction 2: send 250 CT, tap Done on the "Sent 250 CT" sheet. The page still holds the same address and "250", and "Withdraw 250 CT" is enabled: two taps and one tick send it again. On returning to the wallet the balance still reads 1,840.5 CT although the sheet said "Balance left 1,590.5 CT".
- Fix: validate the rounded amount (reject anything below the smallest unit shown, with "Enter an amount in CT, like 250"). After a successful send, clear both fields or return to the wallet, and write the withdrawal and the conversion to the shared mock ledger as the stake already does.

### B3. The card picture rule misfires on iPhone SE size, and the next card shows through at 320 px

- Screen and state: `home.html?state=fresh` (and every state with a card).
- Reproduction 1: 375x667, EN, question 1 (three line headline). `.qimg` is `display: none`, the headline starts 69 px below the kicker rule, and 100 px of free paper sits under the card. KO at the same size keeps an 86 px picture. At 360x640 EN the picture is a 63 px sliver. On the most common small iPhone the front page looks unfinished.
- Reproduction 2: 320x568, EN. A persimmon and teal strip (the answer buttons of card 2) shows under the front card, and "Today's picks" wraps onto the day boxes.
- Fix: let the card take the deck height before the picture is dropped (the deck has the room: card bottom 543, tab bar top 607), and when the picture is dropped collapse its margin so the headline sits under the kicker rule. Give the stacked cards the height of the front card (or clip them to it). Set a minimum picture height (about 96 px) below which it is removed rather than shown as a sliver.

## Majors

### M1. The line that states the 3 second rule is removed on short screens

- `home.html`, 320x568 and 360x640, EN, KO, JA. `.qcard-final` ("+50P if right. Undo for 3 seconds.") is `display: none`; at 360x740 and above it shows.
- This is the one irreversibility fact of the game and it has no "?" on the card (the "Rules" sheet covers answer setting only).
- Fix: keep the line at every size (it is 17 px tall; take it from the picture), and add "After 3 seconds a pick is final" to the Rules sheet. The live region already says "Picked Yes. Undo, 3 seconds."

### M2. Undo of the fifth pick changes place and is easy to lose

- `home.html` to `done.html?state=moment&undo=…`, 390x844.
- On the deck Undo is bottom right (x 289, y 737). After the fifth pick the page changes and Undo appears top left (x 16, y 273) with what is left of the window (2.7 s measured on arrival), and a tap anywhere else finishes the day. Focus lands on `body`, not on Undo.
- Fix: keep Undo in the same bottom right position on the day done page (a pinned pick bar as on the deck), move focus to it, and do not treat a tap on the list below as "finish now".

### M3. Text at 200% on home: the dateline overlaps the title, the title breaks mid word, a black bar shows at the top

- `home.html?state=fresh`, 360x640, root font 200%, EN. "Closes in 03:07:09" sits on top of "Today's picks", which breaks as "Toda / y's / picks". A black bar about 260 px wide is visible at the top edge of every screen at 200% (it looks like the skip link not fully moved off screen).
- At 200% the pinned "You" bar on ranking covers half the viewport, and the segment labels ("This week") stay at their base size.
- Fix: let the dateline wrap onto its own row when it does not fit (`flex-wrap` and a row gap), set `overflow-wrap: normal; hyphens: none` on `h1` and let the view switch drop under the title, hide the skip link with `clip-path` or `top: -100%` in `em` independent units, and let pinned bars unpin above about 150% text. The capped chrome text (tab labels, points pill, answer buttons) is the accepted trade off and is not counted here.

### M4. A 365 day stake shows the same date at both ends of its bar

- `stakes.html` after staking 500 CT for 365 days (operate `staking.html`, choose 365 days, Stake). The new row reads "Nov 27, Day 1 of 365, Nov 27": the unlock year is missing. The review and the success sheet do say "Nov 27, 2027".
- Fix: show the year on the end date whenever it differs from the current year ("Nov 27, 2027").

### M5. Screen reader text contradicts the visible dateline on home

- `home.html`, EN and KO. Visible: "Closes in 03:11:16". Read out: "Closes in Next set in 3 hours 11 minutes" (KO "마감까지 … 다음 문제까지 2시간 55분").
- Fix: the hidden sentence should carry its own complete wording for the state ("Closes in 3 hours 11 minutes") and the visible label should be `aria-hidden` with it.

### M6. Withdraw of an unlocked stake and convert start signing with no review

- `stakes.html?state=unlocking`: "Withdraw 503.2877 CT" goes straight to "Signing with your Cojam wallet". `COPY.md` says the two parts (500 CT stake, 3.2877 CT interest) are in the review, but no review is shown. `convert.html`: "Convert 1,000P to 1 CT" also signs at once, and neither the screen nor its "?" sheet says a conversion cannot be turned back.
- Fix: show the short review sheet for the stake withdrawal (the two parts and the total), and add one line "Points cannot be converted back" to the convert sheet (or to the action's helper line).

### M7. Small finish defects that a first time user sees

- `first-run.html?state=2`, EN, 390x844: "+100P" wraps to "+100 / P".
- `results.html`, KO, 320x568: "9,850 / P" wraps in the figure row.
- `login.html`, `gate.html`, `system.html?state=blocked`, 320 px: the nameplate is cut mid word ("Cojam Dai", "Cojam Dail") by the language control or the hold tag, although the rule is that the words leave and the mark stays.
- KO and JA tab labels at 320 px are 10.6 px and 11.9 px.
- Fix: `white-space: nowrap` on figure plus unit and step the figure size down; hide the nameplate words under 340 px on those three screens; hold tab labels at 12 px and let the bar grow.

### M8. Other accessibility and platform notes

- The "To address" input on `withdraw.html` is 14 px, so iOS Safari zooms the page on focus; every other input is 16 px or more. Set it to 16 px.
- "Skip" on first run is 28x44 and the back arrow is 41x44; widen both to 44.
- Home starts with focus inside the deck, so the first Tab lands on "Rules" and the skip link and masthead are reached only after the tab bar. Acceptable for a game, but put Undo next in the order after a pick made with Enter (it is reached today only with `z`).
- The live region keeps "Picked No. Undo, 3 seconds." after the window has closed; clear it or replace it with "Final".
- The language buttons have no `lang` attribute ("한국어", "日本語" are read with the page language voice).
- A dark source picture (question 5, XRP) prints as a near solid black block, the heaviest thing on the screen; the server halftone job needs a tone limit.
- The prototype does not react to a real loss of connection (a pick made while the browser is offline is announced as saved); the `offline` states themselves are correct. Wire the real event in the app.
- Fonts come from Google Fonts and jsDelivr; an installed PWA needs them cached or self hosted to keep the look offline.

## What passed

- **Stability:** 645 pages (215 states, three languages, three widths) with 0 page errors, 0 failed requests and 0 sideways overflow. The only console message is Chromium blocking `navigator.vibrate` before a user tap, twice.
- **Deck gestures:** a slow drag of 120 px snaps back and 150 px picks at 390 px width; a 55 px flick in 36 ms picks; drag out and back cancels; vertical and diagonal drags do not pick; the drag shows the answer as a stamp with a colour wash.
- **Undo:** the window measured 2.96 s from pick to removal, Undo at 2.7 s worked, at 3.25 s it was gone. Two fast picks each keep their own window and `z` twice restores both in order. The button is 85x44 with the name "Undo question 2: No", and "Question 3 is back. Pick again." is announced.
- **Keyboard:** every control reachable, a 2 px blue ring everywhere (paper coloured on ink grounds, a ring on the field box for inputs), arrow keys pick, Esc closes sheets and returns focus to the opener, focus is trapped in an open sheet, `role="dialog"` with `aria-modal`.
- **Semantics:** one `h1` per screen (first run and invite keep extra ones in panels), skip link, named landmarks, questions as named groups ("Question 1 of 5: …"), answers named in full ("Pick Yes for: …"), day boxes as an image named "0 of 5 answered", fields with labels, `aria-invalid` and `aria-describedby`, correct `inputmode`, `autocomplete="one-time-code"` and `email`, `html lang` follows the language, page titles translated.
- **Contrast and colour:** no text pair below 4.5:1; disabled text is 6.3:1; the answer inks differ by side, arrow, word and hue (deltaE 34 protan, 51 deutan), and in greyscale the words and arrows still tell them apart.
- **Targets:** all controls 44 px or more except the two noted; answer buttons 54 px tall at every size and never clipped, also with a 150 character question (the headline steps to 18 px and the buttons grow to hold wrapped answers) in EN, KO and JA.
- **Reduced motion:** only the 3 second fuse, a 200 ms fade and the spinner remain; picks, Undo, the reward and sheets all still work.
- **Money flows:** address checks (format, own wallet, contract, checksum), the amount parser ("1,250.75" and "250 CT" accepted; negative, exponent, letters, double points and other numerals refused with a reason and the button disabled), Max, "Use" chips, the withdraw review with the full address in groups, the tick box "Sends on Kaia cannot be undone", Cancel while signing, the two step stake transaction, success sheets with the destination and the balance left, Kaiascan links, the clipboard copy on deposit.
- **Critical facts on the surface:** "Locked until Feb 25, 2027. No early exit." on staking and again in its review, "Rate a year", "No fee: Cojam pays" and "Fee: you pay", "Send only on Kaia. Tokens sent on another network can be lost."
- **Help:** 15 of 16 "?" controls open by touch in all three languages and their sheets are short and complete.
- **Hold, offline, error states:** every tab has its hold notice with "What this means", actions that stay possible are named with who pays the fee, offline states disable actions and say why, errors offer "Try again" and say funds are safe.
- **Languages:** KO and JA layouts hold at 320 and 360 px, headlines use the matching slab faces, language choice persists across pages.

## Verdict

**Ready to apply to the real app: yes after fixes.** The concept, the component system, the state coverage and the accessibility base are strong and stable. Both scores sit a little under target (81 against 85, 33 against 34), and the gap is made of concrete, small defects: one covered help button, two holes in the withdraw flow, the picture rule on short phones, the hidden 3 second line, the moving Undo on the last pick and the 200% overlap. Fixing B1 to B3 and M1 to M6 should lift Mobile, Consistency and the three Nielsen items that lost points, which would put both scores at or above target on a rescore.
