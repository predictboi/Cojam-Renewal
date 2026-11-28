# Review E: Daily Paper (independent, unanchored)

Reviewer E did not read `REVIEW.md` or any other file in `reviews/` before scoring. Read: `CONCEPT.md`, `MOTION.md`, `STATES.md`, `COPY.md` (first part), and the rubric in `docs/HANDOFF.md` section 7.

## Method

- Own Playwright captures (chromium, deviceScaleFactor 1, touch context) at 390x844, 375x667, 360x640 and 320x568 in EN, KO and JA. About 190 stills across all 17 screens, viewed as side by side sheets.
- Home stills taken 4.3 to 4.5 s after load (after the first visit nudge).
- Motion judged from own frame sequences: drag (proof stamp, pressed stamp, wash), throw, Undo return, tap pick, the fifth pick moment (8 frames over 6 s), result stamps, sheet rise, ranking rows, first visit nudge.
- Used, not only looked at: mouse drag past and under the threshold, tap pick, Undo by button and by Z, arrow key pick, Tab order with focus ring, Escape on a sheet with focus return, hit testing of Undo against the tab bar (`elementFromPoint`), a script for touch targets under 44 px, text under 12 px and sideways overflow on 17 screens at 390 and 320.
- Scripts and captures: `/tmp/claude-0/-home-user-Cojam-Renewal/b3270fa9-0a00-5483-ac13-fc0e6a3d97c3/scratchpad/review-e/`
- Product owner constraints respected and not penalised: very little visible text with explanations behind "?", the 3 second Undo window, English default with KO and JA, the interim Japanese display face (only its present handling is judged).

## Design score

| # | Criterion | Score | Evidence |
| --- | --- | --- | --- |
| 1 | Hierarchy | 9 | Every root screen has one lead: the question on home, "+100P" on day done, the balance on wallet, the interest figure on staking, rank 1 on the table. Only the wallet sets two equal 56 px figures (CT and points) against each other. |
| 2 | Layout | 8 | The rule system (thick and thin masthead rule, ink section rules, hairlines, column rules) holds on all 17 screens. Losses: an empty band of about 80 px inside the card at 375x667, in tab empty states are centred while system screens are left aligned, and three collisions at 320. |
| 3 | Spacing | 8 | Rhythm is even at 390. It degrades at 320 (results in JA: title, stats, segments and legend touch), the open list row leaves a hole between headline and kicker, and "Fee: you pay" on the wallet hold state hangs under its row. |
| 4 | Type | 7 | Besley plus Pretendard is excellent in EN, Hahmlet matches it well in KO, and ticking figures do not shake. In JA every title at 32 px and above is the lightest thing on its screen and collides with heavy Besley letters and numerals inside the same line ("ポイントをCTに", "毎日予想してCTをもらおう", "1日5問の予想"). One Korean headline breaks before a particle. |
| 5 | Colour | 9 | Black, one blue, persimmon and teal keep their jobs almost everywhere; the answer inks are balanced; status colours appear only for status. Small leaks: the sent or converted amount on success sheets is blue although it is not a reward, and day totals in results are black although they are rewards. |
| 6 | Consistency | 8 | Patterns repeat faithfully (segments, underlined view words, "?" boxes, fields with an attached action, review sheets). The promise "a frame means a control" is broken by the list thumbnails, the no image tile, the stake progress track, toasts and the gate example card. "A zero is never a hero" holds on staking (grey "0 CT") but not on wallet and convert (black 56 to 88 px zeros). |
| 7 | Density | 8 | Home, day done, wallet, convert and staking read at a glance. Results is heavy: "+50P if hit" repeats on every waiting row. My stakes and the gate are long. |
| 8 | Copy | 9 | Short labelled facts, plain errors that say what to do, critical facts kept in ink ("No early exit", "Fee: you pay"). Small repeats: the same error under the field and inside the disabled button on convert, and "Prizes sent." twice on ranking. |
| 9 | Mobile | 7 | 44 px targets everywhere (only the two legal links are narrower), no sideways overflow in 130 pages checked, pinned bars behave. But at 320x568 the Undo button sits behind the tab bar after a pick in all three languages, the swipe hint is cut, and 375x667 shows the card void. |
| 10 | Finish | 8 | It looks designed: halftone pictures, stamps, the press band, the fuse, the tilt of the toast. The generic remnants are the empty state template (icon tile, centred headline, button) used on eight states, and the three icon benefit rows on login and gate. |
| | **Total** | **81 / 100** | Target 85: not reached. |

