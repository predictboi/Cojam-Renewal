# Poster

Cojam Daily as a poster of the International Typographic Style that happens to be an app.

## The idea in five sentences

1. Type is the image: every screen is carried by one enormous, tight grotesque figure or headline set flush left on a four column grid, and nothing is drawn that a numeral could say.
2. Each question is its own poster with one flat field (yellow, black or white), a giant numeral 1 to 5 bleeding off the corner, the question as the headline and one plain geometric form.
3. Colour is a decision: red and blue never appear until the player answers, when a red sheet (left) or a blue sheet (right) slides over the poster like a printed sheet laid on a stack.
4. The day's five answers are kept as five coloured tiles, and finishing the day locks them into a printed composition with registration marks while a yellow sheet prints +100 as large as the screen allows.
5. Money screens use the same voice turned down: one figure, the facts under hairlines, one black action, no colour at all except the yellow of a current selection.

## Palette

| Token | Value | Job | Contrast |
| --- | --- | --- | --- |
| `--paper` | `#F2F0E9` | the ground sheet | ink on it 16.8:1 |
| `--sheet` | `#FFFFFF` | fields, white poster, input ground | ink on it 19.2:1 |
| `--ink` | `#0F0F0F` | text, rules, the primary action | paper on it 16.8:1 |
| `--ink-2` | `#55524B` | secondary text | 6.8:1 on paper, 7.8:1 on sheet, 5.6:1 on mute |
| `--hair` | `#CBC7BB` | hairlines inside a group | not text |
| `--mute` | `#DEDBD1` | disabled fill, skeleton | ink on it 13.8:1 |
| `--yellow` | `#FFD400` | the house field: reward, points on the way, current selection | ink on it 13.4:1; never used as text on paper (1.3:1) |
| `--red` | `#D3221B` | the LEFT answer, nothing else | white on it 5.2:1; never used as text |
| `--blue` | `#124CC4` | the RIGHT answer and the Cojam mark, nothing else | white on it 7.4:1 |

The two answers are told apart four ways: side (left, right), glyph (a triangle pointing that way), the word, then the colour. Errors and holds are black blocks, not red, so red keeps one meaning.

## Type system

| Role | Face | Setting |
| --- | --- | --- |
| Display (figures, headlines, numerals) | Inter Tight 900, falling through to Pretendard Variable 900 for Korean and Pretendard JP Variable 900 for Japanese | tracking -0.045em (Latin), -0.035em (KO, JA), line height 0.9 (Latin) and 1.0 (KO, JA), word spacing +0.06em so tight words stay apart |
| Heads | the same family at 800 | tracking -0.025em, line height 1.08 (1.16 in KO, JA) |
| Text and labels | Pretendard Variable (Pretendard JP Variable under `:lang(ja)`) 400 to 700 | 16 / 14 / 13 px, sentence case, never tracked, never capitals |
| Numerals | tabular everywhere; contextual alternates off so `0x` stays an address | |

Scale: 152 (mega) / 88 / 56 / 40 / 30 / 22 / 17 / 16 / 14 / 13 px. Card numerals and state glyphs are sized from their container (`cqh`, `cqw`) so they always bleed the same way. Korean keeps whole words (`word-break: keep-all`), Japanese uses strict line breaking; both are set at 900 so they hold the page with the same weight as the Latin.

## Grid

A 430 px column, 16 px margins, 8 px unit, four columns. A 2 px ink rule opens a section, an 8 px rule opens the main one, 1 px hairlines divide rows inside it. Nothing has a radius, a shadow or a border that is not a rule.

## The five rules that make it Poster

1. One giant figure per screen, set from the grid and allowed to bleed; everything else is small and quiet next to it.
2. Flush left, ragged right, asymmetrical: nothing is centred except a label inside a button of the segmented control.
3. Flat inks as whole fields. Red means left, blue means right, yellow means "yours now"; black is action. No tints, no gradients, no shadows, no radius.
4. Rules and registration marks only where sheets meet or information divides. No icons where a word fits: the tab bar is five words.
5. Motion is paper: sheets slide in from the side they belong to, stop dead, and lock. Nothing bounces, glows or fades in for mood.

## What I avoided

- Illustration, icons in the tab bar, avatars, emoji, confetti.
- Rounded cards, drop shadows, glass, gradients, coloured tints of the inks.
- Capitals with tracking, eyebrows, centred hero stacks, decorative dots.
- Red for errors (it would blur the left answer) and blue for buttons (it would blur the right answer).
- Korean and Japanese as a lighter fallback: they get the same 900 weight, their own line heights and their own sizes for the page titles.

## Files

`index.html` is the hub. `tokens.css`, `components.css`, `assets/app.js` (shell, sheet, toast, figure roll), `screens/*.js` (one per screen), `assets/poster-i18n.js` (the few labels this concept adds, in EN, KO, JA), `tools/` (pages, captures, audit, flow test, motion run).
Preview: `python3 -m http.server 8856 -d platform/design-variants/poster`.
