# Concept B: Night Desk

A design variation of the Cojam Daily Prediction PWA. Same product, same information, same copy and mock data as `platform/design/`; a different visual concept. Hub: `index.html` (add `?lang=ko` or `?lang=ja`). Preview: `python3 -m http.server 8852 -d platform/design-variants/night`.

## The idea in five sentences

1. Cojam at night is a small trading desk for casual players: a near black ground, ruled like a ledger, where every number is a readout and nothing is decoration.
2. The two answers own the only two signal colours, amber on the left and the brand sky on the right, so colour on this desk always means "which side".
3. Every figure (points, CT, countdowns, rates, ranks, addresses) is set in one mono numeral face and sits in a cell divided by hairlines, while every word stays in Pretendard.
4. The signature is the balance rail under the card: a tick scale with the two commit marks, whose needle follows the finger, so the player sees exactly how far a swipe is from counting.
5. Depth comes from flat surfaces laid on each other and from hairlines; the question picture is printed in one ink as a dimmed plate behind the question, and the moments that matter (a pick, the +100P, a held amount) are told by state, not by effects.

## Picks (Hallmark, app scope)

- **Direction:** custom, by request (Night Desk). Genre modern minimal, shape: app screen. Sweep done by hand (the packaged skill has no scripts): the Floor walked manually, `tools/design/audit.js` on every screen.
- **Signature:** the balance rail (home), echoed by tick marks wherever something is measured: day ticks, hit ticks, the prize split, stake progress.
- **Material:** real: every figure in `assets/mock.js`. Pictures: the five project owned question illustrations, printed in one ink. Absent: live pick splits and price sparklines (the mock has no such data, so none is drawn).

## Palette

All values are tokens in `tokens.css`. Ratios are WCAG contrast against the surface named.

| Token | Value | Job | Contrast |
| --- | --- | --- | --- |
| `--bg` | `#090C12` | The desk (page ground) | |
| `--s1` | `#0F131B` | Raised: header, tab bar, sheets, notices | |
| `--s2` | `#161B25` | Cells, fields, skeletons | |
| `--s3` | `#1E2430` | Pressed, current language | |
| `--plate` | `#1B2B4D` | Ground of the question picture | text on it 12.3:1 |
| `--line` / `--line-2` | `#252C3A` / `#3A4458` | Hairline between rows / rule between sections, tick marks | structure only |
| `--line-strong` | `#5C6882` | Edge of a control | 3.5:1 on the desk, 3.1:1 on `--s2` |
| `--text` | `#EDF0F5` | Text, figures | 17.1:1 desk, 16.3:1 `--s1`, 15.1:1 `--s2` |
| `--text-2` | `#AAB3C5` | Labels, secondary text | 9.3:1 desk, 8.2:1 `--s2`, 6.7:1 plate |
| `--text-3` | `#8791A7` | Quiet marks, row numbers, idle tabs | 6.2:1 desk, 5.9:1 `--s1`, 5.5:1 `--s2`, 4.9:1 `--s3` |
| `--warm` | `#FFB454` | Left answer (no, down, under) | dark text on it 11.1:1 |
| `--cool` | `#97DBFF` | Right answer (yes, up, over): the brand sky | dark text on it 13.0:1 |
| `--paper` | `#EDF0F5` | The one action, the current choice, the tile under the mark | dark text on it 17.1:1 |
| `--paper-off` | `#2A3140` | A switched off primary (keeps its shape) | its text `#A3ADC0` 5.8:1 |
| `--you` | `#124CC4` | Brand blue, meaning "you": avatar, own row in the ranking | white on it 7.35:1 |
| `--danger` | `#FF8A7A` | Failure only | 8.6:1 desk, 7.5:1 `--s2` |

The two answer colours sit at OKLCH lightness 0.82 and 0.86, so neither looks recommended. Brand blue is only 2.7:1 against the desk, so it is never text or a line there: it is a fill with white text, and the mark always stands on a paper tile.

## Type system

