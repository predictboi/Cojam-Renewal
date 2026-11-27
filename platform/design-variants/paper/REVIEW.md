# Review: Concept A, Daily Paper

Self review by the designer who built it (no independent reviewer was run for this variant). Method: capture every screen with Playwright, run `tools/design/audit.js` on every screen, look at every capture at full size, score, fix, capture again. Two full rounds, plus a first build pass.

## How it was checked

- **Captures:** `node tools/capture-all.js` writes `captures/<screen>-<lang>-<width>.png`: every screen at 390 x 844 in EN and KO, home, home partial, done and ranking also at 360 x 780, and home, done, ranking and results in JA at 390. Device scale 2, touch on, fonts loaded, motion settled.
- **Audit:** `sh tools/audit-all.sh <lang> <width> <height>` runs the repository audit on 31 URLs (screens and their main states). Run in EN, KO and JA at 390 x 844 and in EN at 360 x 780.
- **Flow:** `node tools/flow-test.js` plays the day on the card view: a touch swipe right, Undo (the card comes back and the count returns to 0), a swipe left, a tap, an arrow key, two more swipes, "Finish now", and the day done screen with the reward (points go from 1,250P to 1,350P). It passes.
- **Guidelines:** the pinned Web Interface Guidelines (`web-design-guidelines`) were walked against `components.css`, `assets/app.js` and the screens.

## Audit result, last round

| Check | Result |
| --- | --- |
| Horizontal overflow | 0 on every screen, at 390 and at 360 |
| Text contrast under 4.5:1 | 0, with one known exception: on a player's very first visit the teaching nudge shows the answer stamp at 40% opacity for 1.5 seconds (`span.qstamp`, `aria-hidden`). It is the "honest preview" of the drag, carried over from the current design, and never appears again. With the nudge already seen (`home.html?state=partial`) the screen reports 0 |
| Touch targets under 44 px | 0 |
| Accent use | Every blue fill, text and border listed by the audit is one of the four jobs: primary action, text link, reward (the "+100P" figure, HIT stamp and mark, the success figure in a sheet), the player's own row |
| Monospace | Flagged only on full addresses (hex groups that contain letters), the invite code and the invite link. These are the three places the data face is meant for |

## Scores, last round (each out of 10)

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 9 | One thing leads each screen: the question on home, "+100P" on done, the pool and the leader on ranking, the CT balance on wallet, the interest on staking. Three clear levels: slab figure or headline, bold text, grey text |
| Typography | 9 | Besley for headlines and figures, Pretendard for everything operated or read in rows; Hahmlet and Noto Serif JP keep the same sturdy voice in Korean and Japanese while numerals stay Besley. Sizes far apart (12 to 16 for text, 21, 26, 32, 44, 56, 88 for display). Weak spot: Noto Serif JP is a mincho, lighter in colour than the slab |
| Colour discipline | 9 | Paper, ink, one blue with four jobs, two answer inks, three status colours used only for status. Home at rest has no blue except the mark |
| Spacing rhythm | 8 | 16 px gutter, 20 px between blocks, 16 px above a section rule, 12 px inside. The home screen fits 390 x 844 and 360 x 780 without scrolling. Convert and first run leave a quiet middle on tall phones |
| Component consistency | 8 | One masthead, one dateline, one tab bar, three button looks, one segmented pattern, one row pattern for both ranking lists, one notice between rules, one hold notice, one sheet. The list view "Pick" buttons are heavier than the rest of that screen |
| Brand character | 9 | Recognisable from any crop: thick and thin rule, dateline with the issue, slab figures, halftone pictures, stamps, numbered boxes. No screen falls back to a generic app look, including wallet and profile |
| Affordance | 8 | Everything pressable has a frame or an underline; the two answers are the only coloured blocks on home; a control that is off says why beside it. The question meta line (source and settle time) is a button whose only cue is the small info icon |
| Motion | 7 | The throw and Undo of the deck, the stamp landing a size up at the commit threshold, the "+100P" thunk and the boxes inking in, press feedback, the sheet. Transform and opacity only, reduced motion handled. No page entrance and no stamp animation on results: restrained, but less delight than the current design's reward burst |
| Density | 8 | Ranking shows the pool and six ranks above the own bar at 390 x 844 (five at 360 x 780); results shows the summary, the filter and four rows; wallet shows both balances and Convert on the first screen |
| Polish | 8 | Rules align to the 16 px gutter, figures share baselines in the three figure rows, ticking digits do not shake, long names truncate, KO and JA wrap by phrase. Remaining roughness is listed below |
| **Total** | **83 / 100** | |

