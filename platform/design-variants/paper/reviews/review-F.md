# Review F: Daily Paper, independent usability and accessibility score

Reviewer: independent agent, did not build the prototype, did not read `REVIEW.md` or any other file in `reviews/` before scoring.
Date: 2026-11-27. Build under test: `platform/design-variants/paper/` served at `http://localhost:8851/`.
Rubric: `docs/HANDOFF.md` section 7 (10 design criteria of 10 points, Nielsen 40 points by use). Targets: 85 and 34.

## Result

| Score | Value | Target | Met |
| --- | --- | --- | --- |
| Design | **84 / 100** | 85 | No, one point short |
| Nielsen usability | **36 / 40** | 34 | Yes |

Verdict: **ready to apply to the real app: yes after fixes.** There is no blocker. Six majors should be fixed first; four of them are small and local (one ledger write, one focus call, two 320 px layouts).

## How it was tested

All by operating the pages with my own Playwright scripts (Chromium, touch and mobile emulation), scripts and captures in the session scratchpad under `review-f/`.

| Test | Scope | Outcome |
| --- | --- | --- |
| State sweep | 215 states x EN, KO, JA x 390x844 and 320x568 = 1,290 pages | 0 console errors, 0 page errors, 0 sideways overflow, 0 controls without an accessible name, 0 text under 12 px |
| Contrast | Computed text against effective ground, all 215 states, EN | 0 failures, disabled text included (ink-2 on paper-2, 6.3:1) |
| Deck by touch | CDP touch drags: short, vertical, diagonal, long, flick, drag out and back, double tap 60 ms apart, tap during the first visit nudge | All behave correctly (details under "What passed") |
| Undo | Tap at 2.4 s and 2.9 s, wait past 3 s, fifth pick on `done.html`, `Z` key, Enter on Undo | Window closes between 3.0 and 3.13 s; fifth pick Undo works |
| Keyboard | Tab walk of 13 screens, arrow keys, `Z`, Esc, sheet focus trap, full keyboard withdrawal | Every stop has a 2 px ring; one focus defect (major 3) |
| Semantics | Landmarks, headings, labels, live regions, dialog naming, inert background | Sound; small defects listed |
| Covered controls | `elementFromPoint` on every enabled control in the sweep | Only transient toast overlaps |
| Viewports | 320x568, 360x640, 375x667, 390x844 plus seven in between heights | Answers always reachable; two 320 px defects, picture drop |
| Text size | Root font 130% and 200%, four viewports, three languages | No loss of content; `main` scrolls to the answers |
| Reduced motion | `prefers-reduced-motion: reduce` | No nudge, no throw, no sheet slide, no skeleton shimmer; only the 3 s fuse runs |
| Colour vision | Deuteranopia, protanopia, tritanopia, achromatopsia on card, list and results | Answers stay distinct by side, arrow and word |
| Long content | 150 character question and three word answers in EN, KO, JA at 320 and 390 | Nothing truncated |
| Money flows | Deposit, withdraw, convert, stake, claim, withdraw an unlocked stake, Cancel, Hide, failed, slow | One ledger defect (major 1) |
| Hold, offline, error | Every hold, offline and error state, retry buttons | Correct and recoverable |

