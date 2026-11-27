# Review B: task flow, accessibility and robustness

Concept A "Daily Paper", static prototype in `platform/design-variants/paper/`. Reviewed on 2026-11-27 between 18:00 and 19:50 while the folder was being edited, so every finding below was rechecked against the files as they stood at about 19:45. Two things I had found earlier were already fixed by then and are not listed (the 22 px jump of the primary button during the reward, and the 24 px wide view switch).

Method: Chromium through Playwright with real touch events (CDP `Input.dispatchTouchEvent`), 390x844 and 360x780 first, then 320x568, 360x560, 360x640, 375x667, 390x664, 430x932, 390x1200 and 844x390. Korean first, then English and Japanese. All 215 states of `assets/states.js` were opened in KO 390, KO 360, EN 390, JA 390, EN 320 and JA 320 and measured for overflow, clipped text, targets and script errors (no script errors anywhere). Keyboard only runs, the real Chromium accessibility tree, `prefers-reduced-motion`, root font size at 130% and 200%, long strings injected into the mock, vision deficiency emulation, `tools/design/audit.js` on 21 screens in three languages, blocked fonts and a throttled network. Captures and scripts: `/tmp/claude-0/-home-user-Cojam-Renewal/b3270fa9-0a00-5483-ac13-fc0e6a3d97c3/scratchpad/review-B/`.

## Verdict

**Ship as the product direction: yes after fixes.** The concept is strong, the copy is honest, the states are unusually complete and the semantics are far above the usual prototype. It misses both targets today because of one blocker (the answer buttons disappear on short phones) and a group of robustness failures around small widths, larger text, the 3 second Undo and keyboard focus. None of them needs a change of concept.

## Scores

Scale A: ten design criteria, 10 points each (target 85). Scale B: Nielsen's ten heuristics, 4 points each (target 34).

| Screen | A (100) | B (40) | What holds it back |
| --- | --- | --- | --- |
| Log in and first run | 84 | 33 | Language switch clipped at 320, Skip is 28 px wide, no banner landmark |
| Home, card view | 78 | 27 | Answer buttons clipped on short screens, 3 s Undo is the only correction, headline clamp |
| Home, list view | 82 | 31 | Same Undo rule, a picked row has no way back, black thumbnails differ from the card |
| Day done (reward) | 87 | 34 | Double announcement, dateline disagrees with home afterwards |
| Results | 85 | 34 | Heading order in the summary, collapsed details stay in the reading order |
| Weekly ranking | 83 | 32 | Names clipped at 320, own bar says nothing about eligibility |
| Staking (new stake, my stakes) | 85 | 33 | Focus hidden under the tab bar, 11.5 px text, full width digits rejected |
| Wallet, deposit, withdraw | 85 | 34 | Tags collide with big figures, 22 px checkbox |
| Convert points | 82 | 31 | The disabled action gives the wrong reason in the wait, cap and paused states |
| Profile and invite | 81 | 31 | Language switch buried, scroll lost on change, duplicate names accepted, empty name saved silently |
| Account on hold, system screens | 84 | 34 | Hold page has no back and no tab bar |
| **Whole product** | **82** | **31** | |

Whole product, scale A: hierarchy 9, typography 9, colour discipline 9, spacing rhythm 8, component consistency 8, brand character 9, affordance 7, motion 8, density 7, polish 8.

Whole product, scale B: visibility of system status 4, match with the real world 3, user control and freedom 2, consistency and standards 3, error prevention 3, recognition over recall 3, flexibility and efficiency 3, aesthetic and minimal design 4, help users recover from errors 3, help and documentation 3.

## Blocker

**B1. The two answer buttons are cut off on short screens (home, card view).**
Place: `home.html`, every state with a card, element `.qcard .choices`.
Evidence: the deck takes the height that is left and the card has `overflow: hidden`, so when the content is taller than the card the buttons fall outside it. Measured (card bottom against buttons bottom):

| Viewport | Language and state | Card bottom | Buttons | Result |
| --- | --- | --- | --- | --- |
| 320x568 | KO, EN, JA, `partial` | 444 | 450 to 541 | Not visible at all |
| 360x560 (360x640 with browser bars) | KO, EN, JA, `partial` | 436 | 435 to 526 | Not visible or a 1 px sliver |
| 360x640 | EN `partial` | 516 | 472 to 526 | Bottom 10 px cut, labels sliced |
| 360x640 | KO, EN, JA `failed`, `offline`, `slow` | 516 | 481 to 600 | Cut or gone |
| 375x667 | KO, EN, JA `offline`, `slow`; EN, JA `failed` | 543 | 490 to 585 | Cut or gone |
| 844x390 (landscape) | EN `partial` | card is 82 px tall | 442 to 496 | Gone |

