# Cojam relaunch prototype: independent review, round 3

Reviewer did not build these pages. Reviewed in English (`?lang=en`) on 2026-11-12 at commit `49defce`, served with `python3 -m http.server 8834 -d site`. Korean and Japanese spot check at 360 at the end. Same method and scales as round 2.

Method, mobile first:

- Touch only flows in Playwright on the `iPhone 15` profile (393x659, iOS user agent) and a 360x740 Android profile (isMobile, hasTouch, DPR 3), each once with motion and once with `reducedMotion: 'reduce'`.
  - `?env=inapp-kaia`: one tap connect, the collapsed page head and its disclosure, `abc` and `1e5`, simulated keyboard (viewport cut to 420 px), `20,000`, approve, swap, then the success frames. A MutationObserver logged where `CJ.celebrate` fired, the track and sticky bar rectangles at that moment, and every toast.
  - `?days=7.01`: Being sent, claim it yourself, claimed frames. Then a new swap and `?days=8`: released by the keeper.
  - `?env=mobile-browser`: sheet on iPhone 15 and on 360 in EN, KO and JA. I tapped the Recommended row (the navigation was caught), the fallback line, Back, and WalletConnect through to the form and its fee row.
- Desktop 1440x900 by keyboard: Tab order and focus rings on landing, swap and the sheet (`desktop-ext`), the focus trap, Esc with focus return, Enter, the review gate above 1,000,000, `?`, `/` on admin, the skip link. I also checked left edge alignment of logo, H1 and footer on every page.
- Motion:
  - A held touch through CDP with a press and ripple frame strip, with and without reduced motion.
  - Track fill sampling, celebrate frames for both swap and claim, and the landing carousel swipe.
  - Video in `review3/flow/vid-*` and `review3/motion/vid-m`.
- CLS by PerformanceObserver (layout-shift) on load for every page at 1440, iPhone 15 and 360. Each page was loaded twice: on a fast local load, and with throttling (150 ms latency, 200 kB/s).
- Captures: 75 with `tools/design/shot.js`, plus about 200 flow and motion frames, in `/tmp/claude-0/-home-user-Cojam-Renewal/b3270fa9-0a00-5483-ac13-fc0e6a3d97c3/scratchpad/review3/`. I looked at every one, through contact sheets and full size crops.
- `tools/design/audit.js` at 360 `--mobile` and 1440, 28 runs (all pages, status error, admin late, six swap states, KO swap, JA landing): no overflow, no text under 4.5:1, no mobile target under 44 px, no monospace misuse, and the accent only on primaries, the current nav item and selected segments.

## Scores

| Page | Design /100 | Usability /40 | Mobile /10 | Interaction /10 | Delta design | Delta usability | Target (85 / 34) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Landing `/` | 89 | 37 | 9 | 8 | +3 | +2 | Met |
| Swap app `/migrate/` | 88 | 38 | 9 | 9 | +5 | +2 | Met |
| Status `/status/` | 88 | 36 | 9 | 8 | +7 | +1 | Met |
| Docs `/docs/` | 86 | 37 | 8 | 7 | +2 | +1 | Met, narrowly |
| Admin `/admin/` | 86 | 37 | 8 | 7 | +8 | +2 | Met, narrowly |

Every page now meets both targets, but docs and admin only just make it.

The success moment now works on a phone:

- After a swap on a 740 screen, the track sits in the middle (290 to 413).
- The check pops on the 10% block that just arrived.
- No toast covers it.
- Done is fully in view at 579 to 631, and it sticks to the bottom once you scroll up.

The swap app is held back by three small mobile defects:

- The "Approved" toast still covers the step 2 lead.
- On iPhone 15, the claim view hides its track behind a two button sticky bar.
- Under reduced motion on 360, the form heading lands under the sticky header after connect.

Docs moved only by its step 2 copy and the CLS fix. Four of its five round 2 items are still open.

---

## Round 2 items: verified

