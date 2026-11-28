# Cojam Daily: UI component review

Independent review of every UI component of the mock build served at `http://localhost:4190`, entered as an installed app (`/?standalone=1&lang=en` or `lang=ko`) in a mobile Playwright context (touch, deviceScaleFactor 1). Date: 2026-11-28. Languages: English and Korean. Sizes: 390x844 and 360x640, with 320x568 as an edge check.

## How it was checked

| Pass | What ran | Volume |
| --- | --- | --- |
| Sweep 1 | Every route and `?state=` preset from `e2e/walk.cjs`: a capture, every control's box, border, radius, type, colours, `elementFromPoint` at its centre, text contrast of every text node, framed static elements, clipping, console and network | 177 states x 2 languages x 3 sizes = 1,062 page loads |
| Sweep 2 | Same matrix: every control scrolled into view and hit tested at three points, number and unit line breaks by text range, icon sizes, component size signatures | 1,062 page loads |
| Keyboard | Tab walk over 20 screens, the focus indicator of every stop | 204 stops per language, 408 in total |
| Interaction | Pick and Undo by touch, drag stamps, the five pick flow to day done, 13 info sheets (open, Escape, scrim tap, grip drag), toasts, pressed state of 27 control types, long content injected into rows, pills, tabs and buttons | EN 390, KO 390, KO 360, EN 320, and EN 390 with reduced motion |

Evidence folder (called SCR below): `/tmp/claude-0/-home-user-Cojam-Renewal/b3270fa9-0a00-5483-ac13-fc0e6a3d97c3/scratchpad/app-review-ui/`. Captures are in `SCR/shots/<lang>-<width>/<screen>-<state>.png`, interaction captures in `SCR/shots/int-*.png` and `SCR/shots/flow-*.png`, raw data in `SCR/sweep-*.json`, `SCR/p2-*.json`, `SCR/focus-*.json`, `SCR/inter-*.json`.

## Result in numbers

- Components checked: 58. Passed: 36. With at least one defect: 22.
- Defects: 23. Blocker 0, high 0, medium 5, low 18.
- Console errors: 0. Page errors: 0. HTTP errors: 0. Failed requests: 1 (`/assets/workbox-window.prod.es5-BBnX5xw4.js`, `net::ERR_ABORTED`, once, EN 320 `/login?state=offline`; an aborted navigation, not reproducible in the other 2,123 loads).
- Automated findings that came back clean on all 1,062 loads: no control under 44x44 (smallest: the Terms and Privacy links on Login at 43.5 px high), no text under 4.5:1 (the only hit was a countdown digit caught in the middle of its 0.25 opacity tick), no text under 12 px, no horizontal page scroll, EN and KO render the same set of controls in all 177 states.

## Inventory

