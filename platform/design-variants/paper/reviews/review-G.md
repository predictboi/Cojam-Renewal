# Review G: Daily Paper (independent score)

Reviewer G did not build this variant and did not read `REVIEW.md` or any file in `reviews/` before scoring. Sources read: `CONCEPT.md`, `STATES.md`, the hub, and the rubric in `docs/HANDOFF.md` section 7.

## Method

- Own Playwright captures (chromium, device scale 1, touch on): all 215 states in EN at 390x844, and 78 key states in EN, KO and JA at 360x640 and 320x568, KO and JA at 390x844, EN at 375x667. 917 stills in total, viewed as labelled contact sheets. Home stills were taken 4 seconds after load.
- Extra home stills at 360x740, 360x780, 390x700, 412x915 and with the root font at 130%.
- Motion judged from own frame sequences: the first visit nudge (12 frames over 2.5 s), a touch drag to the right with release, a tap pick, Undo, the fifth pick into day done (11 frames), the rules sheet, the withdraw transaction sheet, reduced motion.
- Use by script: keyboard tab order, arrow key pick, Enter on Undo, Esc on a sheet, the amount field with six inputs, the whole withdraw flow from typing to the wallet, a list view pick.
- Touch target probe on seven screens: no control under 44x44 px. No sideways overflow in any of the 917 captures, no page error.
- Weighting: the core loop (home, pick, Undo, day done, results) at 390 and 360 wide counts most; 320x568 is an edge case; the owner's constraints (little visible text, 3 second Undo, no label on the five day boxes, interim Japanese face capped at 28 px) are respected and not penalised.

Captures and scripts: `/tmp/claude-0/-home-user-Cojam-Renewal/b3270fa9-0a00-5483-ac13-fc0e6a3d97c3/scratchpad/review-g/`.

## Design score

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 9 | One hero per screen: the question headline over two answer buttons on home, "+100P" on day done, the balance on wallet, the pool on ranking. Lost point: for the 3 seconds of the day done moment the hero slot is an empty gap. |
| Layout | 8 | Rules in place of boxes hold on every tab and the masthead, dateline, title, body order never changes. Lost points: the card picture disappears entirely at 360x640, the first run text is clipped when the invite code is open, the pinned own rank bar slices a table row. |
| Spacing | 8 | One gutter, even row rhythm, sheets and notices share one spacing. Lost points: countdown colons collide with the digits, the list row leaves the kicker stranded beside the Pick button, the empty band in the day done moment. |
| Type | 8 | Besley for headlines and figures against Pretendard for everything operated is clear and consistent; Hahmlet matches well in Korean; the interim Japanese face is handled sensibly (emboldened, 22 to 28 px, Latin numerals stay Besley). Lost points: the 44 px countdown, three faces in one ranking column, Japanese katakana titles read lighter and more slanted than their EN and KO equivalents. |
| Colour | 9 | Ink plus one blue with fixed jobs, persimmon and teal only for the two answers, red only for errors; home at rest has almost no blue, so the reward blue on day done lands. Disabled controls stay readable. |
| Consistency | 8 | One notice pattern for every empty, closed, hold and system state; one sheet; one button shape. Lost points: the nameplate words vanish on Results at 360 wide while Home keeps them, the fiat line exists in Korean only, toasts appear at the top on one screen and at the bottom on another. |
| Density | 8 | Sparse by brief and it reads as intended, not as unfinished; results and ranking are dense where a repeat player wants it. Lost points: at 360x640 the wallet's Convert button and points figure fall under the fold, first run pages are mostly empty paper around a blank placeholder picture. |
| Copy | 9 | Buttons name the thing ("Send 250 CT", "Use 1,840.5 CT", "Withdraw 250 CT"), errors say what happened and what to do, labels are 1 to 3 words in all three languages. Lost point: the success stamp "FILED" on a sent withdrawal is vague beside "Sent 250 CT". |
| Mobile | 8 | Every target 44 px or more, answers never cut at any size, tab labels stay on one line down to 320, no sideways scroll, 130% text reflows. Lost points: the 360x640 card without its picture and the clipped first run text. |
| Finish | 8 | The halftone pictures, the stamps, the stacked deck edge, the hatched "saving" box and the drag stamp with the colour wash are distinctive and well made; motion is short and purposeful. Lost points: colliding countdown colons, the placeholder illustration on first run, the half built look of the day done moment. |
| **Total** | **83 / 100** | Target 85: missed by 2. |