| Round 2 item | Status | Evidence |
| --- | --- | --- |
| Site 1: shell injected after first paint | Fixed | Load CLS on a fast load: landing 0.007, migrate 0.000, status 0.007, docs 0.001, admin 0.002 at 1440, and 0.000 on every page at 393 and 360. Throttled, some pages still shift because page scripts fill empty containers: landing 360 0.151, migrate 1440 0.201, admin 1440 0.183. See the fixes below. |
| Site 2: toasts over content, Undo 32 px | Mostly fixed | No toast on connect, swap or claim (MutationObserver logged none). `.toast .btn` is `min-height: 44px`. The "Approved 20,000 old CT" toast remains (`migrate.js:371`): on both phones it sits over the step 2 lead and fee row, and it stays into "Swapping". |
| Site 3: 353 vs 352 days | Fixed | `CJ.daysLeft()` in `system.js:216`. Landing, swap, status and admin all read 352. |
| Site 4: lift and tilt on non actions | Fixed | 0 `[data-tilt]` and 0 `.mock.lift`. The mock buttons are `span.mock-btn` inside `aria-hidden` and are not focusable. `.st-card` no longer lifts. |
| Site 5: unlocked state has four names | Fixed | Heading, tag, totals and track caption all say "Being sent". The track foot says "Claimable now", and the button says "Claim 18,000 new CT". |
| Site 6: Kaia Wallet from a mobile browser | Fixed in the prototype | The Recommended row is now `https://app.kaiawallet.io/u/<page>`, the documented browser open link: one tap navigated there. The "Kaia Wallet did not open? Copy the link instead" line keeps the old steps as a fallback. Not yet tested on a real phone (the code comment says so). |
| Landing 1: CLS | Fixed | As above. |
| Landing 2: tilt on mocks | Fixed | The inner reveal animation was not added. That was optional. |
| Landing 3: live window line | Fixed | "Open now, 352 days left", with the swap window under it. |
| Landing 4: timeline dot rule | Fixed | A key reads Done (ink), Now (sky ring) and Later (hollow), and a "Now" tag marks "On every swap". |
| Landing 5: concept section on phones, Example tag | Fixed | `scroll-snap-type: x mandatory`, 310 px cards and four dots; a swipe lands on card 2. The hero track has an "Example" tag. |
| Swap 1: success moment on a phone | Fixed | Track centred, celebrate at the 10% block (x 43, y 356 at 360; x 45, y 316 on iPhone), no toast, Done in view and sticky. Claim celebrates at the 90% end (x 310). With reduced motion the check is still, has no sparks, and the scroll does not animate. |
| Swap 2: Kaia Wallet tap through | Fixed (see Site 6) | The tag now follows the sub line, so the row is 103 px against 127. WalletConnect now pays its own fee (`selfPay` includes `wc`), and the fee row says "About 0.016 KAIA". The sheet sub line does not say so yet (see fix 4). |
| Swap 3: page head on every step | Fixed | Connected on a phone, the head is 67 px instead of 169: a one line title, then "Open until Dec 1, 2027, 352 days left" as a 44 px disclosure (`aria-expanded`) for the lede. |
| Swap 4: one name, cl.body.one, lots told apart | Fixed | "Your 18,000 new CT finished its 7 day lock on Dec 20, 2026. Cojam sends it to your wallet within 30 minutes, or you can claim it now." Lots read "Swapped Dec 6, 14:06 UTC" and "Swapped Dec 6, 13:57 UTC". |
| Swap 5: finish items | Fixed | Claimed track all sky with "Claimed by you" and a check. `abc` shows a muted dash and "No amount yet" (screen reader text). "18,000 new CT" stays on one line at 1440. Toast Undo is 44 px. The closed state hides the head window line. |
| Status 1: one days left | Fixed | |
| Status 2: dead block under the chart | Fixed | The chart spans the full width. The track and "Locked CT by lock day" sit side by side and end level. |
| Status 3: readable aggregate track | Fixed | Figures under each tick, "Day 1, newest" and "Day 7, unlocks next", and the list in the same order. |
| Status 4: error vs sample note | Fixed | The error is an amber warning with Retry, and the sample note is neutral info. |
| Status 5: one amount format, card lift | Fixed | Whole CT at 1,000 and above (49,787), two decimals below (341.95). No lift. |
| Docs 1: step 2 gas line | Fixed | EN, KO and JA all now read "free with Kaia Wallet; a small KAIA fee with MetaMask". |
| Docs 2: scannable special cases | Not done | Still heading plus paragraph. |
| Docs 3: "Which wallet should I use?" block | Not done | |
| Docs 4: Contact, what to do now | Partly | It adds "treat any account that offers help in a DM as a scam". There is still nowhere to go, and the app's reserve error "Contact support" still lands here. |
| Docs 5: lock rules track "Example" | Not done | |
| Admin 1: align with the header | Fixed | Logo, H1 and footer brand are all at x 192 on admin (and on every page except docs, whose H1 sits beside the TOC by design). |
| Admin 2: compact mobile rows | Fixed | Two line rows (wallet and amount, then status and time left), about 60 px. The page is 6,540 px at 360, against about 8,800. |
| Admin 3: urgency first | Fixed | "Releases overdue" is the first tile with `?keeper=late`. Runway leads the gas panel with `gas=low`. |
| Admin 4: KPI 2x2 | Fixed | Compact 2x2 tiles, notes behind "Show notes". |
| Admin 5: per wallet fee limit | Not done | |