The buttons are also the only place that says what left and right mean, so on these screens a swipe is a blind pick. 360x640 is one of the most common Android sizes and every in browser first visit (before install) loses another 56 to 80 px. Any banner (offline bar, slow banner, "not saved" note) pushes larger phones over the edge too.
Fix: the buttons must be the last thing to give way. Take `.choices` and the fine print out of the clipped flow (pin them to the card bottom with `margin-top: auto` and let the picture shrink to zero, then the kicker row, before anything else), set a minimum deck height and let the page scroll below it, and fall back to the list view when the viewport is under about 600 px tall or in landscape. Add 360x560, 360x640 and 375x667 in the `offline` and `slow` states to `tools/flow-test.js` so it cannot return.

## Majors, ranked

**M1. Small widths and larger text clip the masthead and the language switch.**
- 320 px, all languages, every tab root: the profile button sits at x 282 to 326, so 6 px are outside the screen. `login.html` and `gate.html`, 320 px: the language select sits at 290 to 340, only "日本" is readable.
- 360 px, KO and JA, `results.html` and `done.html?state=results` (points pill with the "+50" tag): profile button at 319 to 363. With a seven digit balance it sits at 350 to 394 (KO, EN) and 354 to 398 (JA).
- 360 px with root font at 130% (a common "large text" setting): profile button at 342 to 386 on every tab root in KO and JA, so the only route to language, name, invite and log out is cut in half. Japanese tab labels break inside a word ("ランキン / グ", "ウォレッ / ト"). The line that says when the answer is set is cut with an ellipsis ("내일 오후 6시 이후 AI가 정답…").
- 390 px with root font at 200%: points pill and profile button are fully off screen (352 to 525), the three results figures overlap ("9,850P" runs into "+50P"), the grouped withdraw address loses its last group, the tab labels touch, sub page titles become "Wit…", and in English the card buttons leave the card again.
Severity: major (WCAG 1.4.4 and 1.4.10 fail).
Fix: let the masthead give way in a fixed order (nameplate text first, then the mark only, never the two buttons), `min-width: 0` on the nameplate and `flex: none` on the buttons; cap the pending tag inside the pill; make the tab bar labels `white-space: nowrap` with a smaller step for JA; let the results summary and the address wrap; never truncate the "answer set after" time.

**M2. A pick can be corrected for 3 seconds and never again.**
Place: `home.html` and `home-list.html`, the pick bar and the row Undo.
Evidence: after the fuse a pick is sent and the list row reads "Chose Yes" with no control (0 buttons in the row). Five taps 450 ms apart answered all five questions in 2.2 seconds, every one accepted. The screen reader message is "Picked Yes. 4 left. You can undo for 3 seconds.", which takes longer than 3 seconds to speak, so a blind player hears about the Undo after it is gone. The Undo button comes after both visible cards in the tab order; only the Z key reaches it in time. Leaving the screen inside the window sends the pick at once. A mostly diagonal drag (160 px across, 150 px down) also picked.
Severity: major (heuristics 3 and 5, WCAG 2.2.1 Timing Adjustable: a limit under 20 seconds with no way to extend it).
Fix: keep the fuse as the fast path, and let a pick be changed from the list view until the set closes (or at least until the answer window opens); if the product rule must stay "final after sending", make the window 10 seconds for keyboard and screen reader use, stop the fuse while Undo has focus or a finger is on it, announce "Undo, 3 seconds" first and the rest after, and move Undo directly after the card in the DOM.

**M3. Keyboard focus disappears under the tab bar.**
Place: every scrolling screen. Evidence at 390x844: `stakes.html` "Withdraw 503.2877 CT" focused at y 792 to 844 while the tab bar starts at 784; `profile.html` language buttons at 770 to 814; `results.html` "Show earlier days" at 800 to 844; `wallet.html` "Token info" at 770 to 818. The ring is drawn but it is behind the bar.
Severity: major (WCAG 2.4.7, and 2.4.11 in 2.2).
Fix: `scroll-padding-bottom: calc(var(--tab-h) + var(--pin-h, 0px) + 16px)` on the scroller, plus `scroll-margin-bottom` on focusable rows.

