---
name: ui-review-loop
description: Build and check websites and app screens until they hold up on a phone. Use when building a new site or screen, raising the design or usability quality of an existing one, doing mobile QA, adding interaction and motion, comparing design directions, or when the user asks to "check the site", "make it less plain" or "make it work on mobile". Bundles Playwright capture and audit scripts, a contrast checker, a token starter and an independent reviewer brief.
---

# UI review loop

A working method that took a product from 58 to 86 of 100 on an independent design score, and a second one to the same range in three rounds. Use it together with the other kit skills: `hallmark` or `impeccable` to set direction, this skill to build and verify, `web-design-guidelines` and `animate` for the details.

Paths below are relative to this skill's folder. Copy `scripts/` into the project (for example `tools/design/`) on first use.

## 0. Before building

1. Gather the content first: what the page must say, every state a flow can be in, real numbers. Load design skills only after that.
2. Fill a one page brand sheet: name, primary colour and the text colour on it, secondary candidates, type, logo, tone. Check every colour pair with `node scripts/contrast.js "#fg/#bg"` before it goes into a token.
3. For a big piece, show the structure (sections, states, components) in one message and get a yes before building.
4. Start from `templates/tokens.css`. Every colour, size, space and duration lives there; pages never hard code them.

## 1. Design rules that moved scores

1. **Start from scratch, keep only the colours.** Restyling an old layout capped scores near 79. A fresh build with the old palette scored higher on the first try.
2. **One accent with exactly two jobs:** the primary action and the current selection. Never a data colour, a delta or decoration. Green and red for change only, amber for warnings only.
3. **One signature element** that carries the product idea and repeats everywhere (a conversion bar, an outcome tape, a progress track): landing, app, dashboard and success state.
4. **Type:** one family, tabular numerals for figures, a tight scale (12, 13, 14, 16, 20, 24, 32 plus one display size), weights 400, 500, 600, sentence case, monospace only for addresses and hashes.
5. **Surfaces:** page ground, one raised level, one inset level for inputs, hairline borders, radius 8 for controls and 12 for panels, never a card inside a card.
6. **One primary button per view.** Everything else is outline or ghost.
7. **Dimmed is still readable:** secondary text uses a muted colour that passes 4.5:1. Never lower text opacity.
8. **Same thing looks the same:** one shared shell (header, footer, buttons, forms) loaded on every page. Per page inline styles cause drift.
9. **Words:** say what happens, name the thing in the button ("Swap 12,500 CT"), plain result sentences, no middle dot chains.
10. **Translations read native, not literal.** Write each language in its own natural voice and keep a fixed term list; check that no button wraps or overflows at 360 px in any language.

### Bold directions ("not plain")

When a user wants more energy, use **two quiet colours and one loud colour**: the loud colour as the ground of the hero and closing band, white and a deep ink as the quiet pair, and at most one new key colour for stickers, arrows and the main action. Big display type (a wide heavy or a tall condensed face; give non Latin scripts a heavy weight of the body family), floating glass cards over the headline, a rotating circular badge, a tilted ticker band, hand drawn arrow strokes. Check the new key colour on every ground it touches; pick ink text on it when white fails 4.5:1.

To let someone choose, build two or three directions of the same page with the same copy, put an A / B / C switch fixed at the bottom of each, and link them from one hub page.

## 2. Mobile first gate

Most visitors arrive on a phone. A page is not done until it passes at 360, 390 and 430 px:

- Touch targets 44 px or more, inputs 16 px text (no zoom on focus), no hover only affordances, safe areas respected.
- No horizontal scroll (rotated or bleeding decoration goes inside a clipping wrapper).
- The first screen shows real content and the primary action. Sticky primary action within thumb reach on app screens.
- Tighter rhythm on phones: about a third less vertical space between blocks (see the phone override in `templates/tokens.css`); touch targets stay 44 px.
- Wide content becomes a swipe row with snap points, not a squeezed grid.
- Wallet or app handoff (if any): deep links that reopen the page in the app's browser, plus detection when already inside it.

## 3. Interaction and motion