---

## 1. Landing `/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | |
| Layout | 8 | Desktop: the hero card still sits small in its column with air under it. Mobile is now tight. |
| Spacing | 9 | |
| Type | 9 | EN and KO are clean. The JA H1 breaks inside a word at 360 (see fix 1). |
| Colour | 9 | The timeline now has a key (Done, Now, Later), and Now is a sky ring. |
| Consistency | 9 | The same 352 days as swap, status and admin. |
| Density | 9 | The concept previews are a one screen snap row on phones. |
| Copy | 9 | |
| Mobile | 9 | |
| Finish | 9 | Fast load CLS 0.007. No false affordances on the mocks. |
| **Total** | **89** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | "Open now, 352 days left" in the hero. |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 4 | |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 3 | |
| Aesthetic, minimal | 4 | |
| Error recovery | 3 | |
| Help | 4 | |
| **Total** | **37** | |

Mobile 9. Interaction 8: the press and ripple on primaries, FAQ rows that open smoothly, and a carousel snap with a dot that follows. Nothing moves that cannot be used.

### Top fixes

1. **The JA hero H1 breaks inside a word at 360.**
   - Where: `site/assets/base.css:13` (`:lang(ja) h1 { word-break: auto-phrase }`) with the 36 px hero size.
   - Problem: it renders "2019年から続く / 元祖予測マーケッ / ト。" because the phrase "元祖予測マーケット。" is wider than the 328 px line, so Chromium breaks it anywhere. Safari has no `auto-phrase`.
   - Change: under 400 px set `:lang(ja) .hero h1 { font-size: 30px }`, which fits 10 characters. Or put explicit break points in `i18n/landing.js` `hero.title` (ja): `2019年から続く<wbr>元祖<wbr>予測マーケット。`.
2. **Reserve the hero card's height.**
   - Where: `site/assets/pages/landing.css` `.hero-card`.
   - Problem: on a throttled load at 360 (CLS 0.151), the card grows from 89 to 188 px when `landing.js` fills it, and pushes the lede and the CTA.
   - Change: give it a `min-height` equal to its filled height at each breakpoint, or put the example track markup in `index.html` and let the script only fill text.
3. (Optional) Desktop hero: let the card take the full column height (`align-self: stretch`), or add the timeline key's "Now" line inside it, so the right column is not a small island.

---

## 2. Swap app `/migrate/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | |
| Layout | 9 | The compact head brings every step's heading to about 287 px. Success fits heading, lead, track, tx, Add and Done in one 740 screen. |
| Spacing | 9 | |
| Type | 9 | |
| Colour | 9 | The claimed track is sky with a check. It reads as done. |
| Consistency | 9 | "Being sent" everywhere. 352 days. |
| Density | 8 | Claim view: two buttons in the sticky bar (about 130 px). The compact head title "Swap old CT for new CT" sits right above the panel title "Swap old CT". |
| Copy | 9 | "Your 18,000 new CT finished its 7 day lock on Dec 20, 2026. Cojam sends it to your wallet within 30 minutes, or you can claim it now." |
| Mobile | 9 | The success moment lands. Kaia Wallet is one tap. |
| Finish | 8 | Three defects: the approve toast covers content on phones, the reduced motion connect leaves the heading under the header at 360, and on a throttled desktop load the empty panel grows from 102 to 593 px (CLS 0.20). |
| **Total** | **88** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | 0 lots in the ledger during pending, "Confirming on Kaia" in history. |
| Match with real world | 4 | |
| User control | 4 | Back, Esc, Cancel, the head disclosure and the sheet all behave. |
| Consistency | 4 | |
| Error prevention | 4 | `abc` and `1e5` are refused with a reason and the button is disabled. Above 1,000,000 the review gate needs "I checked the amount". |
| Recognition | 4 | |
| Flexibility | 4 | One tap Kaia Wallet open link, MetaMask dapp link, Enter, Esc, `?`. |
| Aesthetic, minimal | 3 | The approve toast over the lead, the two button sticky bar on the claim view. |
| Error recovery | 3 | The reserve error's "Contact support" still leads to "to be announced". |
| Help | 4 | |
| **Total** | **38** | |

