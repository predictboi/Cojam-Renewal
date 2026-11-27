# Concept A: Daily Paper

A design variation of the Cojam Daily Prediction PWA. Same product, same information, same copy and data; a different visual concept.

Open `index.html` (the hub) from a static server, for example `python3 -m http.server 8851 -d platform/design-variants/paper`, then `http://localhost:8851/index.html?lang=ko`.

## The idea in five sentences

1. The day's five predictions are the front page of a small daily newspaper: each question is a lead story with a kicker, a picture, a headline and a line that says how it will be answered.
2. The masthead carries the nameplate and the player's points, and under it a dateline gives three real facts: the date, the issue (day of the week and week number) and one live figure of the screen, such as the time until the set closes.
3. Every tab is a section of the same paper: the front page (home), the box scores (results, with HIT and MISS stamps), the league table (ranking), the rates page (staking) and the accounts (wallet).
4. Structure comes from rules, not boxes: a thick and thin rule closes the masthead, ink hairlines divide sections, light hairlines divide rows, and column rules divide figures that sit side by side.
5. The paper is printed in black plus one spot ink, the Cojam blue, and the two answers have their own two inks, persimmon on the left and teal on the right.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#F4EFE4` | The page: warm newsprint |
| `--sheet` | `#FBF8F0` | A fresh sheet: the question card, fields, bottom sheets, the open row in the list |
| `--paper-2` | `#E9E2D2` | The halftone ground, skeletons, pressed states |
| `--ink` | `#16130E` | Text, rules, the inverted current segment, the own rank bar |
| `--ink-2` | `#574F43` | Secondary text |
| `--ink-3` | `#857B6A` | Field edges and switched off edges only, never text |
| `--line` | `#CDC4AF` | Hairlines between rows |
| `--accent` | `#124CC4` | The spot ink (Cojam blue), four jobs only |
| `--pick-l` / `--pick-r` | `#F07A4B` / `#2FBBA3` | The two answers: persimmon left, teal right |
| `--up`, `--down`, `--warn` | `#1F6B43`, `#A62B1B`, `#7A4E00` | Real status only |

Contrast ratios (WCAG 2.1, checked by script and by `tools/design/audit.js` on every screen):

| Pair | Ratio |
| --- | --- |
| ink on paper | 16.2:1 |
| ink-2 on paper / on sheet / on paper-2 | 7.0 / 7.6 / 6.3 |
| blue on paper / on paper-2 | 6.4 / 5.7 |
| white on blue (the primary action) | 7.35:1 |
| ink on persimmon (hot shade) | 6.7 (5.8) |
| ink on teal (hot shade) | 7.5 (6.3) |
| paper on ink / on-ink-2 on ink (own rank bar, toast) | 16.2 / 10.3 |
| up, down, warn on paper | 5.7 / 6.1 / 6.3 |
| blue on blue tint (own row) | 5.8:1 |

Never: persimmon or teal as text on paper (2.4 and 2.1), blue text on ink (2.5). The two answer inks have the same OKLCH lightness (0.706 and about 0.71), so neither looks like the recommended answer.

The blue has four jobs: the primary action, text links, the reward (the "+100P" figure, the HIT stamp and its small mark), and the player's own row in a table. The current tab, the current segment and a chosen option are ink, never blue. The home screen at rest carries no blue except the mark in the nameplate.

## Type system

| Role | Face | Use |
| --- | --- | --- |
| Display | **Besley** (a Clarendon slab, variable 500 to 900, Google Fonts) | Headlines at 800, figures at 900: questions, page titles, balances, points, ranks, prizes, rates, the answers on the two buttons, stamps |
| Display, Korean | **Hahmlet** (a Korean slab serif, variable, Google Fonts) | Hangul in every display role; Latin letters and numerals in Korean text stay Besley because Besley comes first in the stack |
| Display, Japanese | **Noto Serif JP** at 900 (Google Fonts) | Kana and kanji in every display role, switched by `:lang(ja)`; numerals stay Besley |
| Text | **Pretendard Variable**, Pretendard JP under `:lang(ja)` (the brand face, jsDelivr) | Every label, row, sentence, button label, table cell, the dateline |
| Data | system monospace | Addresses, the invite code and the invite link only |