Every control answers touch, nothing blocks input:

- Press: scale 0.97 and a quick shade, held at least 90 ms so a tap still shows. Cards: lift on hover, settle on press.
- Primary button: a ripple or glow from the touch point. Signature element animates the first time it scrolls into view.
- Count up figures, reveal on scroll that arms only after the first scroll (a page that is never scrolled, such as a capture, shows everything).
- A success moment when the main task completes.
- Light ambience allowed: slow drifting glows, a faint logo motif, gradient hairlines, all at low alpha and never behind text alone.
- Rules: transform and opacity only, 120 to 240 ms for feedback, spring easing for release, pause off screen loops, full `prefers-reduced-motion` fallback (static, nothing moves), contrast checked where glows overlap text.

## 4. Usability behaviours to build (Nielsen, as features)

- Status: every async state visible, skeletons while loading, "updated 3s ago" stamps, balance next to every amount field.
- Control: a way back from every step, Esc closes sheets, Cancel while waiting on an external app.
- Error prevention: a forgiving amount parser ("1,250.75", "40 CT") that refuses junk with a reason, a Max button, a review step for large amounts.
- Recovery: inline errors next to the cause, with the fix as a button.
- Help: a one line "How this works" disclosure, help popovers on every term.
- Accessibility floor: 4.5:1 text, visible focus, keyboard reachable, `aria-live="polite"` on status.
- Every state reachable by `?state=name` so it can be captured and reviewed.

## 5. The loop (every round)

1. **Capture** each screen at 1440x900 and 390x844:
   `node scripts/shot.js page.html out.png 390 844 --mobile --full`
   Options: `--css file` and `--jsfile file` (repeatable, injected after load), `--js "code"`, `--clip x,y,w,h`, `--wait ms`. Query strings work (`page.html?state=review`). Shared shell files can be appended to every capture with `KIT_EXTRA_CSS=a.css:b.css` and `KIT_EXTRA_JS=...`. Look at every capture yourself before anyone scores it.
2. **Audit**: `AUDIT_ACCENT=#124CC4 node scripts/audit.js page.html 390 844 --mobile`
   Prints horizontal overflow, page errors, text under 4.5:1, targets under 44 px, monospace misuse and every place the accent appears. `AUDIT_TICKERS="CT|KAIA"` lets ticker words sit in monospace. It is a helper, not the judge. It reads solid background colours only: text on a gradient or image ground is reported against the nearest solid colour, so check those pairs by eye and with `scripts/contrast.js` at the lightest point the text crosses.
3. **Independent score**: spawn a reviewer that did not build the screen, with `templates/reviewer-brief.md`. It scores 10 design criteria (100) and Nielsen usability (40) by actually using the page, and writes `.md` and `.json` with the top fixes.
4. **Fix** the top items and rescore. At most four rounds per screen. Target 85+ design and 34+ usability.
5. **Show** the result on one page: a hub that links every page and every state, so the person can check it on a phone in one tap each.

Measure, do not guess: page height at 360 px before and after spacing changes, CLS with network throttling, frame rate at 4x CPU throttle for ambient effects.

## 6. Pitfalls already paid for

- Scroll reveal hid content in captures and audits: arm reveals only after a real scroll, and have capture scripts force them visible (the bundled scripts do).
- A class name reused for two components (`.track` for a marquee and a progress bar) restyled both: prefix component classes.
- `.parent div` selectors hit nested divs: use `.parent > div`.
- Rotated full bleed bands caused horizontal scroll on phones: wrap them in an `overflow: hidden` container.
- Huge display headlines overflowed at tablet widths: size them with `clamp()` against the longest word, then capture 768 and 1024 too.
- A grey segment with white text failed contrast: dark ink on light fills.
- `open(p, "w").write(fix(open(p).read()))` truncates the file before reading it: read first, then write.
- A page without `<meta charset="utf-8">` showed mojibake for symbols: always set it.
- Agents working in parallel committed over each other: give each agent strict file ownership.
- Never show a result before it is confirmed (a balance, a payout, a migrated amount).
