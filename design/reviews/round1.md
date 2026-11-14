# Cojam relaunch prototype: independent review, round 1

Reviewer did not build these pages. Reviewed in English (`?lang=en`) on 2026-11-12, served with `python3 -m http.server 8826 -d site`.

Method: full page captures at 1440x900 and 390x844 (DPR 2, `tools/design/shot.js`) of every page and all 18 swap states; `tools/design/audit.js` at both sizes; Playwright scripts that used each page (swap flow from the header wallet button through bad inputs, approve, swap, reload with `?days=8`, claim, disconnect and Undo, Esc and Enter, help popovers, Tab order; status view toggle and chart keys; admin search, filters, sort, wallet sheet, CSV; docs table of contents; landing FAQ and anchors; language select).

Note from the coordinator: the swap rule is changing (10% instant, 90% after 7 days). Copy that describes "the whole swap is locked 7 days" was not marked down. Structure, hierarchy, usability, consistency and craft were.

Audit helper result: no horizontal overflow at 390 on any page, no text under 4.5:1, no mobile target under 44 px, accent only on primary buttons and current selection. The issues below are the ones the audit cannot see.

## Scores

| Page | Design /100 | Usability /40 | Target met |
| --- | --- | --- | --- |
| Landing `/` | 82 | 34 | Usability yes, design no |
| Swap app `/migrate/` | 81 | 33 | No |
| Status `/status/` | 80 | 33 | No |
| Docs `/docs/` | 82 | 34 | Usability yes, design no |
| Admin `/admin/` | 73 | 33 | No |

Target: 85+ design, 34+ usability per page.

---

## 1. Landing `/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 8 | Clear H1, one primary, hero card supports it. The card is small for its column and the same track repeats at full width 300 px lower. |
| Layout | 8 | Sound two column grid; hero card floats with dead space under it on desktop. |
| Spacing | 8 | Generous, but `.how.section` starts with 16 px top padding right after a 96 px hero, so the hero and How blocks read as one lump. |
| Type | 9 | Pretendard, tight scale, tabular figures everywhere. |
| Colour | 8 | One accent, sky as data, night ground for concepts. Timeline dots use three fills (ink, sky, hollow) with no stated meaning. |
| Consistency | 8 | Track reused; "Audit in progress" is a grey `.tag` here and an amber `.tag-warn` in docs. |
| Density | 8 | Contracts appear in their own section and again in the footer 2 screens later. Concept section is about 2.5 screens on mobile. |
| Copy | 8 | Specific and plain. Hero lede says what to do. |
| Mobile | 8 | First screen shows H1, CTA and most of the card; no overflow. |
| Finish | 8 | Help "?" icons wrap onto their own line under step text (`.how-body`), footer legal rule wider than the content. |
| **Total** | **82** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 3 | Hero shows the window range but not "open now, 352 days left"; that line exists only on `/migrate/`. |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 3 | Audit tag style, duplicate track. |
| Error prevention | 3 | Full address with copy; "ticker reused" warning is good. |
| Recognition | 4 | |
| Flexibility | 3 | |
| Aesthetic, minimal | 3 | Two tracks and two contract lists. |
| Error recovery | 3 | Little to recover from. |
| Help | 4 | FAQ plus help popovers that fit on mobile. |
| **Total** | **34** | |

### Top 5 fixes