Mobile 9. Interaction 9:

- Press: scale 0.97 from pointerdown, held 90 ms, with a ripple on primaries only. Under reduced motion it is shade only.
- Track: the history track fills from `is-armed`.
- Success:
  - Smooth scroll to the centre, then the check, ring and ten sparks from the 10% block.
  - On a claim, the same from the 90% end.
  - Under reduced motion: a still check and no animated scroll.
- Sheet: slides up, and closes by drag, Esc, backdrop or X.

### Top fixes (ranked by impact)

1. **Drop the "Approved" toast on phones.**
   - Where: `site/assets/pages/migrate.js:371`, `render(true); CJ.toast(t("toast.approved", ...))`.
   - Problem: the toast sits right above the sticky "Swap 20,000 old CT" button, covers the step 2 lead and fee row on iPhone 15 and on 360, and is still up during "Swapping 20,000 old CT".
   - Change: the step 2 heading and the lead ("Approved. Now sign the swap ...") already say it, and the live region announces it. Do it the same way as connect, swap and claim: `say()` and no toast.
2. **The claim view hides its track on iPhone 15.**
   - Where: `V.claim` and `stickyBar()` in `migrate.js`, `.mg-sticky` in `migrate.css`.
   - Problem: at `?days=7.01` the track is at 514 to 637 in a 659 viewport. The sticky bar holds "Claim 18,000 new CT" and "Swap old CT instead" and starts at about 530, so the signature track is almost fully covered on arrival. On 360x740 a third of it is.
   - Change: stick only the primary. Move "Swap old CT instead" inline under the track (a ghost row, as `addRow()` does on success). Under 600 px, shorten the claim lead to its first sentence with the rest in the track caption.
3. **Reduced motion: the heading lands under the sticky header after connect.**
   - Where: `render()` in `migrate.js` (`h.focus()`).
   - Problem: on 360x740 with `prefers-reduced-motion: reduce`, after the one tap connect `scrollY` stays at 258 and `#mg-h` top is 29, under the 57 px header. The panel title "Swap old CT" is hidden. With motion, the page is at 0.
   - Change: after focus, if `#mg-h` top is under the header bottom, call `scrollIntoView({ block: "start", behavior: "auto" })`, which respects `scroll-padding-top: 72px`. Or do the same scroll to 0 in both paths.
4. **Say in the sheet that WalletConnect pays KAIA.**
   - Where: `site/assets/i18n/shell.js`, keys `wl.sub.wc.mobile`, `wl.sub.wc.desk` and `wl.kaia.wc` (EN, KO, JA).
   - Problem: the app now treats WalletConnect as self pay ("About 0.016 KAIA" in the fee row), but the sheet does not say so.
     - The WalletConnect row reads "Connect another wallet app on this phone."
     - The Kaia fallback view says "you need no KAIA", then offers "Connect Kaia Wallet with WalletConnect instead".
   - Change:
     - Sub line: "Connect another wallet app. Pays a small KAIA fee for each step."
     - Link: "Use WalletConnect instead (pays a small KAIA fee)".
   - Also, in `wallet.js` `kaiaLink()`: before launch, test `https://app.kaiawallet.io/u/` on an iPhone and an Android phone, with a page URL that carries `?lang=ko&ref=x`. If the `&` is lost, pass the URL without its scheme (as in the docs example `/u/google.com`) or `encodeURIComponent` it.
5. **Tell a returning holder that the keeper sent the 90%.**
   - Where: `V.empty` and the form view in `migrate.js`.
   - Problem: at `?days=8` after a full balance swap, the panel says "All old CT in this wallet is swapped. Your swaps and their release dates are in your history." The 112,500 new CT that arrived is only in the history below the fold.
   - Change: once per lot (a `seenRelease` flag in the ledger), show the existing keeper copy as a sky note at the top of the panel: "112,500 new CT was sent to your wallet automatically on Dec 20, 2026."
6. **Smaller items.**
   - Reserve error: replace "Contact support" with "What to do" linking `docs/#special`, or drop the button until channels exist.
   - Throttled desktop CLS 0.20: give `#mg-panel` a `min-height` (about 560 px at 1024 and up), or ship the disconnected view in `migrate/index.html`.
   - The head collapses 1.8 s after the connect tap (CLS 0.18 on both phones). Collapse it at the tap, when the wallet view opens.
   - Compact head on phones: hide the H1 visually (keep it for screen readers), since the panel title follows 60 px below it.

