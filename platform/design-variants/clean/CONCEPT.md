# Concept D: Clean

A design variation of the Cojam Daily Prediction PWA. Same product, same information, same data and the same meaning of the copy as `platform/design/`; a different visual concept. Open `index.html` (hub of every screen and state, `?lang=ko|ja`).

## The idea in five sentences

1. Every screen says one sentence to the player in plain spoken language, and one figure answers it: "CT you can use now" is followed by `1,840.5 CT`, "You are #27 this week" by the board.
2. The ground is white and nothing has a border: things that belong together sit on one soft grey block, and space does the rest.
3. Blue is spent only on the reason a screen exists and on its one action: the prediction card on home, the reward on the done screen, the first place bar in the ranking, the main button on a money form.
4. The prediction card is the only large colour mass in the whole app, so it stays the exciting centre: it is brand blue at rest and turns into the colour of the answer the moment a swipe would commit.
5. Motion is small and always means something: figures count up when they change, sheets rise on a drawer curve, the next card comes up to meet a drag, and a tick draws itself when the day is done.

## Palette

All ratios are WCAG contrast ratios, computed from the token values in `tokens.css`.

| Token | Value | Role | Contrast |
| --- | --- | --- | --- |
| `--paper` | `#FFFFFF` | Ground of every screen | base |
| `--fill` | `#EEF1F6` | Soft block, field, chip, plain button | base for blocks |
| `--fill-press` | `#E4E8F0` | Pressed state, progress track, skeleton | not used behind text except the pressed state |
| `--ink` | `#0F1B33` | Text, the Undo bar, the pinned own rank bar | 17.1:1 on paper, 15.1:1 on fill |
| `--ink-2` | `#46536B` | Secondary text | 7.8:1 on paper, 6.8:1 on fill |
| `--ink-3` | `#586479` | Captions, switched off text | 5.9:1 on paper, 5.3:1 on fill, 4.9:1 on fill-press |
| `--blue` | `#124CC4` | The one brand colour: the card, the primary button, a hit, the current choice | white on it 7.35:1, as text 7.35:1 on paper and 6.7:1 on fill |
| `--blue-tint` | `#E6EEFE` | Soft button, chosen option, own row in the ranking | blue text on it 6.3:1 |
| `--blue-2`, `--blue-3` | `#3A66CC`, `#86A4E4` | Second and third card of the deck (no text) | not used behind text |
| `--on-blue-2` | `#DCE7FF` | Secondary text on the card | 5.9:1 on blue |
| `--left` | `#B94A00` | Left answer (no, down, under): persimmon | white on it 5.2:1 |
| `--left-tint` / `--left-ink` | `#FFECDD` / `#9C3D00` | Left answer at rest, pick chips | 5.9:1 |
| `--right` | `#08786D` | Right answer (yes, up, over): teal | white on it 5.4:1 |
| `--right-tint` / `--right-ink` | `#DCF3EE` / `#0A665C` | Right answer at rest, pick chips | 5.9:1 |
| `--danger` | `#B3261E` | Errors only | 6.5:1 on paper, 5.7:1 on its tint `#FDECEA` |

The two answers sit at OKLCH lightness 0.55 (persimmon) and 0.53 (teal), so neither looks like the recommended one, and neither is the brand blue, so the blue never takes a side. The answer colour is always paired with a position (left or right), an arrow and the answer's own words, so it never carries meaning alone.

## Type system

One family per language: Pretendard Variable for English and Korean, Pretendard JP Variable for Japanese (switched by `:lang(ja)`), tabular numerals everywhere. Korean wraps by word (`word-break: keep-all`), Japanese by phrase. There is no display face: size and weight carry the hierarchy.

| Step | Size / line | Weight | Used for |
| --- | --- | --- | --- |
| Hero figure | 44 px / 1.12 (56 px on the reward) | 700, tracking -0.035em | The one figure of a screen, unit at 46% size in secondary ink |
| Spoken headline | 26 px / 1.32 | 700 | The sentence that opens a screen, the question on the card |
| Title | 20 px / 1.3 (22 px in sheets and states) | 700 | Section titles, figures in rows of three |
| Body | 17 px / 1.5 | 500 to 600 | Row titles, buttons, fields |
| Sub | 15 px / 1.5 | 400 to 600 | Sentences under a headline, key and value rows |
| Caption | 14 px / 1.4 (13 px in chips, 12 px in the tab bar) | 400 to 600 | Notes, row sub lines, chips |

Sentence case only. No label is set in capitals or tracked out. Monospace appears only for wallet addresses.

## The five rules that make this concept itself