1. **One track in the first two screens.** `site/index.html` `#how-track` duplicates `#hero-track` within 300 px, and at `demoDays: 7` it is fully sky while its caption keeps the closed lock icon and says "7 day lock" (`site/assets/pages/landing.js` paint). Remove `#how-track` and let the three `.how-step` columns carry the icons, or keep `#how-track` and turn the hero card into the live window summary (opens, closes, days left). Do not show the same widget twice.
2. **Stop the orphaned help icons.** In `.how-body` the `details.help` wraps onto its own line under "one for one." and "one tick per day." at 1440. Wrap the last word and the toggle in a `white-space: nowrap` span, or reuse the `.mg-hh` pattern from the swap app.
3. **Put the live window state in the hero.** `#hero-window` reads "Open Dec 1, 2026 to Dec 1, 2027". Change it to the same sentence the app shows: "Swaps are open until Dec 1, 2027, in 352 days" (reuse `win.open` from `i18n/migrate.js`), so a visitor knows it is live without opening the app.
4. **Drop the second contract list.** The `#contracts` section and the footer `.cj-foot-addrs` show the same three rows on one page. On pages that render a contracts block, render the footer without `.cj-foot-addrs` (shell option `data-foot="lite"`), or replace the footer block with a link "Contracts on Kaia".
5. **Give the timeline dots a meaning or one colour.** `.tl-item:first-child .tl-dot, .tl-item:nth-child(3) .tl-dot` (ink) versus `:nth-child(2)` (sky) versus hollow. Either mark "today" between opens and closes (a sky dot at the current date, which is the useful fact) or make all past or fixed events ink and future ones hollow, and say so nowhere because it reads by itself.

---

## 2. Swap app `/migrate/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | One panel, one named primary per state ("Swap 125,000 old CT", "Claim all 100,000 new CT"). |
| Layout | 8 | Panel plus history works; on desktop the history panel is mostly empty in early states, and "Keyboard shortcuts ?" floats alone under the panel. |
| Spacing | 8 | Consistent 16 px rhythm in rows. |
| Type | 8 | Good scale; header wallet chip renders "0×3fA9…E915" (Pretendard contextual alternate turns 0x into a times sign). |
| Colour | 9 | Accent only on the primary; sky for ready; amber and red only on warnings and errors. Claimed track bars in solid `--ink-2` are the heaviest thing on a done screen. |
| Consistency | 8 | Track used in panel, history and review; claim exists twice per lot in `claimable` (panel primary and history outline), which is fine, but labels match. |
| Density | 8 | Locked state says the same thing twice: "Unlocks in 7 days" on the track and "Time left 6 d 23 h 59 min" under it. Page lede repeats on every state. |
| Copy | 9 | Buttons name the action and the amount; errors say what happened and what did not happen ("Nothing was sent"). |
| Mobile | 6 | Every help popover in the panel is clipped at 390 (measured: Rate pops at x -63, Unlocks at -41, Network fee at -14, approval at 205 to 485 on a 390 viewport). Header "Connect wallet" wraps to two lines. |
| Finish | 8 | Otherwise careful: focus moves to the view heading, live region, skeleton on retry. |
| **Total** | **81** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | Wallet wait, pending with elapsed time and tx link, "Confirming on Kaia" placeholder in history, no lot until confirmed, `role=status` live region. |
| Match with real world | 4 | |
| User control | 4 | Back on every step, Esc goes back or cancels, Cancel while waiting, Undo on disconnect. |
| Consistency | 3 | Same action can look different (claim in panel vs history), shortcut button on touch. |
| Error prevention | 4 | Parser rejects -5, 1e5, abc, ".", 0, 19 decimals with reasons and keeps the button disabled; 200000 offers "Use max"; review gate with checkbox above 1,000,000. |
| Recognition | 4 | Balance beside the field, "You have 2.48 KAIA" next to the fee. |
| Flexibility | 3 | Enter, Esc, ? work; no remembered last amount or chips; shortcut list on phones is noise. |
| Aesthetic, minimal | 3 | Duplicate countdown, repeated lede. |
| Error recovery | 2 | Every fix link to docs is dead: `#gas` ("How to get KAIA"), `#support` ("Contact support"), `#exchange`, `#pool`, `#faq` do not exist in `site/docs/index.html`, so each one lands at the top of the guide. Docs also has no "how to get KAIA" content. |
| Help | 2 | The help popovers are the main help on this page and they cannot be read on a phone. |
| **Total** | **33** | |

### Top 5 fixes

