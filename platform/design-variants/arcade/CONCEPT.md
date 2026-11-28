# Concept: Pocket Arcade

A design variation of the Cojam Daily Prediction PWA. Same product, same information, same copy and data; a different visual concept.

Open `index.html` (the hub) from a static server, for example `python3 -m http.server 8855 -d platform/design-variants/arcade`, then `http://localhost:8855/index.html?lang=ko`.

## The idea in five sentences

1. The app is a toy you hold in one hand: five collectible cards a day, two chunky keys under each card, and a sticker that is slapped onto the card the moment you pick.
2. Everything pressable is thick: a key stands five pixels above its side in the deep shade of its own colour, and a press pushes the face down onto it.
3. The day is a sticker sheet of five slots that fills up pick by pick, and the fifth sticker opens a capsule: the lid flies off, Jam the mascot jumps out and a "+100P" coin sticker lands.
4. The weekly ranking is a league podium (second, first and third standing on blocks of different height) with ranks 4 to 10 in one calm table below.
5. The money screens (staking, wallet, convert) use the same cards and keys with the toys put away: no stickers, no mascot, flat cards, one blue action and figures in the display face.

## Palette

A cream ground and four flat colours. Every colour has one meaning, and each has a deep shade that is only ever the side of a pressable thing.

| Token | Value | Role |
| --- | --- | --- |
| `--cream` | `#FBF3E1` | The ground: warm cream plastic |
| `--card` | `#FFFDF7` | A card face, a field, a sheet |
| `--well` | `#F1E5C8` | A recess: empty sticker slots, tracks, skeletons, quiet chips |
| `--edge` / `--edge-deep` | `#E0CFA4` / `#C9B27C` | The rim and the side of cream things; field outlines |
| `--ink` / `--ink-2` | `#1F1B2E` / `#5C566E` | Text; secondary text. `--ink-3` `#8B8498` is for switched off marks only, never text |
| `--accent` (blue) | `#124CC4`, deep `#0B3285`, tint `#DCE6FA` | Cojam blue: the primary action, links, the current tab, the player's own row, Jam |
| `--pick-l` (coral) | `#FF6B4A`, deep `#C9401F` | The left answer, and nothing else |
| `--pick-r` (mint) | `#2FCB98`, deep `#17936B` | The right answer, and nothing else |
| `--sun` (yellow) | `#FFC83A`, deep `#D99A0B`, tint `#FFEFC2` | The reward: points, done stickers, first place, the Undo key |
| `--up`, `--down`, `--warn` | `#0E7A4E`, `#B8281C`, `#8A5300` | Real status only |

Contrast ratios (WCAG 2.1; checked by `tools/design/audit.js` on every screen):

| Pair | Ratio |
| --- | --- |
| ink on cream / on card | 14.9 / 16.4 |
| ink-2 on cream / on card / on well | 6.5 / 7.2 / 5.7 |
| blue on cream / on card | 6.8 / 7.5 |
| white on blue (the primary action, the current tab) | 7.35 |
| ink on coral (left answer key and sticker) | 6.0 |
| ink on mint (right answer key and sticker) | 8.2 |
| ink on yellow (stickers, Undo, first place) | 11.0 |
| cream on ink (own rank bar, toast, third place) | 14.9 |
| up / down / warn on cream | 4.9 / 5.7 / 5.7 |

Never: coral, mint or yellow as text on cream; white text on coral, mint or yellow.

The two answers are never told apart by colour alone: the left answer always sits on the left with a left arrow, the right answer on the right with a right arrow, both carry their own words, and a made pick is shown everywhere as a small token with the arrow of its side plus the answer text. Coral and mint never mean good or bad: a hit is a yellow sticker, a miss is a dashed outline.

## Type system