---

## 3. Status `/status/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | |
| Layout | 9 | Full width daily chart; the track and the lock day list side by side and level. |
| Spacing | 9 | |
| Type | 9 | |
| Colour | 9 | The error is amber, the sample note is neutral. |
| Consistency | 9 | 352 days, one amount rule. |
| Density | 8 | On a phone the 8 recent cards are 155 px each (about 1,300 px). Each says "Released" twice ("Released 1 hour ago" and the Released tag). |
| Copy | 9 | |
| Mobile | 9 | |
| Finish | 8 | Desktop error note: Retry sits alone on a second line in a 1,100 px wide note. |
| **Total** | **88** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | |
| Match with real world | 4 | |
| User control | 3 | |
| Consistency | 4 | |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 4 | Table and Cards, chart as a table. |
| Aesthetic, minimal | 3 | The recent list is long on a phone. |
| Error recovery | 4 | |
| Help | 3 | Sublines but still no term popovers ("keeper", "Being sent", "Reserve left"). |
| **Total** | **36** | |

Mobile 9. Interaction 8: count up holds width (CLS 0.007), the aggregate track rises, and no card moves under the finger.

### Top fixes

1. **Recent activity on phones.**
   - Where: `site/assets/pages/status.js` around line 322 (`.st-card`).
   - Change: show 5 cards and a "Show all 8" button, or a 72 px row (amount and tag on line one; wallet, time and tx on line two). Drop the duplicate word: tag "Released" plus "by the keeper, 1 hour ago".
2. **Error note layout at 1024 and up.**
   - Where: `status.css`, `.note-warn` with its Retry button.
   - Change: put Retry at the right end of the one line message (`display: flex; align-items: center; justify-content: space-between`), not on its own row.
3. **Term help.** Add the shared `.help` popover to "Locked (90%)", "Released", "Reserve left" and "Holders swapped", reusing the app's `help.*` copy, so "keeper" and "reserve" are explained where they appear.

---

## 4. Docs `/docs/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 8 | Special cases are still heading plus paragraph. |
| Layout | 9 | |
| Spacing | 8 | |
| Type | 9 | |
| Colour | 9 | |
| Consistency | 9 | |
| Density | 8 | 7,636 px at 360. |
| Copy | 9 | Step 2 now matches Fees. |
| Mobile | 8 | |
| Finish | 9 | CLS 0.001. |
| **Total** | **86** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 4 | |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 3 | |
| Aesthetic, minimal | 4 | |
| Error recovery | 4 | |
| Help | 3 | There is still no contact. |
| **Total** | **37** | |

Mobile 8. Interaction 7.

### Top fixes (carried over from round 2)

1. **Make special cases scannable.**
   - Where: `site/docs/index.html` `#special`.
   - Change: a bordered list, one row per case (exchange, Klayswap pool, multisig, lost access, small balance), each with an icon and a 16 px semibold title. On mobile each row is a `details.smooth`, so the section is one screen tall.
2. **Add "Which wallet should I use?" above Step by step.**
   - Change: three paths named exactly as the connect sheet names them, with what each costs:
     - "Open in Kaia Wallet": no KAIA.
     - "Open in MetaMask": a small KAIA fee.
     - "WalletConnect": a small KAIA fee.
3. **Contact.**
   - Where: `docs.contact.b`.
   - Change: add one action the reader can take today, for example "Check announcements on this site only", with a link to `#safety`. This section is where the app's reserve error lands.
4. **Lock rules track: add the "Example" tag** used in the swap history (`.mg-example .tag`).

---

## 5. Admin `/admin/`

| Design criterion | Score | Why |
| --- | --- | --- |
| Hierarchy | 9 | Overdue first. |
| Layout | 9 | Aligned at x 192. |
| Spacing | 8 | |
| Type | 9 | |
| Colour | 9 | |
| Consistency | 9 | |
| Density | 8 | 6,540 px at 360. |
| Copy | 8 | |
| Mobile | 8 | |
| Finish | 9 | |
| **Total** | **86** | |

| Nielsen | /4 | Note |
| --- | --- | --- |
| Visibility of status | 4 | |
| Match with real world | 4 | |
| User control | 4 | |
| Consistency | 4 | |
| Error prevention | 3 | |
| Recognition | 4 | |
| Flexibility | 4 | `/` focuses search. |
| Aesthetic, minimal | 4 | |
| Error recovery | 3 | |
| Help | 3 | |
| **Total** | **37** | |