1. **Keep help popovers on screen.** `site/assets/base.css` `.help-pop` is centred on its toggle (`left: 50%; transform: translateX(-50%); width: min(280px, 80vw)`), and `.mg .help` sits at the left edge of `.mg-row dt` or the right edge of `.mg-hh`. Fix once in base.css, for every page: on screens under 600 px make `.help` `position: static` and position `.help-pop` against the nearest panel (`.panel { position: relative }`, `.help-pop { left: 16px; right: 16px; width: auto; transform: none; }`), exactly as `.how-step .help-pop` already does on the landing. Or clamp in JS on `toggle`. Acceptance: no `.help-pop` rect outside 0..390 in any `?state=`.
2. **Make every fix link land on its answer.** `site/assets/pages/migrate.js` uses `DOCS + "#gas"`, `"#support"`, `"#exchange"`, `"#pool"`, `"#faq"`. Add those ids in `site/docs/index.html` (`id="exchange"` and `id="pool"` on the two h3 in Special cases, a new "Get KAIA for gas" h3 with `id="gas"` in Fees that says where to buy KAIA and how much is enough, `id="support"` on Contact), and point the empty state's "Other cases" to `#special` instead of the missing `#faq`.
3. **Fix the "0×" glyph and the wrapping chip.** In `site/assets/shell.js` `paintWallet` the address sits in `<span class="num">` set in Pretendard, whose contextual alternates draw "0×". Add `.cj-wallet .num { font-family: var(--font-data); font-size: var(--fs-13); }` (or `font-feature-settings: "calt" 0` on every address in UI font). Add `white-space: nowrap` to `.cj-wallet` and use the short label "Connect" under 400 px so the header button stays one line.
4. **One countdown on the locked state.** `V.locked` renders the track (mid label "Unlocks in 7 days") and `.mg-count` ("Time left 6 d 23 h 59 min"). Keep one: put the live countdown into the track mid label and remove `.mg-count`, or drop the track mid label in this view.
5. **Hide the keyboard shortcut button on touch and tuck it in.** `#mg-kbd-open` sits alone under the panel and shows on phones. Add `@media (hover: none) { .mg-kbd-btn { display: none; } }` and on desktop move it into the panel footer next to the hint line as a quiet text link, so the panel ends cleanly.

Also worth doing: in the `ready` error states "You will receive 0 new CT" shows while the amount is invalid; show an em space or the last valid value greyed instead of a confident zero. Claimed track (`.track.is-claimed .track-day { background: var(--ink-2) }`) is the darkest block on a finished screen; use `--line-strong` with the check icon so "done" reads calm.

---

## 3. Status `/status/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | 637,450,537 CT at display size, supporting figures at 20 px, then charts, then the list. |
| Layout | 8 | Two charts of unequal height leave a dead block under "Show as a table". |
| Spacing | 8 | |
| Type | 9 | Tabular figures line up; units on every number. |
| Colour | 7 | Green pulsing dot on "Updated 4 seconds ago" (green is reserved for gain); claimed segment in solid `--ink-2` is heavier than the sky data colour. |
| Consistency | 6 | The signature swap track is absent from the public dashboard (PLAN requires an aggregate track here). Segmented control is a separate `.st-seg` with a neutral selected state while admin's `.seg` uses the brand; status tag "In wallet" means what the app calls "Claimed". |
| Density | 8 | Good for a dashboard; contracts panel plus footer contracts repeat. |
| Copy | 8 | Sample data banner is clear. The legend sum is off by one CT: "Locked or ready to claim 318,051,090 CT" while 223,204,818 + 94,846,271 = 318,051,089 (desktop capture). On a trust page the figures must add up. |
| Mobile | 8 | Cards by default on mobile, remembered choice, no overflow. |
| Finish | 9 | Chart with arrow key inspection and a table fallback is well made. |
| **Total** | **80** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | Live stamp, today counted so far. |
| Match with real world | 4 | |
| User control | 3 | |
| Consistency | 3 | Tag vocabulary and toggle style differ from the app and admin. |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 4 | Table and Cards remembered, chart keyboard, table fallback. |
| Aesthetic, minimal | 3 | |
| Error recovery | 2 | No loading skeleton and no "could not reach Kaia, showing figures from 14:02 UTC" state. A public dashboard needs both. |
| Help | 3 | No help popover on "Reserve left", "Locked now" or "Ready to claim", which PLAN lists as help terms. |
| **Total** | **33** | |