| # | Component | Where used | States checked | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Primary button (`.btn-primary`) | every screen, sheets, pinned action bar | default, pressed, focus, disabled, busy, done ("Copied"), long KO label | pass |
| 2 | Secondary button (`.btn`, `.btn-sm`) | Wallet, Invite, notices, list view "Pick", sheets | default, pressed, focus, disabled, done | pass |
| 3 | Text button (`.btn-ghost`, `.btn-danger`) | sheet Cancel / Close, Log out | default, pressed, focus | pass |
| 4 | Text link family (`.linkish`, `.hold-more`, `.qmeta-go`, `.muted-link`, `.onb-code-open`, Terms) | Day done, Ranking, card source line, Profile, Login, first run | default, pressed, focus, disabled | defect (L8) |
| 5 | Answer buttons (`.choice`) | card, list view, Gate demo | default, pressed, hot (drag), focus, disabled offline, long labels | pass |
| 6 | Icon buttons (back arrow, profile initial) | masthead | default, pressed, focus, current | defect (L6) |
| 7 | "?" info button (`.qbtn`) | 11 screens | default, pressed, focus, size in every context | pass |
| 8 | Copy controls (address chip, code block, copy buttons) | Wallet, Profile, Deposit, Invite, Gate | default, pressed, focus, done (label swap for 2 s) | pass |
| 9 | Amount field | Staking, Convert, Withdraw | empty, filled, focus, error, disabled, refused key, Max | pass |
| 10 | Address field | Withdraw | empty, filled, valid, bad, own, contract, disabled, Paste | pass |
| 11 | Code fields (6 digit login code, invite code) | Login, first run, Profile sheet | empty, filled, wrong, expired, tries, valid, unknown, own, linked, offline | defect (L1) |
| 12 | Email field | Login | empty, focus, typo hint, unsupported, too many, offline | pass |
| 13 | Inline field action (`.field-max`: Max, Paste, Save, Apply, Change) | all fields | default, pressed, focus, disabled | pass |
| 14 | Checkbox (`.check`) | Withdraw review sheet | unchecked, checked, focus, gate on the confirm button | pass |
| 15 | Language control | Gate and Login (select), first run and Profile (segments) | default, focus | defect (L10) |
| 16 | Segmented control (`.seg`) | Results filter, Ranking week, Profile | default, current, pressed, focus, long label | defect (L15, L16) |
| 17 | Period options (`.period`) | Staking | default, chosen, pressed, focus, disabled | pass |
| 18 | Page tabs (`.mtabs`) and view switch (`.viewsw`) | Staking, Home | default, current, pressed, focus, count | defect (L10) |
| 19 | Tab bar and badges | every main screen | default, current, pressed, focus, dot, number, long label | pass |
| 20 | Masthead (nameplate, sub page title, oxford rule) | every screen | main, sub page, cover, 320 px fallback to the mark | defect (L12) |
| 21 | Dateline and countdown | main screens, cover | closes, next set, ends, loading, offline, ticking digits | pass |
| 22 | Points pill | masthead | value, loading, pending, "+50" tag, zero, 8 digit value, pulse | defect (L4) |
| 23 | Question card and deck | Home | fresh, no image, image top, partial, syncing, slow, failed, loading, tight heights, drag, spring back | pass |
| 24 | Drag stamps (`.qstamp`) | Home card | hint (dashed), armed (solid, tinted), release | pass |
| 25 | Result and status stamps (`.rstamp`) | Results, Day done, success sheets, empty states | hit, miss, corrected, paid, staked, claimed, soon, closed, on hold, EN and KO | pass |
| 26 | Day boxes (`.day5`) | Home, Day done, first run | open, pending (hatch), done, failed, wave, three sizes | pass |
| 27 | List view rows (`.trow`) | Home list | open, answered, saving, failed, final, Undo in row | pass |
| 28 | Link rows (`.rowlink`, `.wrow`, `.inv-row`, `.rs-inv`) | Profile, Wallet, Results | default, pressed, focus, with count, with chevron | defect (L9) |
| 29 | Result rows (`.rrow`) | Results | collapsed, expanded, hit, miss, waiting | defect (L9) |
| 30 | Pick rows (`.pick`, `.pk`) | Day done | left answer, right answer, long question | pass |
| 31 | Ranking table (`.cols`, `.krow`) | Ranking | leader sizes, own row, void row, gap column, long name (ellipsis), 320 px column drop, loading | pass |
| 32 | Figures and stat groups (`.fig`, `.tri`, `.stats`, `.facts3`) | Wallet, Staking, Results, Profile, Convert, Invite | value, zero, big, loading, unit on the same line | defect (L2) |
| 33 | Label and value rows (`.rows`) | sheets, Withdraw, Deposit | default, emphasised, with "?", two line value | pass |
| 34 | Tags and counts (`.tag`, `.mtabs-n`) | Stakes, Invite, Ranking, list view, Wallet | plain, ink, with icon, count | pass |
| 35 | Progress bar (`.mbar`) | Stakes | running, full | pass |
| 36 | Notices (`.note`: info, ok, warn, error) | all screens | each tone, with and without action | pass |
| 37 | Inline banner (`.banner`) | Home (slow, reconnect) | with retry, busy | pass |
| 38 | Offline bar | all screens | offline, with last updated time | pass |
| 39 | On hold notice (`.hold`, Home on hold panel) | Ranking, Staking, Stakes, Wallet, Convert, Profile, Invite, Home | default, with KAIA note | defect (L5) |
| 40 | Empty states | Home, Results, Stakes, Invite, Ranking | soon, none yet, closed, other device | pass |
| 41 | Finished panel (`.home-fin`) | Home after the fifth pick | default | defect (L5) |
| 42 | Toast | global | plain (4 s), with action (60 s), queue, in, out, reduced motion | defect (M3) |
| 43 | Info sheet | 13 "?" and "How prizes work" sheets | open, Escape, scrim tap, grip drag, focus in and back, scroll at 360 and 320 | defect (M4, L14) |
| 44 | Review sheet | Staking, Withdraw, Stakes claim, Log out, invite code | default, confirm gated by the checkbox, cancel | pass |
| 45 | Transaction steps (`.txsteps`) | Staking sheet, Login "Almost there", info sheets | waiting, running, done | defect (M1) |
| 46 | Progress, failed and session sheets (`.sheet-state`, `.sheet-ic`) | Staking, Convert, Withdraw, Login, Profile | signing, sending, slow, failed, session ended | defect (L11) |
| 47 | Success sheet | Staking, Convert, Withdraw, Claim | stamp, figure, rows, explorer link, EN and KO | pass |
| 48 | Pick bar with Undo | Home card, list row, Day done | hint, held (Undo, 3 s), saving, saved, focus hold, reduced motion | defect (L7, L13) |
| 49 | Action bar (`.pin--act`) | Staking, Convert, Withdraw | ready, disabled, busy, note line | defect (M5) |
| 50 | Own rank bar (`button.pin`) | Ranking | ranked, top 10, unranked, last week, pressed, focus, away | defect (M2) |
| 51 | Skeletons | every loading state | card, rows, figures, pill | pass |
| 52 | QR and address block | Deposit, Gate | default, loading, grouped address, copy | pass |
| 53 | Icon set | everywhere | one family, stroke, sizes | defect (L11) |
| 54 | Disclosure (`.help`) | Login, Gate, Stakes "Closed" | closed, open, pressed, focus | pass |
| 55 | Numbered steps (`.steps`, `.inv-steps`) | Gate, info sheets | default | pass |
| 56 | Number and unit formatting | everywhere | wraps at 390, 360, 320 in EN and KO | defect (L3, L18) |
| 57 | Focus indicator | all 408 keyboard stops | ring present, colour, offset, not covered, not behind a bar, trapped in sheets | pass |
| 58 | Skip link | every screen | hidden, focused | pass |