Mobile 8. Interaction 7.

### Top fixes

1. **Per wallet fee limit in the gas wallet panel.**
   - Where: `site/assets/pages/admin.js`, the gas panel, and `i18n/admin.js`.
   - Change: add a tile "Per wallet limit: N KAIA a day, M wallets reached it today". That is the cause of the app's sponsor error, and ops cannot see it.
2. **Throttled desktop CLS 0.18.**
   - Where: `admin.css`, `.adm-gas` and `.adm-charts`.
   - Problem: the gas panel grows from 141 to 271 px and the charts appear late.
   - Change: reserve their heights with `min-height`.
3. **Mobile length.**
   - "Top wallets" and "Large swap watch" are about 1,400 px under the request list.
   - Change: put each in a `details` on phones, closed by default, with the count in the summary.

---

## Site wide

1. Load CLS is solved on a normal load. On a slow phone network, three containers that page scripts fill still grow: landing `.hero-card`, `#mg-panel` and the admin gas and charts panels. Reserve their heights.
2. Use toasts only where no view change announces the event. The last offender is `toast.approved`.
3. Reduced motion paths must scroll to the same place as the motion paths (swap fix 3).
4. Device test before launch: the Kaia Wallet `/u/` link on iOS Safari and Android Chrome, with a query string.

## Project rules check

| Rule | Result |
| --- | --- |
| One accent only for primary action and current selection | Pass (28 audits). |
| One primary per view | Pass. |
| Units on figures | Pass. |
| No dash as a sentence break, no tracked capitals, no eyebrows, no middle dot | Pass (grep of all i18n files, captures). |
| No card inside a card | Pass. |
| 44 px targets | Pass, toast Undo included. The JA sheet fallback line wraps to two lines inside its 44 px. |
| 4.5:1 text | Pass. |
| Visible focus | Pass. Every Tab stop shows a 2 px brand ring, and the language select shows it on its label. |
| No horizontal scroll at 360 | Pass. |
| Reduced motion | Pass on effects (no ripple, sparks, ring, arming or smooth scroll). Fail on one position (swap fix 3). |
| Never a lot before the mock chain confirms | Pass (0 lots during pending). |
| Concept previews labelled not live | Pass. |
| Sample data labelled | Pass, except the docs lock rules track (no "Example"). |
| Honest wallet and fee copy | Pass in app and docs. Partial in the mobile sheet: WalletConnect is not marked as paying KAIA. |

## What works and must be kept

- The success landing: `land()` in `migrate.js`. It centres the track only when it is not near the middle, celebrates from the part that just arrived (10% block, or the 90% end on a claim), sends no toast, and announces through `say()`. Done is sticky.
- The compact phone head with the window line as a 44 px disclosure.
- The one tap Kaia Wallet open link as Recommended, with the copy link fallback line right under it in the same group.
- The one vocabulary ("Being sent"), the claim lead, and lots named by UTC time.
- The shell scripts before `<main>`: CLS near 0 on a normal load.
- Landing: the live hero line, the timeline key, the mobile snap carousel, inert mocks (span buttons in `aria-hidden`), and the "Example" tags.
- Status: the full width chart, the labelled aggregate track mirrored by the lock day list, the amount rule, neutral sample note and amber error.
- Admin: the alignment, urgency ordering, 2x2 KPIs with notes in `details`, and two line request rows.
- Everything round 2 asked to keep still holds:
  - the press system and reduced motion fallback;
  - the sticky named primary and the 16 px input that stays above the keyboard;
  - the sheet's grip, drag, Esc and focus return;
  - the amount parser;
  - the state machine and its recovery paths;
  - docs anchors;
  - a clean audit.

## Korean and Japanese spot check (360)

- KO reads naturally on landing, swap (ready, locked, releasing, history), status, docs and admin.
  - The round 2 nit is fixed: "12,500 신규 CT (10%)".
  - At 360 the locked track's right caption wraps to "2026년 12월 20일에 / 90%" (two lines). That is acceptable, but a short date ("12월 20일에 90%") would hold one line.
- JA has natural copy and no missing keys or overflow.
  - The hero H1 breaks inside "マーケット" (landing fix 1).
  - The sheet fallback line "Kaia Walletが開かない場合は、リンクをコピーしてください" wraps to two centred lines inside a 44 px button. Shorten it to "開かない場合はリンクをコピー".