| Role | Face | Size and weight |
| --- | --- | --- |
| Words: titles, labels, copy, buttons | Pretendard Variable (EN, KO), Pretendard JP Variable (JA, switched by `:lang(ja)`), jsDelivr | Screen title 22 / 700; section head 17 / 650; body 15 / 400; label 13; smallest 12 |
| Figures: every number, unit, countdown, address, code | Chivo Mono (Google Fonts), weights 400 to 700 | 64 to 88 reward and offer; 44 balances; 24 key readouts; 20 cells; 17 rows; unit at 0.58 em, never under 12 px |

- Chivo Mono comes from the same foundry as Archivo, the display face of the current design, so the brand keeps its family while the tone changes.
- Mono is used for numerals and Latin units only. A Hangul or kana character inside a figure falls back to Pretendard through the font stack, so Korean and Japanese are never set in a mono face.
- A mono comma or point sits in a full cell and tears a number apart at display size. One rule (`.p`) pulls every such comma and point in by the same amount, so "1,840.5" reads as one number and columns still align.
- Fixed scale at about 1.2: 12, 13, 15, 17, 20, 24, 32, 44, 64. Labels are sentence case, never tracked capitals.

## The five rules that make this concept itself

1. **Colour says which side, who, or what failed, and nothing else.** Amber and sky are the two answers everywhere (buttons, drag stamp, needle, pick markers, the five day ticks). Blue is you. Red is failure. Everything else is paper on ink.
2. **Every figure is a readout.** Mono numerals, a quiet label above, a hairline between neighbours, values on one baseline across a row of cells. No figure floats in a sentence when it can stand in a cell.
3. **Ticks measure real things.** The rail measures the drag, five ticks the day, twenty ticks the week's hits, the split bar the prize pool, the bar under a name the points, the progress bar the lock. If nothing is measured, there are no ticks.
4. **Hatching means held.** A pick inside its Undo window, points on the way, a waiting answer, the locked part of a stake and an account on hold all carry the same diagonal hatch. Solid means settled.
5. **Paper is the one action.** One paper filled button per view, 52 px tall; the current choice in a segmented control takes the same paper. Secondary actions are outlines, tertiary ones underlined words.

## What I deliberately avoided

- Neon glow, glass and blur, purple or any decorative gradient (the only gradients are the picture scrim, the hatch and the tick pattern).
- Green for up and red for down: the product has two neutral answers, not a good and a bad one, and a casual player should not feel a trade was recommended.
- Fake market furniture: no candlesticks, no order book, no price ticker, no sparkline without data behind it, no live pick split the mock cannot support.
- Tracked upper case labels, terminal green, ASCII frames and mono set words: the desk is precise, not a costume.
- Emoji, icon tiles, drop shadows, cards inside cards, a podium, confetti. The reward is a figure that counts up once.
- A full blue header band: on a dark ground brand blue is saved for one meaning, so it keeps that meaning.

## What stays from the current design

Product rules and flows, all copy (`assets/i18n.js`, copied unchanged; twelve short labels added in `assets/app.js`), all data (`assets/mock.js`, copied unchanged), the Cojam mark on a light tile, the left and right answer colours as a pair, 44 px targets, the swipe rules (35% commit, fling thresholds, direction lock, honest preview capped at 0.4 below the mark), the 3 second Undo, "Finish now", one hold notice for one state, reasons next to switched off controls, reduced motion support.

## Notes for whoever builds on this

- Screens are static HTML that render through `assets/app.js` (shell, builders, the day's game) with tokens in `tokens.css` and components in `components.css`. States come from `?state=`; the hub lists them.
- Deposit and Withdraw are sheets on the wallet in this variant (`wallet.html?state=deposit`, `?state=withdraw`). The QR in the deposit sheet is a stand-in pattern: production draws the real code.
- The repository audit flags mono at display size as "MONO misuse". That check belongs to the current design's rules; here mono numerals are the material, and the audit's three required checks (overflow, contrast, targets) are all at zero.