## Defects, ranked

### Medium

**M1. Transaction steps: the tick of a finished step is invisible inside a sheet.**
- Where: `/staking?state=steps` (also `sending`, `slow`), all sizes, EN and KO.
- Evidence: `SCR/shots/en-390/staking-steps.png` and the zoom `SCR/cs/z1.png`: step 1 "Allow Cojam to use 500 CT" shows an empty pale tile. The same component on `/login?state=busy` shows the correct ink tile with a paper tick (`SCR/shots/ko-390/login-busy.png`), so the component has two looks for one state.
- Cause: `.sheet .txsteps .n { background: var(--paper-2); }` (`src/styles/components.css` line 994) has the same specificity as `.txsteps .is-done .n { background: var(--ink); color: var(--on-ink); }` (line 715) and comes later, so the tile turns pale while the tick stays paper coloured (about 1.1:1).
- Fix: in `components.css` change line 994 to `.sheet .txsteps li:not(.is-done) .n, .sheet .empty-ic { background: var(--paper-2); }`, or add `.sheet .txsteps .is-done .n { background: var(--ink); color: var(--on-ink); }` after it.

**M2. Own rank bar cuts its second fact, including a number with its unit, at 360x640.**
- Where: `/ranking` and `/ranking?state=top10`, 360x640, EN and KO (a main size).
- Evidence: `SCR/shots/ko-360/ranking-top10.png`: "상금 51..." (the full text is "상금 51.36 CT", `scrollWidth > clientWidth`, `text-overflow: ellipsis`). `SCR/shots/en-360/ranking.png`: "100P behind the to...". The bar is 46 px high in one line at this height; at 390x844 it is 62 px in two lines and nothing is cut.
- Fix: in the `@media (max-height: 700px)` block of `components.css` (lines 1285 to 1289) the bar is flattened to one line with `.pin-main { white-space: nowrap; overflow: hidden; }` and `.pin-main > span { text-overflow: ellipsis; }`. Keep the two line layout of `.pin-main` there, or hide the "This week" caption in `.pin-pts` first so the fact line keeps the room. A prize amount must never be the part that is cut.