## Round 1: what was found and fixed

- **Numerals.** With `tabular-nums` on the body, Besley switched to a different, hairline zero ("1,25**0**P", "1**0**°C"). Fixed: tabular figures only in the text face; the slab keeps its own figures, and ticking slab figures get equal width digit cells.
- **Deck order.** The last card of the set was on top. Fixed with explicit stacking per position; the two sheets under the card now show at the bottom edge like a stack of papers.
- **Halftone.** The first pass printed the blue picture ground as white paper with outlines only. Rebuilt as a real screen (blur, multiply with a dot gradient, hard contrast), then lightened so the ground prints as a mid tone and the subject stays white.
- **Overflow on staking.** The amount field and the rate table pushed the page 20 px wide (grid children without `min-width: 0`). Fixed for every grid wrapper.
- **Question meta.** Two lines plus a separate 44 px button cost too much height on the card. Now one two line button (source, settle time) that opens "How answers are set".
- **Ranking header.** "Ends in" appeared twice (pool and dateline). The dateline keeps it; the pool row now pairs the figure with "How prizes work".
- **Ranking leader.** The prize of rank 1 ran past the right gutter. Lead rows now share one prize size and the columns hold.
- **Login.** The dateline's third cell overflowed with a long sentence. It now says "Opens at 09:00 KST".
- **Audit.** The language select was 42 px tall; the chosen lock period on a blocked form was grey on ink (2.3:1); the support email was set in the data face. All fixed.

## Round 2: what was found and fixed

- **Ranking at 360.** The pool figure broke between "C" and "T" and the link wrapped. The pool figure is one size smaller and never breaks; the row wraps as a whole if it must.
- **Ranking density.** Only four ranks were visible above the own bar. The leader row went from 78 to 66 px, ranks 2 and 3 from 58 to 52, the rest to 44: six ranks at 390 x 844, five at 360 x 780.
- **Empty home.** The countdown inherited the paragraph style (15 px grey) and the block sat at the top of an empty page. The countdown is now the 44 px figure and the block sits at optical centre.
- **List thumbnails.** Tried line art (too pale) and an enlarged crop (lost the subject on two pictures); kept the full picture with a finer screen.
- **First run.** The figure panel was a fixed 232 px and left a gap on tall phones; it now takes 38% of the height, between 232 and 330 px.
- **Home title.** The card view and the list view used different title sizes; both are 26 px, so the question stays the headline.
- **Sheets.** `overscroll-behavior: contain`, explicit colours on the native select, `touch-action: manipulation` on controls, `scroll-margin-top` on the "Around you" anchor, the success figure centred over its title.

## Web Interface Guidelines: findings kept open

- Copy: the guidelines ask for Title Case on headings and buttons; the house rule (CLAUDE.md and the current design) is sentence case. House rule kept.
- Loading labels do not end with an ellipsis ("Saving", "Loading"): the shared dictionary is unchanged by design.
- The language is the player's choice and is never detected from the device: a product decision carried over.
- `user-scalable` is not restricted; zoom works.

## What I would still improve

1. **Japanese display face.** Noto Serif JP at 900 reads lighter and more formal than Besley and Hahmlet. A heavier Japanese slab or antique face (for example Kaisei Tokumin ExtraBold or Zen Antique) should be tested on real question lengths.
2. **Halftone cost.** The screen is three CSS filters on a live element. It is fine on the one front card, but on older phones the drag could drop frames. In production the server should print the halftone once per picture (the look is deterministic) and ship a 1 bit PNG.
3. **List view thumbnails** are the weakest pictures: at 56 px the screen turns to texture on two of five pictures. A dedicated square crop per question would fix it.
4. **Reward moment.** The thunk and the inking boxes are quiet. A stamp sound, a haptic pattern and a one time "extra edition" flash of the masthead rule would add delight without leaving the concept.
5. **Question meta affordance.** The source and settle line is a button with only an info icon as its cue; a short underlined "How answers are set" would be clearer at the cost of one line.
6. **Results rows on a long day** are tall (60 px and more). A denser table mode for players with weeks of history would help.
7. **Screens not rebuilt in this variant:** deposit and withdraw are sheets on the wallet (not full pages with every error state), the install gate, the maintenance, update and not found system screens, and the invite code sheet on profile. The admin is out of scope.
8. **An independent review** (a second reviewer using the pages by touch and keyboard, as the handoff method asks) has not been run. The scores above are my own.