## Nielsen heuristics

| Heuristic | Score | Evidence |
| --- | --- | --- |
| Visibility of system status | 4 | Day boxes go hatched then inked, "Saving Q1: Yes" becomes "Saved", the masthead points spin while saving, every transaction sheet shows steps and a hash, offline banner with the last update time. |
| Match with the real world | 3 | Newspaper terms are light and never block understanding; "No. 1 of 5", "Closes in". "Extra" and "FILED" need a second thought. |
| User control and freedom | 3 | Undo after every pick, Esc closes sheets and returns focus, Cancel while signing, Hide while sending, back on every sub page. During the day done moment the primary action also means "finish now", which is not said. |
| Consistency and standards | 3 | One pattern per job across 17 screens. Masthead and toast position vary as listed above. |
| Error prevention | 3 | Review sheet with a checkbox before a send, valid address echo in groups of four, Max, amounts over the balance blocked with a fix button. The amount field silently turns "-5" into "5" and "1e5" into "15". |
| Recognition over recall | 4 | Labels always visible, balance beside every amount field, the picked answer follows as a colour block into list, done and results. |
| Flexibility and efficiency | 3 | Arrow keys pick, Enter on Undo, a list view, Max. No last used address or amount. Tab order reaches the skip link and masthead last. |
| Aesthetic and minimalist design | 4 | Very little on each screen and what is there is needed. |
| Help users recover from errors | 4 | Inline error next to the cause with the fix as a button ("Use 1,840.5 CT", "100 CT", "Deposit KAIA", "Try again"), and a failed send says nothing left the balance. |
| Help and documentation | 3 | "?" sheets on terms, the Rules sheet on each card, the first visit nudge. The nudge is the only teaching of the swipe and plays once. |
| **Total** | **34 / 40** | Target 34: met. |

## Motion (from own frames)

- First visit nudge: the card tips right showing the "Yes" stamp, then left showing "No", and settles in about 1.6 s. It teaches the gesture without words. Good.
- Drag: the card follows the finger with a slight tilt, the answer stamp fades in, and past the threshold the card takes a teal wash and the stamp inks in. The threshold is unmistakable. Good.
- After a pick: the next card is in place within 90 ms, the pick bar with Undo replaces the hint line, the day box is hatched while saving. Undo brings the card back from the side in about 300 ms.
- Undo time: the only sign of the 3 seconds running out is a 2 px ink line along the top edge of the pick bar. It is easy to miss (defect 6).
- Fifth pick: the card leaves, "That is all five" shows for one frame, then the day done page builds with a striped band and an empty hero area for 3 seconds before "Extra", "+100P" and "PAID" arrive. The pay off is strong; the wait before it looks unfinished (defect 4).
- Reduced motion: movement is replaced by a short cross fade; nothing slides.

## Defects, ranked