### Top 5 fixes

1. **Bring the signature track to the dashboard.** `site/assets/pages/status.js` never calls `CJ.track`. Replace the "Unlocking in the next 7 days" bar list with the aggregate track: seven day ticks, each tick's fill height or label the CT unlocking that day, left end "Locked now 223,204,818 CT", right end "Ready to claim 94,846,271 CT". Same component, same sky, so the dashboard reads as the same product.
2. **Make the parts add up.** The supply bar legend in `status.js` rounds its own sums. Compute claimed, locked, ready and not swapped once as integers and derive every displayed figure and percentage from those, so legend, tiles and total always match to the CT.
3. **Loading and stale states.** Add a skeleton for the figure grid and charts on first paint (`.skel` exists in base.css), and a `note-warn` "Could not reach Kaia. Figures are from 14:02 UTC." with a Retry button when the refetch fails. Show it with `?state=stale` like the app.
4. **One segmented control for the site.** Move `.seg` from `site/assets/pages/admin.css` into `site/assets/base.css`, delete `.st-seg` and `.st-seg-btn` from `status.css`, and use the rule from the design floor: selected is `--brand-tint` background with `--brand` text. The Table and Cards toggle then matches admin and nav.
5. **Calm the live stamp and add the term help.** `.st-live-dot` uses `--up` (green). Use `--ink-2` (or sky) and drop the pulse on sample data. Add `help()` toggles beside "Reserve left", "Locked now" and "Ready to claim" with the same help keys the app uses (`help.reserve`, `help.lock`).

---

## 4. Docs `/docs/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 8 | Clean article; section h2s clear, h3s in Special cases are small and blend into body text. |
| Layout | 8 | Table of contents column is empty above the fold line next to the title; fine but the TOC could start at the top. |
| Spacing | 8 | |
| Type | 9 | Comfortable measure, 16 px body. |
| Colour | 9 | Accent only on the current TOC item and the one CTA. |
| Consistency | 7 | Audit tag amber here, grey on landing; app deep links expect anchors this page lacks. |
| Density | 8 | Text heavy but scannable. |
| Copy | 9 | Plain and precise, safety section is strong. |
| Mobile | 8 | "Jump to a section" closes after a pick and lands the heading below the sticky header. |
| Finish | 8 | |
| **Total** | **82** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | Scrollspy marks the section being read. |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 3 | |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 3 | |
| Aesthetic, minimal | 4 | |
| Error recovery | 2 | It is the recovery page for the app and lacks the gas and support answers the app links to. |
| Help | 3 | |
| **Total** | **34** | |

### Top 5 fixes

1. **Add the missing anchors and the gas answer.** In `site/docs/index.html` add `id="exchange"`, `id="pool"` on the Special cases h3s, `id="support"` on Contact, and a "Get KAIA for gas" block with `id="gas"` under Fees: where to get KAIA, a safe amount for approve, swap and claim, and that it must be in the same wallet.
2. **Give special cases a scannable form.** The five cases (exchange, pool, multisig, lost access, small balances) are h3 plus paragraph at nearly body size. Render them as a definition list or a bordered list with the case as a 16 px semibold row title and the answer under it, so a holder can find "my CT is on an exchange" in one glance.
3. **One audit status style.** `Audit in progress` uses `.tag-warn` here and `.tag` on the landing. Pick one (neutral `.tag`, since amber means time pressure or warning) and use it on landing, docs and status.
4. **Start the TOC at the top.** `site/assets/pages/docs.css` places `.dc-toc` in `grid-row: 2`, so it begins at the "Before you start" line and the left column is empty beside the H1. Use `grid-row: 1 / span 2` (it is already `position: sticky; top: 96px`) so the contents are visible from the first screen.
5. **Add a contents link back to the app at each step.** The "Go to Swap" button sits only after step 6. Add a quiet text link in step 1 ("Open the Swap page") so a holder reading the steps does not have to scroll to act.