| Role | Face | Use |
| --- | --- | --- |
| Display | **Lilita One** (Google Fonts) | Headlines, figures, the words on keys and stickers, ranks, prizes |
| Display, Korean | **Bagel Fat One** (Google Fonts) | Hangul in every display role: the same mass and soft corners as Lilita One. Latin letters and numerals in Korean text stay Lilita One, because it comes first in the stack |
| Display, Japanese | **M PLUS Rounded 1c** at 900 (Google Fonts) | Kana and kanji in every display role, switched by `:lang(ja)`; numerals stay Lilita One |
| Text | **Pretendard Variable**, Pretendard JP under `:lang(ja)` (the brand face, jsDelivr) | Every label, row, sentence, table cell, caption |
| Data | system monospace | Addresses, the invite code and the invite link only |

The display faces have one weight, so display text is never synthesised bold (`font-synthesis: none`). Scale (px): 12, 13, 14, 15, 16, 18, 21, 24, 28, 34, 44, 56, 80. Body 16; rows and captions 13 to 15; nothing below 12. Headlines use `text-wrap: balance`, Korean `word-break: keep-all`, Japanese `line-break: strict`. Question titles in Korean and Japanese are set one step smaller with more leading, because the fat Hangul and kana need air. Tables and live figures in the text face use tabular numerals; a ticking figure in the display face sets each digit in a cell of one width.

## The five rules that make this concept itself

1. **Thick or flat, nothing in between.** A thing you can press stands on a side in its own deep shade and goes down when pressed. A thing you cannot press is flat. There are no blurred shadows, gradients or glows anywhere.
2. **Four colours, four meanings.** Blue acts, coral is left, mint is right, yellow rewards. Illustrations use blue, yellow, white and ink only, so coral and mint are never seen outside an answer.
3. **A pick is a sticker.** The answer is slapped onto the card as a die cut sticker with a white rim, the day fills a sticker sheet, a result is a sticker, the reward is a coin sticker. Stickers are the only things set at an angle.
4. **Big corners, one rim.** Cards 28 px, groups 22 px, keys 18 px, chips fully round, all with one 2 px rim in the edge colour. Groups never nest: a card holds rows divided by a 2 px line, never another card.
5. **Toys stay off the money.** Staking, wallet, convert and every transaction sheet carry no mascot, no stickers at an angle and no burst. The one exception is the small "Done" sticker on a successful transaction, the same reward sign as everywhere.

## Illustration and mascot

- One picture per category, each from four flat shapes or fewer: a coin (crypto), rising bars (markets), a sun behind a cloud (weather), a ball (sports), a clapperboard (culture), a coin with an arrow (the KAIA question). Each keeps its subject in the middle square so the same drawing crops to a list thumb. They are inline SVG drawn for this concept (`assets/app.js`, `ART`).
- Jam is a small blue blob with two eyes, the creature that lives in the capsules. Jam appears in four places only: the "all five" wait on home, the reward, the "no set yet" and "nothing here yet" empty states. Three moods: smile, cheer, asleep.

## What I avoided

- Pixel art and anything retro: every shape is a smooth vector.
- Gradients, glass, glow, soft drop shadows, emoji, confetti that stays on screen, decoration without a job.
- The black outline with an offset black shadow of the usual "neo brutal" look: depth here is the deep shade of the same colour, and rims are the cream edge colour.
- A mascot on every screen, and any play on the money screens.
- Uppercase or tracked labels, mid dot meta strings, cards inside cards.
- Telling the two answers apart by colour alone, or using red and green as good and bad.

## Files

- `tokens.css`: every colour, face, size, radius, depth and duration. `components.css`: the shell, components, screens and motion.
- `assets/app.js`: the shared shell and behaviour (deck, Undo, sheets, mock transactions, countdowns, QR), the illustrations and the mascot. `assets/i18n.js` and `assets/mock.js` are copied unchanged from `platform/design/`; `assets/arcade-i18n.js` adds the eight labels this concept needs, in EN, KO and JA.
- `screens/*.js`: one file per screen. `index.html`: the hub. `MOTION.md`, `REVIEW.md`, `captures/`, `tools/`.