**M4. Long questions and long answers break the card.**
Place: `home.html` card, 360x780. Evidence with a 65 character Korean question and a 125 character English one: the headline is clamped to 3 lines and ends in "…", so the player bets on a question that cannot be read in full in card view (the list view shows all of it). Answers of 12 to 18 characters wrap to 3 lines in a 54 to 62 px button and the last line is sliced ("10°C or more, dry").
Severity: major, because the text comes from the server.
Fix: never clamp the question; shrink the picture instead and step the size down again for long titles; give the buttons `height: auto` with two lines at most and a rule for the authoring tool (question up to 60 characters in KO and JA and 90 in EN, answers up to 10 and 16).

**M5. The disabled action gives the wrong reason.**
Place: `convert.html?state=wait`, `cap`, `paused`, all languages. Evidence: the field is disabled and the pinned button reads "Enter points to convert" (KO "전환할 포인트를 입력하세요"), which the player cannot do. The `hold` state does it right ("Converting is paused"). The same pattern on `withdraw.html`: "Enter address and amount" while the real problem is "This is your own Cojam wallet".
Severity: major for convert (the too new and capped cases are exactly where people are confused), minor for withdraw.
Fix: the button states the blocker: "Available from Dec 1", "Limit reached, back at 09:00", "Fix the address".

**M6. Short flicks spring back.**
Place: `home.html` deck. Evidence with 16 ms touch frames: 80 px in 96 ms (0.83 px/ms) returned, 100 px in 96 ms picked, 75 px in 48 ms picked. The fling rule is 96 px at 0.5 px/ms or 56 px at 1.1 px/ms, so a normal thumb flick of 60 to 90 px is refused while a slow drag needs 125 px.
Severity: major for the core gesture on a phone held in one hand; nothing is lost when it fails, which is why it is not higher.
Fix: accept 48 px at 0.6 px/ms, and use the peak speed of the last 100 ms rather than the average.

## Smaller issues

| # | Place | Evidence | Fix |
| --- | --- | --- | --- |
| 1 | `first-run.html`, all languages | "Skip" link and button are 28x44 | Pad to 44 wide |
| 2 | `ranking.html?state=sent` | "View on Kaiascan" link is 108x16 | 44 px tall row |
| 3 | `login.html` | Terms and Privacy links are 38 and 84 wide inside a sentence; fine by the inline exception, tight for thumbs | Put them on their own line |
| 4 | `withdraw.html?state=review` | The required checkbox is 22x22 (its label is the real target) | Draw the box at 24 and keep the whole row tappable |
| 5 | `stakes.html` | 11.52 px text (the "CT" unit), under the 12 px floor of CONCEPT.md | 12 px |
| 6 | Ranking, 320 px and at 130% text | Names cut to 82 px: "dal…", addresses lose their end, the "You" tag squeezes "minji" | Give the name column the free space, drop the points column first |
| 7 | Sub pages at 320 px | Titles cut: "Convert points", "Invite friends", "Withdraw CT", "ポイントを交換" | Smaller title step or two lines |
| 8 | `done.html?state=zero`, 320 px | Dateline "Loading the new set" runs past the edge | Allow the live cell to wrap |
| 9 | Home after the day is done | Dateline still says "Closes in" while the done page says "Next set in" | Same cell on both |
| 10 | Home tab link | Accessible name is "predictions left today Home" | "Home, predictions left today" |
| 11 | Dateline countdown on tab roots | Each digit is its own element and is exposed as "0 4 : 4 8 : 0 3" (the done page has a hidden clock and a spoken alternative) | Use the done page pattern everywhere |
| 12 | Reward | Two live regions speak at once: "+100P added to your points" and "+100P paid" | One message |
| 13 | Results | The H1 contains the "?" button; summary reads figure before its label ("950P", then heading "This week"); closed rows keep their details in the reading order | Button outside the heading, label first, `hidden` on closed panels |
| 14 | Login and first run | No banner landmark, the nameplate is loose text in `main` | `header` around the nameplate and language |
| 15 | Convert and staking amounts | Full width digits ("１０００", normal with a Japanese keyboard) give "The minimum is 1,000P" | Normalise to ASCII digits before parsing |
| 16 | Profile name | An empty name saves with "Name saved." and the address appears; "dalgona", the name of rank 1, is accepted | Say "Name removed, your address is shown"; refuse names already on the board |
| 17 | Profile language | The switch is in the fourth section; changing it reloads to the top (scroll 0) | Keep the scroll position and focus the switch; consider a globe in the profile header |
| 18 | Home, list view | Thumbnails are printed white on black while the card picture is black on paper | One treatment |
| 19 | Wallet with large figures | "1,000P = 1 CT" and "+50P, 22:10" tags touch with no gap; the third profile figure "9,876,543P" is cut at 360 | Gap and wrap |
| 20 | Ranking own bar | Says "100P to the top 10" but not whether I am eligible (3 days played, account older than 7 days are only in the "How prizes work" sheet) | One line of status in the bar or the sheet opened from it |
| 21 | Retry toast | Leaves after 8 seconds; the card keeps "Not saved. Pick again." so nothing is lost | Keep the toast until acted on |
| 22 | `hold.html` | No back, no tab bar; only "Open wallet" leads out | Back to where the player came from |
| 23 | Loading on a slow line (50 KB/s, 400 ms) | Blank paper for 8.8 s, first card after 23 s: the shell is built by script and 300 KB of script and styles load first, three languages in one file, fonts from two outside hosts | Static masthead and skeleton in the HTML, one language per file, self hosted fonts in the PWA cache |
| 24 | Landscape | Not locked and not usable (see B1) | Lock in the manifest or reflow |
| 25 | Stake withdraw | "Withdraw 503.2877 CT" goes straight to signing without a review; acceptable because it lands in the player's own wallet | Keep, but show the destination in the sheet |

