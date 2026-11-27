# Matchday

A design variation of the Cojam Daily Prediction PWA. Product, information, copy and data are unchanged; only the look and the motion are new.

## The idea in five sentences

1. Every question is a fixture: its two answers face each other as two kits, striped orange on the left and solid Cojam blue on the right, split by one slanted cut with a VS plate on it.
2. The day is a five match card ("Match 3 of 5", five slanted pips), and the fifth pick blows the full time whistle: a broadcast wipe, the words Full time, and a flip digit final score that counts how many times you went left and how many times right.
3. Numbers live on a scoreboard: a dark board with one bulb yellow for the figures that matter (points, pool, countdowns), set in condensed athletic numerals and flip digit tiles.
4. Results are a results table with W and L marks and a form guide, and the weekly ranking is a league table where the ten prize places carry a promotion band and your own row is the inverted "your club" row.
5. The money screens are the club office: the same boards, tables and type, but square buttons, no slants on actions and no broadcast motion, so staking, wallet and convert read as calm and exact.

## Palette

| Token | Value | Role | Contrast |
| --- | --- | --- | --- |
| `--chalk` | `#F3F1EA` | page ground (the light kit) | ink on it 16.3:1 |
| `--kit` | `#FFFFFF` | cards, panels, fields | ink on it 18.4:1 |
| `--chalk-2` | `#E9E6DC` | wells, pending marks, disabled | secondary ink on it 6.5:1 |
| `--ink` | `#0E1420` | text, borders, the board, both bars | |
| `--ink-2` | `#47505F` | secondary text | 7.2:1 on chalk, 8.1:1 on kit |
| `--board-2` | `#1D2638` | digit tiles, the score bug | bulb on it 10.5:1 |
| `--on-board-2` | `#B4BCCB` | secondary text on the board | 9.7:1 on the board, 7.9:1 on tiles |
| `--bulb` | `#FFD23F` | scoreboard numerals, live state, active tab. Only on the board, or as a fill under ink | 12.8:1 on the board, ink on it 12.8:1 |
| `--home` | `#124CC4` | right answer, primary action, prize band edge | white on it 7.35:1 |
| `--home-tint` | `#E3EAFA` | prize places band | ink on it 15.3:1, home on it 6.1:1 |
| `--away` | `#C7380F` | left answer | white on it 5.25:1 |
| `--away-deep` | `#A32C0A` | the kit stripes of the left answer | white on it 7.2:1 |
| `--win` | `#0B6E3D` | the W mark and paid points | white on it 6.3:1, 6.3:1 as text on kit |
| `--caution-tint` | `#FFF3C4` | yellow card notices | ink on it 16.6:1 |
| `--sendoff` | `#B3261E` | red card: field errors | 6.5:1 on kit, 5.8:1 on chalk |

The two answer colours sit at only 1.4:1 against each other, so they never touch: a white cut always runs between them, and the left answer is also told by its stripes, its position, its arrow and its own words. The Cojam mark keeps its blue and always sits on a white disc when the bar behind it is dark.

## Type

| Role | Face | Notes |
| --- | --- | --- |
| Display, Latin and all numerals | Barlow Condensed 700 (Google Fonts) | condensed athletic face; short English display lines are set in capitals, never tracked |
| Display, Korean | Do Hyeon 400 (Google Fonts) | signage weight Hangul that sits next to the condensed Latin; scaled to 82%, line height 1.18, no synthetic bold |
| Display, Japanese | M PLUS 1p 800 (Google Fonts) | scaled to 74%, line height 1.25 |
| Body, labels, buttons | Pretendard Variable, Pretendard JP Variable for `:lang(ja)` | the brand face; labels are sentence case, one step smaller, untracked |
| Addresses | system monospace | wallet and contract addresses only, always in full |

Numerals are tabular everywhere. Scale: 13 label, 14 secondary, 16 body, 22 section head, 34 question, 44 board figure, 76 full time.

## The five rules that make it Matchday

1. **One cut.** A single slanted cut (12 px of run) shapes the banners, the score bug, the VS plate, the pips, the primary action on the pitch and every wipe. Nothing else is decorated.
2. **Two kits, never by colour alone.** Left is striped orange with a left arrow, right is solid blue with a right arrow, each carries its own words, and a white cut separates them. The same swatch and arrow follow a pick into results.
3. **Yellow belongs to the board.** Bulb yellow appears only on the dark scoreboard surfaces (figures, live state, active tab) or as a fill under ink (banners, the Undo plate, the yellow card). It is never text on a light ground.
4. **Tables, not cards in cards.** Results and ranking are ruled tables with one ink frame; W is a filled green square, L is an outlined square, waiting is a clock, so a column reads at a glance and without colour.
5. **The office is square.** On staking, wallet, convert, profile and invite, buttons lose the slant, motion drops to press feedback, figure rolls and sheets, and every amount sits in a key and value row.

## What was avoided

- Real leagues, clubs, crests, broadcasters or their lettering: every graphic is drawn for this variant.
- Gradients for depth, glass, glow, drop shadows, emoji, rounded pill chips, status dots.
- Tracked small capitals as labels: capitals are used only for short English display lines in the condensed face (recorded as the one waiver in `tokens.css`).
- Pitch green as a ground colour, turf textures, stadium photos: the sport is carried by structure and type.
- Red for "miss": a miss is an outlined L, so the left answer's orange is never read as "wrong".
- A scrolling marquee: the ticker rolls one line at a time and holds still under reduced motion.
- Confetti for the reward: the reward is the whistle, the wipe and the score.