1. **One sentence, one figure.** A screen opens with a headline that talks to the player and states a fact ("3 to go."), then the figure that matters at 44 px. Labels above figures are small and quiet; the figure never shares its line with decoration.
2. **Blue is spent, not spread.** Solid blue appears only on the reason the screen exists (the card, the reward, first place) and on its one primary action; supporting actions are pale blue tint or grey. Everything else is ink on white or ink on the soft grey block.
3. **Blocks, not borders.** No outline, no card shadow, no divider between sections. A group is a soft grey block with a 20 px radius; a list is rows with air between them; a block never holds another block.
4. **The answer colours belong to the answers.** Persimmon is always left, teal is always right. They rest as pale tints (buttons, pick chips) and go solid only when a pick is about to happen or is being pressed: the whole card takes the colour at the swipe threshold.
5. **Full width and reachable.** The main action is a 56 px full width button pinned above the tab bar, rows are 64 px, fields are 56 px, and every target is at least 44 px. Controls that are off say why in the line next to them.

## Motion

| Moment | What moves | Curve and time | Why |
| --- | --- | --- | --- |
| Press | Button scales to 0.98, row gets a grey ground | `--ease-out`, 120 ms | Feedback |
| Swipe | The card follows the finger (rotation up to 8 degrees); the next card rises to 97% with its question readable; at 35% of the width the card takes the answer colour and the answer button goes solid | direct, then 160 ms colour | Honest preview: the card never shows a pick it would not make |
| Release | Thrown card leaves in 280 ms, a short drag springs back with a small overshoot in 420 ms, the next card rises in 360 ms | `--ease-out`, `--ease-back` | Spatial consistency |
| Undo | A dark bar rises in the hint slot with a 3 second ring; Undo flies the card back in from the side it left | 200 ms in and out, ring linear | State, and the ring is information |
| Fifth pick | The deck gives way to a 3 second ring with "Finish now" | 320 ms | State |
| Day done | The blue disc settles from 92%, the tick draws, the headline rises, `+100P` counts from 0 and the points pill counts with it and bumps once | 380 to 700 ms, staggered 80 ms | The one place with a delight budget |
| Figures | Interest, converted CT, the pool and the balance count to their new value | 260 to 600 ms, ease out | State change that stays readable (tabular numerals) |
| Sheets | Rise from the bottom, backdrop fades | `cubic-bezier(0.32, 0.72, 0, 1)`, 420 ms in, 300 ms out | Spatial consistency |
| Segmented control | The white thumb slides to the chosen segment | `--ease-out`, 240 ms | State |

Only `transform` and `opacity` animate, plus colour on the card and the stroke offset of the three small rings. Under `prefers-reduced-motion` nothing moves on its own: the deck cross fades, figures jump to their value, the tick is simply there; the countdown rings keep running because they are information.

## What was deliberately avoided

- Any copy of a real product: no borrowed logo, illustration, 3D icon, colour value or screen. The principles are spoken headlines, grey blocks, big figures and full width buttons; the look is Cojam blue with persimmon and teal.
- Gradients, glass, blur, glow, emoji and decorative status dots. The only shadows are the hairline under the segmented thumb and the lift under a card while it is dragged.
- Borders and outlined cards, cards inside cards, dividers between sections.
- A second accent. The current design's lime is gone: selection, progress, reward and the primary action are all the one blue.
- Capital letter labels, tracked small caps, an eyebrow above headlines, a coloured word inside a headline, monospace for labels.
- Icon tiles as decoration on marketing style fact lists (login uses plain ticks); icons are one monoline set and appear only where they help find a row.
- Invented figures: the card shows no crowd split or odds because the product has none.
- Illustration with outlines and grids (the current look). Question pictures are flat shapes in white and pale blue that take the colour of the card, so they survive the change to the answer colour.

## Files

- `tokens.css`: every colour, size, radius and curve. `components.css`: every component. No colour or font is written outside the tokens.
- `assets/app.js`: shell (header, tab bar, sheet, toast, count up, press feedback). `assets/screens-play.js` and `assets/screens-money.js`: the screens. `assets/copy.js`: the spoken headlines in EN, KO and JA, added on top of `assets/i18n.js`, which is the product dictionary copied unchanged, as is `assets/mock.js`. `assets/qr.js` is the QR generator of the current prototype.
- `capture.js`: Playwright captures into `captures/<screen>-<lang>-<width>.png`. Preview: `python3 -m http.server 8854 -d platform/design-variants/clean`.
- Review states that hold one moment still: `home.html?state=armed` (a swipe at the threshold), `?state=undo`, `?state=finishing`.