## WCAG 2.1 AA checklist

| Criterion | Result | Note |
| --- | --- | --- |
| 1.1.1 Non-text content | Pass | Icons hidden, pictures decorative, QR and progress boxes named |
| 1.3.1 Info and relationships | Pass with notes | Landmarks, headings, groups, lists present; smaller issues 13 and 14 |
| 1.3.2 Meaningful sequence | Pass | Only the top card is exposed (checked in the real tree, the stack is `inert`) |
| 1.3.4 Orientation | Fail | Landscape shows no answer buttons |
| 1.3.5 Identify input purpose | Pass | `email`, `one-time-code`, `nickname` set |
| 1.4.1 Use of colour | Pass | Answers differ by side, arrow and word; stamps by word, frame and fill; marks by fill and dash |
| 1.4.3 Contrast (text) | Pass | `audit.js` on 21 screens in KO, EN, JA: 0 under 4.5:1 |
| 1.4.4 Resize text | Fail | M1: content lost at 130% and 200% root size |
| 1.4.5 Images of text | Pass | |
| 1.4.10 Reflow | Fail | 320 px: profile button and language select clipped, B1 |
| 1.4.11 Non-text contrast | Pass | Answer fills are 2.3:1 and 2.6:1 on the sheet but carry an ink edge; field edges 3.9:1 |
| 1.4.12 Text spacing | Not tested | |
| 1.4.13 Content on hover or focus | Pass | Nothing appears on hover; no `title` tooltips |
| 2.1.1 Keyboard | Pass | Arrows pick, Z and Backspace undo, Enter and Space on every control, sheets reachable |
| 2.1.2 No keyboard trap | Pass | Sheets trap and release with Escape, focus returns to the opener |
| 2.1.4 Character key shortcuts | Fail (minor) | Z undoes with no way to turn it off; it is ignored in fields |
| 2.2.1 Timing adjustable | Fail | M2: 3 second Undo |
| 2.2.2 Pause, stop, hide | Pass | The press and spinner loops are short or status; countdowns are information |
| 2.3.1 Three flashes | Pass | |
| 2.4.1 Bypass blocks | Pass | Skip link on every screen |
| 2.4.2 Page titled | Pass | Per screen, per language |
| 2.4.3 Focus order | Pass with note | Home starts in the card on purpose; Undo is late (M2) |
| 2.4.4 Link purpose | Pass | |
| 2.4.6 Headings and labels | Pass | |
| 2.4.7 Focus visible | Fail | M3: ring hidden behind the tab bar; the ring itself is clear (fields use the box) |
| 2.5.1 Pointer gestures | Pass | Every swipe has a button |
| 2.5.2 Pointer cancellation | Pass | Drag back under the threshold cancels; taps act on release |
| 2.5.3 Label in name | Pass | "Pick Yes for: …" contains "Yes" |
| 2.5.4 Motion actuation | Pass | None |
| 2.5.5 Target size (AAA, project rule 44) | Fail (minor) | Smaller issues 1, 2, 4 |
| 3.1.1 Language of page | Pass | `lang` follows the choice |
| 3.1.2 Language of parts | Pass | Language buttons carry `lang`, nameplate `translate="no"` |
| 3.2.1 and 3.2.2 On focus, on input | Pass | Language change reloads on an explicit press |
| 3.3.1 Error identification | Pass | Text, icon, `aria-invalid`, `aria-describedby` |
| 3.3.2 Labels or instructions | Pass | |
| 3.3.3 Error suggestion | Pass | "Use 1,840.5 CT" fix buttons, typo and provider help; except M5 |
| 3.3.4 Error prevention (financial) | Pass | Stake and withdraw are reviewed, withdraw needs a check, failures say nothing was taken |
| 4.1.2 Name, role, value | Pass | `aria-pressed`, `aria-expanded`, `aria-current`, dialog named by its heading |
| 4.1.3 Status messages | Pass with notes | Toasts, picks, saves, copies and the reward are announced; smaller issues 11 and 12 |
| Reduced motion | Pass | No animation runs except the 3 s fuse and the spinner, both information |
| Real offline, service worker, install | Not tested | The prototype shows offline as a state only; it does not react to the browser going offline |
| Real screen reader (VoiceOver, TalkBack) | Not tested | Tree read through Playwright and CDP only |