**M3. A toast with an action stays for 60 seconds and sits on top of the answer buttons.**
- Where: `/list?state=failed`, 360x640, EN and KO; the same toast (`h.toast.fail` with "Try again") is raised by `src/state/play.ts` on any screen other than `/`.
- Evidence: toast box 12,516 336x52; under it "No" and "Yes" at y 533 to 587 and the source line at y 475 to 523 (`SCR/shots/en-360/list-failed.png`). Still on screen after 7.5 s; `Toasts` in `src/ui/kit.tsx` gives 60,000 ms to every toast with a button. At 390x844 it covers the "Pick" button of the next row instead.
- Fix: in `src/ui/kit.tsx` cut the life of an action toast to about 8 s (keep 60 s only for the update notice through `ms`), and let a tap outside dismiss it. In the list view prefer the row's own "Not saved" state, which already exists, to the toast.

**M4. Sheets have an opening motion and no closing motion.**
- Where: every sheet (info, review, steps, success), all sizes.
- Evidence: open: `sheet-in 320ms cubic-bezier(0.32, 0.72, 0, 1)` plus `scrim-in 240ms`. Close: 40 ms after Escape `#sheet-root` is already `display: none` (`SCR/inter-en-390.json`, key `sheet.closing@40ms`). The toast leaves in 200 ms and the card springs back in 440 ms, so the sheet is the one component that just vanishes. `SheetRoot` keeps the content for 260 ms after close but nothing is drawn in that time.
- Fix: in `components.css` keep the root visible while closing, for example `.sheet-root.is-closing { display: block; }` with `.is-closing .sheet { transform: translateY(100%); transition: transform 200ms var(--ease-drawer); }` and `.is-closing .sheet-scrim { opacity: 0; transition: opacity 200ms; }`; in `src/ui/kit.tsx` add `is-closing` while `shown && !s`. Under reduced motion skip it.

**M5. The disabled primary on Staking does not say why, while Convert and Withdraw do.**
- Where: `/staking?state=empty`, `below`, `above`, `zero`, `paused`, `full`, `fullnone`, `max20`, all sizes, EN and KO.
- Evidence: the pinned button reads "Stake" / "스테이킹하기" in all eight disabled states (`SCR/shots/en-390/staking-empty.png`, `staking-paused.png`). On Convert the same bar reads "Enter points to convert", "Limit reached until 09:00 KST", "Converting is paused"; on Withdraw "Enter address and amount", "Fix the address"; and `/staking?state=hold` already reads "New stakes are paused". At 390x844 the reason on Staking (the hint under the field or the notice at the top) is 350 to 450 px away from the button.
- Fix: in `src/screens/Staking.tsx` give `#go` the reason as its label when disabled: "Enter an amount", "Minimum 100 CT", "Up to 300 CT right now", "New stakes are paused", matching Convert and Withdraw.

### Low

**L1. Invite code form is 19 px wider than its column at 320 px in English.**
- Where: `/welcome?state=code-valid` and `/profile?state=code-valid`, 320x568, EN only.
- Evidence: `#codebox`, the field box, the language segments and `#next` are 307 px wide and end at x 323 on a 320 px screen (column should be 288 px); in the Profile sheet `#sheet.scrollWidth` is 339. `SCR/shots/en-320/first-run-code-valid.png`, `SCR/shots/en-320/profile-code-valid.png`: the buttons touch the right screen edge.
- Fix: `components.css`: `.onb-code, #panels, .onb-foot { grid-template-columns: minmax(0, 1fr); }` and `.onb-code > * { min-width: 0; }` so the long message line wraps instead of widening the grid.

**L2. The balance figure swallows the top 6 px of Deposit and Withdraw.**
- Where: `/wallet` (all states), all sizes, EN and KO.
- Evidence: `elementFromPoint` on the top 6 px of `#dep` and `#wd` returns `p#ct-fig` (figure box ends 12 px above the buttons, its inline overflow reaches into them). Effective target height 38 px.
- Fix: `components.css`: `#ct-fig { pointer-events: none; }` or `.acts { position: relative; z-index: 1; }`.