---

## 5. Admin `/admin/` (internal monitor)

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 8 | Figures, schedule, requests, holders, large swaps: right order. |
| Layout | 7 | Uses a wider container than every other page, so the shared header jumps 56 px left. The 14 day unlock chart is half empty by design (nothing after day 7). |
| Spacing | 8 | |
| Type | 8 | Amount column mixes "23,513" and "26,595.16"; decimals do not line up. |
| Colour | 7 | Live dot is sky here and green on status; amber warning icon on every large swap row turns a list into an alarm; five brand outlines at once (three "All", "CT", page 1) next to the primary. |
| Consistency | 6 | Forked segmented control, different container, "Claimed" tag outlined here and filled elsewhere, and the sample figures contradict the status page (413 wallets here, 2,503 wallets on status; 643,204,133 CT here, 637,450,537 CT there). |
| Density | 7 | Desktop is fine; mobile is about 11,850 px tall with eight stacked figure tiles before any chart. |
| Copy | 8 | Clear and operational ("Read only: no one can move user funds from here"). |
| Mobile | 6 | Works, but each request card is about 240 px tall and the tx icon floats unlabeled at the end of each card. |
| Finish | 8 | Wallet sheet with per request tracks is well done. |
| **Total** | **73** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | Stamp, counts "608 of 608 requests", 24 hour unlock alert. |
| Match with real world | 4 | |
| User control | 4 | Esc closes the sheet and returns focus to the wallet. |
| Consistency | 3 | |
| Error prevention | 3 | Threshold input validates. |
| Recognition | 4 | Filters visible, counts update. |
| Flexibility | 2 | `/` does not focus search (no handler); CSV exports only the filtered rows without saying so ("Export CSV" while 1 of 608 is shown gives a 1 row file). |
| Aesthetic, minimal | 3 | |
| Error recovery | 3 | Empty filter message exists; no stale state. |
| Help | 3 | |
| **Total** | **33** | |

### Top 5 fixes

1. **One sample dataset for status and admin.** Both pages generate their own mock numbers. Move the generator into `site/assets/system.js` (`CJ.sample()`, seeded) and have `status.js` and `admin.js` read the same lots, so totals, holders and daily figures match when the founder flips between the two.
2. **Use the shared container.** `site/assets/pages/admin.css` line 2, `body[data-page="admin"] .container { max-width: 1280px; }`, also widens the shared header and footer, so the logo jumps 56 px left between pages. Scope it to `.adm > .container` (main content only) and keep the header on `--container`.
3. **Align amounts.** Format the Amount column with a fixed 2 decimals (`F.amount(v, 2)` with `minimumFractionDigits: 2`) and right align, so decimal points line up; same in the wallet sheet.
4. **Say what CSV exports and add `/`.** Label the button with the count, "Export 608 requests" or "Export 1 filtered request", and add a `keydown` handler in `admin.js` for `/` that focuses `#lots-q` when not typing.
5. **Quiet the large swaps list and the schedule chart.** Remove the amber icon from each row in the large swaps list (the section title already says they are large; keep amber for the 24 hour unlock note), and draw the unlock schedule for 7 days instead of 14 so the chart has no empty half.

---

## Site wide issues (cross page consistency)