## Usability score (Nielsen)

| # | Heuristic | Score | Evidence |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 4 | Dateline countdown, five day boxes (empty, hatched, inked, red frame on failure), fuse, "Saving Q1", masthead "+50" on the way, offline banner with last update time. |
| 2 | Match with the real world | 4 | Newspaper terms map cleanly (Extra, stamps, box scores), plain words for chain concepts, grouped addresses. |
| 3 | User control and freedom | 3 | Undo by button, Z and Backspace; sheets close by Escape, Cancel and scrim, focus returns to the opener; a failed drag springs back. Undo is out of sight at 320x568. |
| 4 | Consistency and standards | 3 | Two view switch patterns used as specified; frame rule and zero rule have the exceptions listed above; Tab order visits content and tab bar before the masthead. |
| 5 | Error prevention | 4 | Address validation with regrouped echo, own address and contract states, review sheet with a required checkbox on withdraw, "cannot be converted back" on convert, tap guard of 400 ms after a pick, slope rule on drags. |
| 6 | Recognition rather than recall | 3 | Explanations sit behind "?" (accepted constraint). The five day boxes have no visible label, and the pick bar message on day done showed only a tick in my run. |
| 7 | Flexibility and efficiency | 3 | Arrow keys, list view preference, Max, Paste, one tap fixes ("Stake 100 CT", "1,000P 입력"). |
| 8 | Aesthetic and minimalist design | 4 | One figure or one action per screen on almost every root. |
| 9 | Help users recover from errors | 4 | Every error names the cause and offers one action; money errors say that nothing left the balance. |
| 10 | Help and documentation | 3 | "?" sheets, "Rules" on each card, Help sheet in profile, a full account on hold page. No visible entry to the rules from the list view rows that are closed. |
| | **Total** | **35 / 40** | Target 34: reached. |

## Motion (from frame sequences)

- Drag: the dashed proof stamp appears at about 20% travel, fills with the answer ink past the threshold, the card takes a wash, the day box hatches on release. The next sheet stays blank until it rises. Clear and physical.
- Undo: the card returns from the side it left with a small overshoot; box 1 inks in only after the 3 seconds. Focus on Undo held the fuse for 4 s as specified.
- Fifth pick: press band, letters set, "Finishing in 3, 2", then band inks to "Extra", "+94P" counting to "+100P", masthead 1,250P to 1,350P, PAID stamp, dateline turns to "Next set in". No layout shift across 8 frames. This is the best sequence in the product.
- Weak points: the fuse (3 px) lies directly on the tab bar's top rule beside the 4 px current tab bar, so the two read as one line; at 320 with no picture the proof stamp lands on top of the headline.

## Defects, ranked