**L3. In English a number can part from its unit at a line end.**
- Where: 320x568 EN: `/staking?state=review` ("Stake 12,000 / CT for 90 days?"), `/stakes?state=claim` ("Claimed 263.01 / CT interest."), first run ("24 / hours"). `SCR/shots/en-320/staking-review.png`.
- Cause: the word joiner pass in `src/ui/behaviours.ts` (`glue`) runs for KO and JA only, and English values are written with a plain space. Nothing broke at 390 or 360, but only by luck of the line lengths.
- Fix: write the space between a number and its unit as U+00A0 in the formatters in `src/lib/fmt.ts` (and in the EN strings that hard code "12,000 CT" patterns), or extend `glue` to replace the space in `\d (CT|KAIA|P|days?|hours?)` for English.

**L4. The points pill grows from 30 to 36 px when it carries the "+50" tag.**
- Where: `/results`, `/done?state=results`, all sizes. `SCR/shots/ko-360/done-results.png`: the pill is two lines high and no longer lines up with the 30 px profile box.
- Fix: `components.css` `.pts-in`: keep `height: 30px` and set the tag beside the value (`flex-direction: row`), or give `.me-in` the same height when the tag shows.

**L5. Two static panels carry the ink frame that means "pressable".**
- Where: `.hold` notice (`/ranking?state=hold`, `/staking?state=hold`, `/stakes?state=hold`, Wallet, Convert, Profile, Invite): 1.5 px ink frame on all sides plus the heavy top rule (`SCR/shots/en-390/stakes-hold.png`). `.home-fin .deck-end` on Home after the fifth pick: a full ink frame around "That is all five" (`SCR/shots/flow-home-fin.png`). Every other notice sits between two rules, unframed.
- Fix: `components.css`: `.hold { border-left: 0; border-right: 0; border-bottom: var(--rule); background: none; padding-left: 0; padding-right: 0; }`, and `.home-fin .deck-end { border: 0; border-top: var(--rule-heavy); border-bottom: var(--rule); }`. Also note that Home on hold uses a secondary button ("See what on hold means") where the notice uses a text link ("What this means") for the same destination; pick one.

**L6. The back arrow has no pressed feedback.**
- Where: every sub page (`/convert`, `/deposit`, `/withdraw`, `/profile`, `/invite`). Pressed state shows no change in background, colour or transform (`SCR/inter-en-390.json`, `press`, `.mast-back`: "NO VISIBLE CHANGE"); all 26 other control types change.
- Fix: `components.css`: add `.mast-back` to the list at line 863 and `.mast-back:active { background-color: var(--paper-2); }`.

**L7. Reduced motion: the Undo countdown stands still, and four press moves remain.**
- Where: Home, list view, Day done with `prefers-reduced-motion: reduce`.
- Evidence: `.undo .fuse--fill i` computes `animation: none` (`components.css` line 1533), while the comments at lines 724 and 884 say the countdown keeps running "because it is the time left". A sighted player with reduced motion gets no cue of the 3 seconds. Separately `.qbtn span`, `.pts-in`, `.me-in` still move 1 px and `.tb-ic` still scales to 0.92 on press, while `.btn`, `.choice`, `.addr-chip`, `.code-block`, `.undo` are switched off.
- Fix: decide one rule. Either let the fill run linearly under reduced motion (remove line 1533) or show the seconds as a digit in the Undo button. Add `.qbtn:active span, .pts:active .pts-in, .me:active .me-in, .tb a:active .tb-ic { transform: none; }` to the reduced motion block.

**L8. The text link family has three sizes and three weights.**
- Evidence (computed): `.linkish`, `.hold-more`, `.onb-code-skip` 14 px / 600; `.field-max` 14 px / 700; `.btn-ghost` 15 px / 700; `.qmeta-go` and Terms / Privacy 13 px / 600; the Gate footer link 13 px / 400; `.muted-link` ("Version 1.0.3") 14 px / 400 in secondary ink.
- Fix: `components.css`: one size and weight for an underlined blue text link (14 px / 600), with `.btn-ghost` as the only larger one because it is a sheet action.