1. **Help popover positioning lives in `base.css` and fails on the left and right edges.** Fix once there (see swap fix 1); the landing already proves the static, panel wide version works.
2. **Segmented control is forked.** `.st-seg` (status) and `.seg` (admin) differ in height, selected style and markup. One component in `base.css`, selected state on `--brand-tint` plus `--brand` text, the same as the design floor's "current selection" rule.
3. **Status vocabulary drifts.** Claimed lots are "Claimed" in the app and admin and "In wallet" on status; "Claimed" is an outlined tag in admin and a filled tag elsewhere. "Audit in progress" is grey on landing and amber in docs. Define `tag.locked`, `tag.ready`, `tag.claimed`, `tag.audit` once in `i18n/shell.js` and one tag style per status in `base.css`.
4. **The swap track is missing from the status page.** It appears on landing, app, docs and in the admin sheet, but not on the public dashboard the plan names.
5. **Live stamp dot differs** (green on status, sky on admin). One `.live-dot` in `base.css`, not green.
6. **Contracts appear twice on the same page** (landing section plus footer, status panel plus footer, docs section plus footer, migrate disconnected panel plus footer). Offer a lite footer without addresses on pages that show the panel.
7. **Footer legal rule is wider than the content.** `.cj-foot-legal` puts its `border-top` on a `.container`, so the rule spans the gutter padding and starts 45 px left of the text at 1440. Move the border to an inner element or use `background: linear-gradient` inside the padding box.
8. **Mobile sticky header is 110 px** (64 px row plus the 44 px nav row) and stays on screen while scrolling, 13% of an 844 px viewport, and on `/migrate/` it holds a wrapping "Connect wallet" button. Make only the top row sticky, or hide the nav row on scroll down.
9. **No skip link.** Tab starts at the logo on every page and walks the header before reaching the panel. Add a "Skip to content" link targeting `#main` in `shell.js`.
10. **Title pattern drifts.** Admin is "Cojam: swap monitor", the other pages "Page: Cojam". Use "Swap monitor: Cojam".

## Project rules check

| Rule | Result |
| --- | --- |
| One accent only for primary action and current selection | Pass (audit). Admin shows five brand outlines at once, within the rule but loud. |
| One primary per view | Pass. Landing has two "Swap CT" primaries, hero and closing band, a full page apart. |
| Units on every figure | Pass. |
| No dash as sentence break, no tracked capitals, no eyebrows, no middle dot | Pass (grep of i18n and CSS clean). |
| No card inside a card | Mostly. The dashed "Example" box inside the history panel and the stat grid inside the status panel are borderline; acceptable as inset groups. |
| 44 px targets | Pass on mobile (audit). Status toggle is 40 px on desktop. |
| 4.5:1 text | Pass. |
| Visible focus | Pass; language select relies on `.cj-lang:focus-within`, which works. |
| No horizontal scroll at 390 | Pass for the page, but help popovers are clipped by `overflow-x: clip` (fail in use). |
| Reduced motion | Pass (base floor plus per page rules; live dot animation off). |
| Swap track consistent across pages | Fail on status. |
| Never a lot before the mock chain confirms | Pass: history shows "Confirming on Kaia" and counts 0 lots until the swap confirms. |
| Concept previews labelled, not live | Pass: every mock carries "Concept preview, not live", controls are spans inside `aria-hidden`, section lede says every number is an example. |
| No invented metrics as real | Pass: status and admin carry "Sample data" notes. The two sample sets contradict each other (fix admin 1). |

## What works and must be kept

- The swap flow itself: named primary per state ("Swap 125,000 old CT", "Claim all 100,000 new CT"), Back on every step, Esc goes back or cancels the wallet wait, Undo after disconnect, focus moved to the view heading, `role=status` live announcements.
- The amount parser and its messages: -5, 1e5, abc, ".", 0 and 19 decimals all refused with a reason and a disabled button; "1,250.75" and "40 CT" accepted; over balance offers "Use max".
- History never shows a lot before confirmation; "Confirming on Kaia" placeholder is exactly right.
- Large swap review with a checkbox gate; partial approval state with "Resume at step 2" and "Start over".
- The swap track as a component, including the per request tracks in the admin wallet sheet.
- Safety banner, "Check full addresses" copy and the full old CT address with copy and explorer buttons everywhere.
- Night ground concept section with "Concept preview, not live" on each mock and inert span controls.
- Status: display size total, chart with arrow key inspection and a table fallback, Table and Cards toggle remembered per user with Cards default on mobile.
- Docs scrollspy table of contents and the mobile jump list that closes after a choice.
- Token discipline: no literal colours outside `tokens.css`, tabular figures site wide, clean audit at both sizes.