Scale (px): 12, 13, 14, 15, 16, 18, 21, 26, 32, 44, 56, 88. Body 16; rows and captions 13 to 15; nothing below 12. Headlines use `text-wrap: balance`, Korean `word-break: keep-all`, Japanese `line-break: strict`.

Figures: the slab keeps its own proportional figures (its tabular zero is a lighter, different glyph, so `tabular-nums` is applied only in the text face: tables, the dateline, rows). A figure in the slab that ticks every second (countdown, staking interest) sets each digit in a cell of one width (`.dg`), so the line does not shake.

Labels are sentence case and untracked everywhere. The only capitals are the result stamps.

## The five rules that make this concept itself

1. **Rules, not boxes.** A screen is one sheet of paper. The masthead closes with a thick and thin rule, sections open with a 1 px ink rule, rows are divided by light hairlines, side by side figures by a column rule. The only framed objects are things you can pick up or press: the question card, fields, buttons, a sheet, the hold notice. Corners are square (2 px on controls only), and nothing has a soft shadow.
2. **The dateline tells the truth.** Date, "Day 5, week 48" and one live fact (closes in, next set in, week ends in, updated). It sits on every tab root, so the time that matters is always in the same place and never needs a second label.
3. **The slab carries what matters.** Headlines and every figure that matters are Besley at 800 or 900; everything you operate or read in a row is Pretendard. A zero is never a hero: "0P" drops to plain grey text.
4. **Three inks with fixed jobs.** Black for the paper, blue for action and reward, persimmon and teal for left and right. The answer colour follows a pick everywhere as a small printed block: the pick bar, the list, day done, results.
5. **Print marks carry state.** Pictures are printed through a halftone screen in one ink (CSS only, any picture works). A result is a stamp: HIT in blue with two frames, MISS hollow, at a slight angle; "Corrected" is a dashed stamp. The day is five numbered boxes: empty, hatched while a pick is being saved, inked when it is in. The drag preview is the answer as a stamp that lands a size up once a release would pick.

## What was deliberately avoided

- Gradients as decoration, glass, blur, glow, soft shadows, emoji. The only gradients are the halftone dot screen and the hatch of a pending box, and both carry information.
- Paper texture, grain, torn edges, fake folds, ageing, sepia: the paper is a flat colour. The newspaper is in the structure, not in a costume.
- Blackletter or script in the nameplate, drop caps, justified body text, multi column body copy on a phone.
- A high contrast "editorial" roman with a clay accent: the display face is a sturdy slab and the only accent is the brand blue.
- Tracked capitals for labels, small caps kickers, middle dots between meta items (column rules do that job), arrows glued to link text.
- Cards inside cards, pill buttons, grey filled buttons, a podium drawing (the top three are larger rows of the same table).
- Blue for anything outside its four jobs: not for the current tab, not for progress, not for a figure that is not a reward.
- Colour as the only signal: the two answers also differ by side, arrow and label; a stamp differs by word, frame and fill.

## What stayed the same

The product and its rules (5 questions a day, swipe left or right or tap or arrow keys, 3 second Undo, "Finish now", +100P for all five, +50P per hit, results, weekly ranking with prizes, staking, wallet with convert, deposit and withdraw, invite, profile, account on hold), the information on every screen, the copy and the mock data (`assets/i18n.js` and `assets/mock.js` are unchanged copies), the Cojam mark, left and right answers in two distinct colours, 44 px touch targets, WCAG AA contrast, reduced motion support, EN / KO / JA.

Wording added for the concept, in three languages (`assets/paper-i18n.js`): the issue on the dateline ("Day 5, week 48"), the card number ("No. 1 of 5"), and the three column heads of the ranking table (Rank, Player, Points). The nameplate "Cojam Daily" is a logo and is not translated.

## Files

| Path | What |
| --- | --- |
| `index.html` | Hub: every screen and state, with `?lang=en|ko|ja` |
| `tokens.css`, `components.css` | Tokens and every component and screen style |
| `assets/app.js` | Shell and builders (new), behaviour carried over from `platform/design/assets/components.js` (deck, Undo, sheets, transactions, countdowns, QR) |
| `screens/*.js` | One script per screen; the HTML files are thin shells |
| `tools/` | `capture-all.js`, `shot.js`, `sheet.py`, `flow-test.js`, `audit-all.sh` |
| `captures/` | `<screen>-<lang>-<width>.png` |
| `REVIEW.md` | The quality loop: scores of the last round and what was fixed |