| # | Severity | Screen, state | Viewport, language | What | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | High | Home cards, after any pick | 320x568; EN, KO, JA | The pick bar is below the fold of the scrolling main area: Undo spans y 524 to 568 in JA (tab bar starts at 508, fully hidden), 488 to 532 in EN and 480 to 524 in KO (half hidden; `elementFromPoint` at its centre returns a tab link in EN and JA). With a 3 second final window the player cannot see or reach Undo without scrolling. | Pin the pick bar above the tab bar (as on day done, where it is visible at 320) and let the deck take the remaining height, or scroll the pick bar into view at the moment of the pick. Add this case to `small-check.js`. |
| 2 | High | Login, first run 1 and 3, gate hero, system screens, page titles (Wallet, Staking, Results, Ranking, Profile) | all widths; JA | At 32 px and above the Japanese face runs at its single light weight. The title is lighter than the section heads under it, and Besley 800 letters and numerals inside the same line ("CT", "1", "5") look like another font pasted in. | Until the licensed heavy face arrives, do not mix weights in one line: either keep the synthetic bold at page title size with a slightly smaller size (32 px instead of the stepped up size) and looser tracking, or set JA page titles in Pretendard JP 800 and keep Shippori for 26 px and below. Lower Latin and numerals in JA titles to a matching weight (Besley 500 to 600) if the light face is kept. |
| 3 | Medium | Home cards, default | 375x667 (and 360x640 less so); EN, KO | The picture is dropped below 96 px and the freed height stays inside the card as a blank band of about 80 px between the source line and the answers. | Under 96 px give the room to something useful: a 56 to 72 px picture strip, or step the headline up one size, or shorten the card and centre the deck. |
| 4 | Medium | Home cards, first load | 320x568; EN (KO touches) | The hint "Swipe the card or tap an answer" is cut in half by the tab bar. | Same fix as defect 1 (pinned bar), or drop the hint under 600 px height since the card line and the nudge already teach it. |
| 5 | Medium | Ranking; convert; profile | 320x568; EN, JA | Ranking: "1,284 CT" runs into "How prizes work" and the own bar text is ellipsed. Convert: "1,000P = 1 CT" touches the column rule before "None", title wraps to two lines. Profile JA: the third stat wraps with a stray leading rule. | Ranking: put the link under the figure below 360 px. Convert: stack the three facts as rows below 360 px (the rule CONCEPT already states). Profile: remove the rule on a wrapped cell. |
| 6 | Medium | Invite, headline | 390x844; KO | "친구가 받는 포인트의 10% / 를 나도 받아요." breaks between "10%" and its particle. | Wrap "10%를" in a no break span (the same for any figure plus particle in KO display text). |
| 7 | Medium | Empty and blocked states (home empty, closed, other device, hold; results empty; stakes empty) | all | The icon tile, centred headline, body, button block is the stock empty state and the least "paper" part of the product; system screens use a left aligned version of it. | One notice pattern in the paper's own language: left aligned under a section rule, headline in the slab, no icon tile, or a stamp ("Closed", "On hold") in place of the tile. Use it for both tab and system screens. |
| 8 | Low | List thumbnails, no image tile, stake progress track, toast, gate example card | all | Static things carry the ink frame that is reserved for controls. | Thumbnails and the no image tile: drop the frame (the halftone ground is enough). Progress track: hairline in `--line`. Example card: mute the answer blocks or make them work. |
| 9 | Low | Wallet zero, convert wait, paused, cap | all | A black hero zero ("0 CT" at 56 to 88 px) contradicts the zero rule that staking follows. | Apply the grey plain zero everywhere. |
| 10 | Low | Convert step, above; staking below | all | The error sentence appears under the field and again inside the disabled primary button (two lines in KO). | Keep the sentence under the field; the disabled button keeps its verb ("Convert"). |
| 11 | Low | Home, pick bar | all | The fuse sits on the tab bar's top rule and merges with the current tab marker. | Run the fuse along the top edge of the pick bar or inside the Undo button (as the list view does). |
| 12 | Low | Results, waiting rows | all | "+50P if hit" on every waiting row adds 15 repeats on the first screenful. | Say it once in the day head ("5 waiting, +50P each if hit"). |
| 13 | Low | Home list, open row | KO, JA | The kicker sits under the headline with a gap set by the thumbnail height; on the card it sits above. | Put the kicker above the headline, as on the card. |
| 14 | Low | Success sheets (convert, withdraw, stake) | all | The amount is set in blue although it is neither an action nor a reward. | Ink for the amount; the stamp alone carries the blue. |
| 15 | Low | Ranking, sent | EN | "Prizes sent." shows in the notice and again as a tag beside "Last week". | Keep the notice with the link; drop the tag. |

## What is strong and should be kept

- The front page card at 390x844 in all three languages, and the Korean display pairing throughout.
- The pick interaction: stamp, wash, hatched box, fuse, Undo return; keyboard parity with focus held on Undo.
- The fifth pick moment with no layout shift.
- The ranking table, the staking rates control, the withdraw review with the regrouped address and the checkbox.
- Error and hold copy: plain, specific, one action.

## Verdict

**Ready to apply to the real app: yes after fixes.** Design 81 / 100 (target 85 not reached), usability 35 / 40 (target 34 reached). Defects 1 and 2 must be fixed before the system is applied: the first hides the only way back inside an irreversible 3 second window on the smallest phones, the second makes the Japanese edition look unfinished on its first three screens. Defects 3 to 7 are what stands between this score and 85.