## Design score: 84 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 9 | One slab headline and one blue action per view; the question, the two answers and the Undo bar read in that order on the card. Lost point: the stakes summary keeps "Staked 2,500 CT" above a list that now totals 2,000 CT |
| Layout | 8 | Rules instead of boxes hold on every screen, pinned action bars never cover a focused control. Lost points: own rank bar truncates at 320 px, Japanese sub page titles wrap and clip at 320 px, a half visible duplicate label above the pinned bar on short staking screens |
| Spacing | 8 | Even rhythm at 390 px. Lost points: a blank band of 27 to 42 px inside the card when the picture is dropped (360x640, 375x667), stat cells touching in Japanese convert at 320 px |
| Type | 9 | Besley, Hahmlet and Shippori Antique carry the same voice in three languages, tabular text figures, digits in fixed cells on countdowns. Lost point: Japanese page titles read lighter and wider than EN and KO (single weight face, as CONCEPT.md admits) |
| Colour | 9 | Blue kept to action, link, reward and own row; 0 contrast failures in 215 states; persimmon and teal stay apart under every simulated deficiency by position, arrow and label |
| Consistency | 9 | One masthead, one sheet, one field, one button family on 17 screens. Lost point: "Fee: you pay" set in the display slab on `wallet.html?state=hold` only, and a disabled primary that reads as an action ("Deposit KAIA") on `withdraw.html?state=nokaia` |
| Density | 8 | Calm by the owner's rule and still complete: every figure that matters is on the surface. Lost points: first run pages 2 and 3 and the convert page leave more than half the screen empty at 390x844 |
| Copy | 8 | Buttons name the thing ("Send 250 CT", "Stake 1,000 CT"), errors say the fix. Lost points: screen reader text "Closes in 1 hours 12 minutes", "abc" in convert answers "The minimum is 1,000P", H1 on day done is read twice |
| Mobile | 8 | 0 overflow in 1,290 pages, targets 44 px or more (exceptions: "Skip" 28x44, "Terms" 38x44), answers reachable at 320x568 and at 200% text. Lost points: the 320 px defects and the picture drop |
| Finish | 8 | Halftone pictures, stamps, hatched pending boxes, a full reduced motion answer and zero console errors. Lost points: mock ledger gaps visible to a tester (majors 1 and 2), focus drop in transaction sheets |

## Nielsen score: 36 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| 1. Visibility of system status | 3 | Live dateline, five day boxes (empty, hatched, inked), "Saving", "Saved", transaction steps, live regions. Lost point: balances and weekly figures that do not follow an action (majors 1 and 2) |
| 2. Match with the real world | 4 | Newspaper sections, plain sentences, local date formats, KRW estimates in Korean |
| 3. User control and freedom | 4 | Undo on every pick including the fifth, `Z`, Cancel while signing (fields kept), Hide while sending, Esc, scrim tap, drag the sheet down, Back on every sub page |
| 4. Consistency and standards | 3 | Same patterns everywhere. Lost point: focus leaves the dialog between transaction steps, Enter does not submit the amount fields, home tab badge says "predictions left" on Results after the day is done |
| 5. Error prevention | 3.5 | Own address, contract address and malformed address refused; required check before a send; review sheet before every transaction; double tap, held key and downward slips never pick. Lost half: a typed mixed case address with a wrong checksum is accepted |
| 6. Recognition rather than recall | 3.5 | Labels always visible, balance beside every amount, Max, Paste, the address repeated in groups of four. Lost half: no last used address |
| 7. Flexibility and efficiency | 3.5 | Swipe, tap, arrow keys, `Z`, card or list view, fix buttons that fill the valid amount |
| 8. Aesthetic and minimalist design | 4 | One question or one figure per screen, nothing decorative |
| 9. Recognise, diagnose, recover | 4 | Inline message next to the cause with the fix as a button ("Use 1,840.5 CT", "Stake 100 CT", "Deposit KAIA", "Try again"); every `error` state recovers on retry |
| 10. Help and documentation | 3.5 | Every "?" is 44x44, hittable and opens a sheet of 13 to 118 words; no critical fact is hidden. Lost half: no hint that the keyboard works on touch layouts with a keyboard attached |

## Blockers

None.

## Majors, ranked

### 1. Withdrawing an unlocked stake does not reach the wallet
- Screen and state: `stakes.html` (default). Viewport 390x844, any language.
- Reproduce: open `stakes.html`, tap "Withdraw 503.2877 CT", confirm, wait for "Withdrew 503.2877 CT. It is in your wallet.", tap Done. The row disappears, but the head still says "Staked 1,500 CT", "My stakes 2" and "Claimable 3.2877". Open `wallet.html`: Available is unchanged (measured 840.5 CT before and after, expected 1,343.7877) and Staked is unchanged. Reload `stakes.html`: the stake is back and can be withdrawn again.
- Fix: in the success handler call `App.ledger(+total, 0)`, mark the stake closed in `App.sess.data` (as new stakes are stored), and recompute the summary head and the tab count in place.
- Note: withdraw, convert and stake do agree across wallet, masthead and forms (1,840.5 to 1,590.5 to 1,591.5 with 250P left; stake 1,000 gives Available 840.5, Staked 2,500, three stakes).