| # | Severity | Screen, state | Viewport, language | What | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | High | `home.html` (default, fresh) | 360x640, EN KO JA | The first card has no picture at all: the picture is the part that gives way and here it gives way to nothing, so the signature element of the concept is missing on a short 360 wide phone. At 360x740 the picture is back. | Keep a minimum picture band of about 72 px on the card (as the `partial` state already shows at this size) and take the room from the gap above the headline and from the hint line under the deck. |
| 2 | High | `home.html?state=empty` (and every large countdown) | all sizes, all languages | In the 44 px slab countdown the colons collide with the neighbouring digits ("00:07:29" reads as one smear). | Give the separator its own cell (about 0.32em wide, centred) or add 0.04em side bearing to `.dgs` at display sizes. |
| 3 | Medium | `first-run.html?state=code` | 360x640 and 320x568, EN KO JA | With the invite code field open the body sentence is cut in half behind the page dots at 360x640, and at 320x568 the headline itself is cut ("Five predictions a day" loses its second line). | Let the page scroll in this state or shrink the illustration panel first; the text must never be the part that is clipped. |
| 4 | Medium | `done.html?state=moment` | all sizes, all languages | For the 3 seconds of the last Undo window the page shows a striped band, "All 5 done", an empty hero area and "Finishing in 3"; it looks half loaded. The primary "See weekly ranking" also ends the window, which nothing says. | Show the "+100P" figure in outline or grey in its final place during the window so the layout does not jump, and label the primary "Finish now" until the window ends. |
| 5 | Medium | `results.html`, `done.html?state=results` | 360 wide, all languages | When the masthead carries the pending "+50" chip the words "Cojam Daily" drop and only the mark is left, while Home at the same width keeps the nameplate. The header changes between tabs on the most common Android width. | Shorten the chip (drop the divider, tighter padding) or move "+50" under the points so the nameplate stays at 360. |
| 6 | Medium | `home.html` after a pick | all sizes, all languages | The Undo window is shown only by a 2 px line on the top edge of the pick bar. Because the answer becomes final after 3 seconds, the time left deserves more weight. | Draw the fuse inside the Undo button (a draining fill or a 3 px bar under its label) so the time and the control are one object. |
| 7 | Medium | `withdraw.html`, `convert.html`, `staking.html` amount fields | all | Typing "-5" leaves "5" and typing "1e5" leaves "15": the field changes the meaning of what was entered without a word. | Refuse the key and say why ("Numbers only"), as the handoff rule asks; never keep a different number. |
| 8 | Medium | `ranking.html` (default, top10, unranked) | all sizes | The pinned own rank bar cuts through a table row (row 7 is sliced in half at 390x844), so the table looks clipped at rest. | Add bottom padding equal to the bar height and let the visible list end on a whole row, or fade the last 24 px. |
| 9 | Low | `home.html?state=failed` | all sizes | The "not saved" toast sits over the page title and the Cards and List switch and stays for more than 7 seconds, while the same message is already inline on the card. Other toasts sit at the bottom. | Keep the inline message with a "Try again" button on the card and drop the toast, or place it at the bottom like the others. |
| 10 | Low | `first-run.html` 1 and `code` | all sizes | The illustration is a blank grey halftone square on a card; it reads as a missing picture. | Print one of the real question pictures through the same halftone. |
| 11 | Low | `home-list.html?state=fresh` | 390 and 360, all languages | In an unopened row the kicker ("Markets") sits alone at the bottom left on the baseline of the Pick button, far from its headline. | Put the kicker above the headline as in the open row. |
| 12 | Low | `wallet.html` | 360x640, KO | The fiat line under the balance exists only in Korean and pushes the points figure and Convert under the fold. | Decide one rule for the fiat line in all languages, and tighten the address, staked and KAIA rows at this height. |
| 13 | Low | `ranking.html` | all | Player names use three faces in one column: the slab for the top three, the text face from rank 4, monospace for addresses. | Text face for all names; keep the slab for the rank numerals and the size step for the top three. |
| 14 | Low | `withdraw.html?state=success`, `staking.html?state=success` | EN | The stamp "FILED" is vague next to "Sent 250 CT". | "SENT" and "STAKED". |
| 15 | Low | every tab root | keyboard | Tab reaches the skip link and the masthead only after the tab bar. | Move focus to the top of the document after load, or place the masthead first in the order. |

## What is strong and should be kept

- The question card: kicker, halftone picture, slab headline, the worded "Rules" source line, two equal answers that differ by colour, side, arrow and word.
- The pick feedback chain: stamp on drag, colour wash at the threshold, hatched day box while saving, inked box when saved, the answer colour block that follows the pick everywhere.
- The single notice pattern with a stamp for every empty, closed, hold and system state.
- Transaction sheets: review, checkbox, signing, sending with hash, success with the new balance, then back to the wallet with the form cleared.
- Korean and Japanese are first class: no clipped label, no broken line, at any of the four sizes.

## Verdict

**Ready to apply to the real app: yes, after fixes.** Design 83 of 100 (target 85, missed by 2), usability 34 of 40 (target met). Defects 1 to 5 are small, local changes and would be enough to pass the design target; 6 to 8 should go in the same round because they touch the final answer rule and money fields.