**L9. Link rows come in three heights, and expandable result rows show no sign that they open.**
- Evidence: `.rs-inv` and `.help summary` 48 px, `.rowlink` and `.wrow` 52 px, `.inv-row` 60 px; `.inv-row` is ruled above, the others below. `button.rrow` on Results expands on tap but has no chevron, while the "Invite bonus" row beside it has one (`SCR/shots/flow-results-open.png`).
- Fix: `components.css`: one `min-height` (52 px) for all link rows; add the `down` chevron (rotating on `aria-expanded`) to `.rrow` in `src/screens/Results.tsx`, as `.help summary` does.

**L10. The same choice is drawn with different controls.**
- Cards / List: underline links on Home (`.viewsw`, 14 px), segments in Profile ("Home view"). Language: a framed select on Gate and Login, segments on first run and Profile. Page tabs on Staking (`.mtabs`, 15 px, standing on a rule) and the Home view switch (`.viewsw`, 14 px, no rule) are two skins of one pattern.
- Fix: use `.mtabs` for both Staking and Home (delete `.viewsw`), and one language control (the segments, since only two languages are offered).

**L11. Icons: one family, ten rendered sizes; the sheet tile icon is 28 px in two sheets and 32 px in three.**
- Evidence: all icons share the 24 grid and `stroke-width="2"`, but render at 13, 14, 16, 17, 18, 20, 22, 28, 30 and 32 px, so the drawn stroke runs from 1.1 to 2.7 px. `.sheet-ic` holds a 28 px icon on `/login?state=walletfail`, `devicefail`, `refused-*` and `/profile?state=session`, and a 32 px icon on `/staking?state=failed`, `/convert?state=failed`, `/withdraw?state=failed`.
- Fix: settle on 16 (inline), 18 (in buttons), 22 (tab bar, masthead) and 28 (tiles) in the `icon()` calls; 13 and 14 become 16 where the line allows, 17 becomes 18, 30 and 32 become 28.

**L12. The nameplate is cut in the middle of a word on the blocked page at 320 px.**
- Where: `/system/blocked`, 320x568, EN and KO. `SCR/shots/en-320/system-blocked.png`: "Cojam Dai" beside the "On hold" tag (`scrollWidth` 180, `clientWidth` 157, no ellipsis). The main masthead falls back to the mark alone (`.plate.is-mark`); this bar does not run that check.
- Fix: reuse the `fit()` measure of `Header` in `src/ui/kit.tsx` for the system page bar in `src/screens/System.tsx`.

**L13. The Undo button overlaps the bottom edge of the deck on short screens.**
- Where: Home after a pick, 360x640 and 320x568. `SCR/shots/int-ko-360-undo.png`, `SCR/shots/int-en-320-undo.png`: the button's top edge sits on the two stacked sheet edges under the card. At 390x844 there is clear space.
- Fix: `components.css`, in the `max-height: 640px` block: `.deck { margin-bottom: 18px; }` or lower the pick bar's `min-height` back to 44 px with `align-items: end`.

**L14. A long info sheet leaves its Close button below the fold and 57 to 64 px of scrim.**
- Where: "How prizes work" at 360x640 and 320x568 (sheet 576 and 511 px high, Close at y 743 and 796), "How it works" (Invite) at 320x568. Escape, the grip and the scrim strip still close it.
- Fix: `components.css`: `.sheet-acts { position: sticky; bottom: 0; background: var(--sheet); padding-top: var(--s-8); }` so the action stays in view.

**L15. Segments and tags have no answer to a label that is too long.**
- Evidence (injected text): a `.seg-btn` label overflows into the next segment and off the screen (`white-space: nowrap; overflow: visible`), `SCR/shots/int-en-390-long-ranking.png`; a `.tag` runs over the figure beside it, `SCR/shots/int-en-390-long-stakes.png`. Current EN and KO labels fit; a third language or a longer status would not.
- Fix: `.seg-btn { overflow: hidden; text-overflow: ellipsis; }`, `.tag { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }`.