## Task walk through (what a first time user meets)

- Log in, code, setting up: clear, one field per step, errors say what to do ("Check the latest email from Cojam"), resend timer visible. Good.
- First run with an invite code: optional, unknown code explained with "Continue without a code" and the 24 hour rule. Good.
- Five questions: slow drag cancels, drag past the mark and back cancels, the proof stamp never shows a pick it would not make, double tap 60 ms apart makes one pick, leaving and coming back keeps the picks and says "Pick saved". Failures are B1, M2, M4 and M6.
- Reward: 2.2 seconds, skippable, points count up, nothing blocks input, reduced motion gives the end state at once. Good.
- When hit points arrive: the masthead "+50" tag, the results summary ("Pending, 22:10"), the row and the "?" sheet all agree. Good.
- Rank and prize: own bar pinned with "100P to the top 10", prize table one tap away. See smaller issue 20.
- Convert: steps of 1,000P, cap and waiting period explained with a date. See M5.
- Stake: rate, interest, unlock date, "No early exit" before and inside the review. Clear promise.
- Find stakes, deposit, withdraw: grouped full address, contract and own address refused with reasons, fee and KAIA shown, required check. Good.
- Name and language: works, see smaller issues 16 and 17.
- Invite: code, link, share with a copy fallback, results. Good.
- Account on hold: the best screen of its kind I have reviewed: what still works, what is paused, who pays fees, how to appeal.

## What must be kept

- Every answer colour is doubled by side, arrow and word, and every result by word, frame and fill: the screens survive protanopia, deuteranopia, tritanopia and full grey without loss.
- The proof stamp that only fills once a release would pick, and the drag that cancels cleanly.
- Honest status everywhere: hatched box while saving, inked when saved, "Not saved. Pick again." on the card itself.
- Error messages with a one tap fix ("Use 1,840.5 CT") and failures that say "Nothing was taken from your balance".
- The withdraw review with the grouped address and the required check, and the refusal of contract addresses.
- Semantics: skip link, landmarks, named groups per question, `inert` stack, focus trap and return in sheets, live regions for picks and money.
- Reduced motion that removes show and keeps information.
- The hold page and the "other device" page.
- The dateline as the one place for time.

## Top five fixes

1. Make the answer buttons impossible to clip (B1), and test 360x560, 360x640 and 375x667 with banners.
2. Make the masthead, login language switch, tab bar and summaries survive 320 px and 130% to 200% text (M1).
3. Give a second chance after the 3 second Undo, and make the window usable with a keyboard and a screen reader (M2).
4. Keep keyboard focus clear of the tab bar and pinned bars (M3).
5. Never truncate the question, fit long answers (M4), and make disabled actions state the real blocker (M5).