### 2. The weekly figures ignore the 100P of a finished day
- Screens: `ranking.html`, `profile.html`, `results.html` after finishing the five picks. Any viewport and language.
- Reproduce: finish the day on `home.html?state=fresh`. The masthead goes from 1,250P to 1,350P, but the own rank bar still reads "27, 100P behind the top 10, 950P this week", the profile still reads 950P and Results still reads "This week 950P". A player who just earned exactly the missing 100P is told nothing changed.
- Fix: add `sess.data.paid` to the weekly points in the mock (1,050P), recompute the rank and the "behind the top 10" line from it.

### 3. Focus falls out of the transaction sheet between steps
- Screens: `withdraw.html`, `convert.html`, `staking.html`, `stakes.html`, from review to signing to sending to success. Keyboard and screen reader, any viewport.
- Reproduce: complete the review by keyboard and press Enter on "Send 250 CT". `document.activeElement` becomes `BODY` while the modal stays open, and it stays there through "Signing", "Sending" and the success view (the live region does announce each step). Tab then lands on Done.
- Fix: after each content swap call `sheet.focus()` (the sheet already has `tabindex="-1"`), and on success focus the Done button.

### 4. Undo never expires while it has keyboard focus
- Screen: `home.html`, keyboard picks. Any viewport and language.
- Reproduce: press the right arrow. Focus moves to Undo and the fuse pauses; 4.4 s later the pick is still open and Enter undoes it. It only goes final when focus leaves Undo or another pick is made.
- Why it matters: the product rule is exactly 3 seconds, then final. The pause is a deliberate accessibility allowance in the code, but it applies to every keyboard pick by default, so it needs an explicit owner decision.
- Fix options: keep the allowance only when a screen reader pick asked for it (for example a "more time" control), or let the fuse run and rely on `Z`; in both cases write the decision into STATES.md.

### 5. Own rank bar truncates at 320 px
- Screen and state: `ranking.html` default, `top10`, `unranked`, `lastweek`, `hold`. Viewport 320x568. EN, KO, JA.
- Reproduce: open `ranking.html?lang=ja` at 320x568: the status reads "トップ10まであ…". `?state=top10&lang=ko`: the prize is cut to "상" so the amount 51.36 CT is not shown. `?state=unranked`: the sentence runs under the button in all three languages.
- Fix: below 360 px let the bar take two lines (rank and points on the first, status on the second) and never ellipsize the prize.

### 6. Japanese sub page titles wrap and clip at 320 px
- Screens: `convert.html?lang=ja`, `profile.html?lang=ja`. Viewport 320x568.
- Reproduce: the masthead title ("ポイントを交換", "プロフィール") breaks onto two lines of 24 px inside a 60 px header and starts 3 px above the screen edge; the second line sits on the rule.
- Fix: step the sub page title down to 18 px with `white-space: nowrap` and ellipsis under 360 px, as the nameplate already gives way.

## Minors