**L16. Focus ring offset differs between the two segmented groups.**
- Evidence: `.seg-btn` rings sit inside the segment (`outline-offset: -4px`); unchosen `.period button` rings sit 2 px outside and overlap the neighbour and the group frame (the chosen one is inside at -4 px).
- Fix: `components.css`: `.period button:focus-visible { outline-offset: -4px; }`.

**L17. Small state notes.**
- `/stakes?state=loading`: the "My stakes" count shows "0" while the list is still a skeleton (`SCR/shots/en-390/stakes-loading.png`); hide the count until the data arrives.
- `/withdraw?state=nokaia`: the notice button and the pinned primary carry the same label "Deposit KAIA" (`SCR/shots/ko-390/withdraw-nokaia.png`); one is enough.
- `/invite?state=empty` uses a plain sentence where every other empty state uses the stamp and headline pattern.
- A toast raised by a control covers that control for its 4 s (Profile "Version 1.0.3").
- `/profile` at 320x568: the two "?" targets overlap by 4 px vertically.

**L18. Korean: a time phrase splits across lines in the card's source line at 360 px.**
- Where: `/?state=fresh`, 360x640 and 320x568, KO: "정답 기준: 바이낸스 BTC/USDT 오후 / 9시 가격" (`SCR/shots/ko-360/home-fresh.png`).
- Fix: join "오후" and the hour with U+00A0 in the time formatter used for the source line (`F.time` in `src/lib/fmt.ts`).

## What is solid

- Touch targets: every control on every state is at least 44x44 (43.5 px for two inline legal links), including the "?" box (22 px box inside a 44 px target), the checkbox, the Max / Paste / Save actions and the tab bar (64 to 78 x 59).
- Contrast: no text pair under 4.5:1 on any state, in both languages, including disabled labels (6.3:1 and above) and text on the persimmon and teal answers.
- Focus: all 408 keyboard stops show a 2 px ring (blue on paper, paper on ink for chosen segments and the own rank bar; a double ring on fields; the checkbox ring is drawn on its box). No stop is covered or left behind the masthead, the tab bar or a pinned bar. Sheets trap focus, take focus on open and hand it back on close; the page behind is `inert`.
- Buttons: one primary (52 px, blue), one secondary (44 px, ink outline on a fresh sheet), one text button; identical border, 2 px radius, type and padding in all 177 states. Disabled looks are consistent (primary on the second paper tone, secondary hollow), and Convert, Withdraw, Wallet offline and the review sheet state the reason on or beside the control.
- Pressed feedback is uniform: framed controls darken and drop 1 px, rows take the second paper tone, text links thicken their underline, the tab icon dips. 26 of 27 control types respond.
- Fields: amount, address, code and email share one box (56 / 50 / 46 px by screen height, same edge, radius and ring), with error (red edge and line), valid (green edge), disabled and refused key states, and the grouped echo of an address.
- "A frame means pressable" holds almost everywhere: tags, counts, day boxes, step numbers, icon tiles, the QR and thumbnails are unframed; the two exceptions are in L5.
- Copy feedback is one pattern on every copy control: the label becomes "Copied" for 2 s and is announced, with no toast.
- Stamps (HIT, MISS, PAID, STAKED, CLAIMED, SOON, CLOSED, ON HOLD) share one construction in EN and KO; drag stamps move from dashed hint to solid armed state at the threshold.
- Undo: 85x44 (EN) and 98x44 (KO), framed, never covered, the window measured at 2.8 to 2.9 s after the tap in all runs, the same control in the pick bar, the list row and Day done.
- Skeletons mirror the layout they replace on every loading state; the home error state follows the skeleton with a notice and "Try again".
- Long content: a long player name ends in an ellipsis without growing the row, an 8 digit points value widens the pill without pushing the profile button off screen, a long Korean primary label wraps inside the button (52 to 72 px), tab labels never leave their cell.
- EN and KO render the same controls in the same order in all 177 states; Korean headlines break at phrase boundaries, and figures stay joined to their particles and units.
- Reduced motion: sheets, the scrim, toasts and the card stop travelling (the card cross fades in 200 ms), spinners keep turning.
- No console error, page error or HTTP error in 2,124 page loads.
