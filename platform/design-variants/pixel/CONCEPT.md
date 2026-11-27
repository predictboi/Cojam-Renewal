# Concept C: Pixel

A design variation of the Cojam Daily Prediction PWA. Product, information, copy and data are unchanged; the visual language is new.

## The idea in five sentences

Cojam Daily Prediction is drawn as a handheld game cartridge: every screen sits on one 4 px grid and is painted with sixteen named inks.
The header is a HUD (points are the score, the day's five questions are five energy cells), the question is a cartridge card with a pixel picture, and the ranking is a high score table under a podium of blocks.
Nothing curves and nothing fades: corners step, shadows are hard, tints are dither, and movement advances in frames.
Play is carried by the pixel face (Galmuri), while every sentence a player has to read, and every line on a money screen, stays in Pretendard.
The result should feel like a small studio shipped a real game about predictions, and then drew its bank statement with the same care.

## Palette: Cojam 16

Nothing outside this list is painted anywhere (tokens in `tokens.css`).

| Ink | Hex | Job |
| --- | --- | --- |
| ink | `#14152B` | outlines, text, HUD ground |
| night | `#1C2666` | band ground, high score panel |
| deep | `#0C3690` | the lip of a blue key |
| blue | `#124CC4` | brand, primary action, links |
| sky | `#8AD1FF` | secondary text on dark, second place |
| pale | `#D6EEFF` | tinted block, field action |
| paper | `#F4EFE1` | page ground |
| shade | `#DCD4BE` | paper in shadow, dotted rules, dither |
| white | `#FFFFFF` | cards, fields, lists |
| muted | `#595870` | secondary text |
| yellow | `#FFC72C` | coins, score, reward, the current selection |
| ember | `#FF8A3C` | the LEFT answer |
| rust | `#A6470A` | the lip of the ember key |
| mint | `#2CC7B0` | the RIGHT answer, live and unlocked states |
| pine | `#0B6F61` | the lip of the mint key, success text |
| red | `#C2301C` | errors |

Contrast ratios (WCAG 2.1), every text pairing that is used:

| Text on ground | Ratio |
| --- | --- |
| ink on paper / white | 15.60 / 17.92 |
| muted on paper / white / pale | 5.98 / 6.87 / 5.74 |
| blue on paper / white / pale | 6.40 / 7.35 / 6.14 |
| white on blue (primary button) | 7.35 |
| white / sky / yellow on night | 13.83 / 8.33 / 8.86 |
| white / sky / yellow on ink | 17.92 / 10.79 / 11.48 |
| ink on yellow / ember / mint / sky / shade | 11.48 / 7.64 / 8.45 / 10.79 / 12.12 |
| red on paper / white | 4.90 / 5.62 |
| pine on paper / white | 5.28 / 6.07 |

The two answers: ember sits left and mint sits right, always. They differ on the blue to yellow axis, which stays distinct under red green colour blindness, but their lightness is almost the same (1.11:1), so neither ever stands alone: each answer also carries its position, its own words and a pixel arrow pointing its way, and a pick is repeated as a small coloured square next to the chosen words.

The Cojam mark is used unchanged. On the near black HUD it sits on a white stepped tile, because blue on ink is only 2.6:1.

## Type system

| Role | Face | Sizes |
| --- | --- | --- |
| Display, figures, question titles | Galmuri11 Bold | 24, 36, 48 px (2, 3 and 4 times its 12 px design size) |
| Labels, chips, tab labels | Galmuri11 Regular and Bold | 12 px |
| Buttons, row titles, the high score table | Galmuri14 | 15 px (its design size) |
| Sentences, captions, rules, help, errors | Pretendard Variable (Pretendard JP for Japanese) | 13, 15, 17 px |
| Addresses | system monospace | 14 px |

- Galmuri is a Korean bitmap family (SIL OFL) that covers Latin, Hangul, kana and kanji in one drawing style, so English, Korean and Japanese share one display face. Loaded from jsDelivr (`galmuri@2.40.3`); Pretendard from the same CDN as the rest of the project.
- Pixel faces appear only at whole multiples of their design size, so every glyph pixel lands on the grid. There is no 18 px or 20 px pixel text anywhere.
- The bold cut has no kanji. A second family name (`Galmuri11 Kanji`) exposes only the regular file, so a bold kanji falls through to it and the browser thickens it; Latin, digits and Hangul always use the drawn bold. Galmuri14 has no bold cut, so buttons and row titles are made bold the way bitmap systems always did it: the glyph is printed twice, one pixel apart (`text-shadow`).
- Labels are sentence case and untracked. Numerals in countdowns sit in fixed tiles so the clock never jitters.

## The five rules that make this concept itself

1. **One pixel is 4 px.** Borders, corners, shadows, gaps and press travel are whole pixels. Half a pixel (2 px) is allowed only inside icons, small marks and the dotted rule between rows.
2. **Corners step.** A frame is drawn with four hard shadows, which leaves the corner pixel empty; filled blocks get the same stepped corner by clipping. There is no border radius in the system.
3. **Sixteen inks, and dither is the only blend.** No gradient, no transparency for tint, no blur. Pending, loading, disabled, the edge of the band and the backdrop of a sheet are all checkerboards of the same inks.
4. **Motion is frames.** Presses are instant (a key drops one pixel and its lip disappears). The card follows the finger in 4 px steps, a throw is six frames, the next card rises in four, the reward lands in a few hard frames, Undo is a fuse of six cells that go out one by one. Sprites animate by swapping drawings, never by tweening.
5. **Pixel for the glance, Pretendard for the sentence.** Anything read in a blink (score, figures, buttons, question titles, chips) is the pixel face; anything read as a sentence is Pretendard. On money screens sprites never move, each block has one figure, and warnings are plain sentences on solid grounds.

## Components worth knowing

- **HUD:** ink bar with the mark on a white tile, the score in yellow with a coin, the profile button. Sub pages swap the mark for a back arrow and a title.
- **Band and dither edge:** each tab root opens with a night blue band that holds the one thing the screen is about; its lower edge breaks into a two row checkerboard.
- **Energy cells:** the five questions of the day. Empty is an outline, held (inside Undo) is a blinking dither, saved is yellow.
- **Cartridge card:** white card with a hard shadow, a pixel scene for the category (16 x 16 sprites at 8 px per pixel), the question in the pixel face, the answer source and the settle time. Dragging shows the answer as a stamp; past the threshold the whole card takes a dithered wash of the answer colour and the matching key goes down.
- **Keys:** primary (blue), secondary (white), the two answers (ember, mint). All stand 4 px proud on an ink base and have a darker lip.
- **High score table:** night blue panel, ranks in yellow, names in white, points in sky, prizes in yellow, dotted rows; above it a podium of three blocks with a crown on first place; the player's own row is pinned as an ink bar.
- **Jam:** a small blue mascot (16 x 16) with four moods: idle with a blink, cheering, asleep (empty and paused states), dizzy (errors).
- **Sheet:** rises in five frames over a dithered backdrop; used for every review before value moves.

## What I deliberately avoided

- Neon on black, scanlines, CRT glow, chromatic aberration and fake screen curvature: the look is a clean cartridge, not a nostalgia filter.
- "Press Start 2P" and other wide arcade caps faces: unreadable in Korean and Japanese and loud in English.
- Pixel text for sentences, especially on staking, wallet and convert.
- Rotating or scaling sprites (it breaks the pixels): the card slides and lifts, it does not tilt.
- Smooth easing on anything pixel drawn, drop shadows with blur, gradients, glass, emoji, tracked capitals, decorative status dots.
- More than one moving thing per screen on the money screens, and any celebration there.
- Colour alone for the two answers, and red and green as the answer pair.

## Files

- `tokens.css`, `components.css`: the system.
- `assets/sprites.js`: all pixel art as text grids, rendered as crisp inline SVG. `assets/app.js`: shell and shared pieces. `assets/screens-play.js`, `assets/screens-money.js`: the screens. `assets/i18n.js`, `assets/mock.js`: copied unchanged from `platform/design/assets/`.
- `index.html`: the hub of every screen and state (`?lang=en|ko|ja`).
- `capture.js`: Playwright captures into `captures/`. `REVIEW.md`: the critique rounds and scores.

Preview: `python3 -m http.server 8853 -d platform/design-variants/pixel`, then open `http://localhost:8853/index.html?lang=ko`.