7. Card picture is dropped on short screens and leaves a blank band: `home.html`, 360x640 (EN 27 px, KO 42 px gap) and 375x667 EN (34 px). The halftone picture, the signature of the concept, is absent on an iPhone SE. Fix: allow a 56 px strip crop of the picture before removing it, or close the gap.
8. A typed mixed case address with a wrong checksum is accepted as "Valid Kaia address" (`withdraw.html`, typed `0x52908400098527886e0F7030069857D2E4169EE7`); the checksum error exists only as the `sum` preset. The real app must run the EIP-55 check on every mixed case address.
9. Screen reader text on day done is stale and ungrammatical: the visible cell says "Next set in" while the hidden text says "Closes in 1 hours 12 minutes"; the H1 is read twice ("All 5 doneAll 5 done").
10. Tab badges do not follow state: on `results.html` after the day is done the Home tab still announces "predictions left today"; the Results badge "2 new answers" stays after Results was opened.
11. Enter in an amount field does nothing (`withdraw.html`, `staking.html`, `convert.html`); the "Go" key of a phone keyboard should run the same check as the primary button.
12. Back on `system.html?state=blocked` always goes to `wallet.html?state=hold`, also when the player came from Home.
13. `withdraw.html?state=nokaia`: the pinned primary is disabled yet labelled "Deposit KAIA", directly under an enabled small button with the same words. Make the pinned button the working link.
14. Small targets: "Skip" beside the invite code on `first-run.html` is 28x44; "Terms" on `login.html` is 38x44.
15. `staking.html` at 320x568: the interest label is half visible above the pinned bar while the same figure is repeated inside the bar.
16. `stakes.html?state=claimable`: after a successful claim the page still offers "Claim 263.01 CT interest" (preset state, not written back).
17. The amount fields keep junk such as "abc" or "1e3" (the button is disabled and the reason is shown); the handoff asks to refuse the key.
18. `wallet.html?state=zero` shows "Staked 0 CT" with a count of 2.
19. Review check box: the focus ring touches the first letters of its label.

## What passed

- Deck: a 60 px slow drag, a vertical drag, a mostly downward diagonal and a drag out and back do not pick; a long drag and a 70 px flick in 60 ms do. A second tap 60 ms later does not pick the next card. A tap during the first visit nudge picks at once; the nudge plays once and never again.
- Undo: present at 2.4 s and 2.9 s, gone by 3.13 s, then "Final" is announced. The fifth pick opens `done.html` after 387 ms with Undo pinned bottom right (85x44, hittable, named "Undo question 5: Yes"); Undo returns to the deck with card 5 on top and 4 picks kept; without Undo the page pays +100P and the masthead moves to 1,350P.
- Keyboard: every stop shows a 2 px blue ring (paper coloured on inverted segments, a ring around the whole field box for inputs); arrows pick, a held arrow picks once, `Z` and Enter undo, sheets trap focus, Esc closes and returns focus to the opener, the background is inert.
- Semantics: `header`, `main`, `nav` landmarks, one H1 per page, card as a named group, cards behind the top one inert, answers named "Pick No for: question", day boxes as an image with "0 of 5 answered", `aria-pressed` on segments, `aria-expanded` on result rows, `aria-invalid` and `aria-describedby` on fields, `autocomplete="one-time-code"` on the login code, correct `lang` in three languages.
- Small screens and large text: at 320x568 the two answers are fully visible with no scroll at 100%; at 130% and 200% `main` scrolls to them and nothing is lost. Long questions step down to 18 px and long answers wrap inside taller buttons; nothing is truncated in EN, KO or JA.
- Product constraints respected: little visible text, and the critical facts are still on the surface: "Locked until Feb 25, 2027. No early exit." on the stake form and again in the review, "Sends on Kaia cannot be undone" behind a required check, "Points cannot be converted back" in the convert review, "Send only on Kaia" on deposit, "Undo for 3 seconds" on the card and "Final" on the list.
- Money: address rules (format, own wallet, token contract), amount rules (over balance with "Use 1,840.5 CT", minimum with "Stake 100 CT", four decimals, full width digits and "1,000.5" parsed), Cancel while signing keeps the fields and says nothing moved, Hide while sending keeps the progress in the pinned button, failed and slow states explain and offer the next step.
- Hold, offline, error: no dead control on a held account (Home shows no deck, Convert and New stake are disabled with the reason, claims and withdrawals still work with "you pay the network fee"); offline picks answer "Connect to the internet to pick" by tap and by swipe; every "Try again" recovers.
- Three languages: no missing key, no overflow, tab labels on one line at 320 px in Japanese.
