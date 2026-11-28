# Ticket: concept

Folder: `platform/design-variants/ticket/`. Hub: `index.html` (add `?lang=ko` or `?lang=ja`). Preview: `python3 -m http.server 8858 -d platform/design-variants/ticket`.

## The idea in five sentences

1. Every prediction is a ticket you punch: the question is printed on a ticket, and the two answers are its perforated stub.
2. You pick by tearing: the ticket follows your finger, the stub snaps off at the perforation in the ink of your answer, and it drops into a tray that holds your five stubs for the day.
3. Undo tapes the ticket back together, and the tape stays on that ticket as an honest mark that you changed your mind.
4. The fifth stub makes the counter print your day as one strip of five tickets, and +100P is stamped on its last coupon.
5. Everything after that keeps the same paper: results are checked tickets with punch marks, the ranking is a prize board of numbered places, a stake is a certificate with a maturity date, and the wallet holds a CT pass and a points punch card (ten holes to the next CT).

## Palette

One paper tone in two weights (the counter and the ticket stock), ink black, two answer inks and one highlighter.

| Token | Value | Job | Contrast |
| --- | --- | --- | --- |
| `--ground` | `#E2E7E1` | the counter: app background | |
| `--ground-2` | `#D5DCD4` | wells: the stub tray, segmented tracks | |
| `--stock` | `#FBFCF8` | ticket stock: every ticket, slip and sheet | |
| `--stock-2` | `#EFF3EC` | printed tint panel on stock (pictogram, notes) | |
| `--ink` | `#14181C` | text, selected option, own rank bar | 17.3:1 on stock, 14.2:1 on ground, 11.8:1 on mark |
| `--ink-2` | `#49525A` | secondary text | 7.7:1 on stock, 6.4:1 on ground, 5.7:1 on ground-2 |
| `--line-strong` | `#78827A` | control edges, perforations (non text) | 4.0:1 on stock, 3.2:1 on ground |
| `--blue` | `#124CC4` | right answer, primary action, links, the +100P stamp (the Cojam primary) | 7.1:1 on stock, 5.9:1 on ground; stock text on it 7.1:1 |
| `--red` | `#B82A14` | left answer, errors, the on hold stamp | 6.0:1 on stock, 5.0:1 on ground; stock text on it 6.0:1 |
| `--mark` | `#FFCB2E` | highlighter: points only (the points pill, +50P, hits, punched holes, the tape) | ink on it 11.8:1 |

The two answers are never told apart by colour alone: left is always on the left with a left arrow, right is on the right with a right arrow, and each carries its own label; the stub in the tray keeps the arrow and the question number.

## Type system

- **Archivo** (variable, width and weight axes) for everything in Latin: heads at width 88 and weight 800, figures at width 88 and weight 800 with tabular numerals, body at normal width, 15 px, weight 400 to 600. It is a sturdy grotesque with the slightly condensed cut of transit and receipt printing.
- **Pretendard Variable** follows in the same stack and sets Korean; **Pretendard JP Variable** sets Japanese (switched by `:lang(ja)`). Heads in KO and JA use weight 800 with a looser line height (1.2 to 1.26), so they match the weight of the Latin heads. Latin letters and digits inside Korean and Japanese text stay in Archivo, so figures look the same in all three languages.
- **Martian Mono** (width 87.5) is the serial face: ticket numbers, countdowns, addresses, small amounts in lists. Never a label, never above 19 px. Key figures (balances, the pool, interest) are Archivo, not mono.
- Scale: 11, 12, 13, 15, 16, 18, 22, 28, 36, 56 px. Labels are sentence case, untracked, one step smaller than body.

## The five rules that make this concept itself

1. **Paper has two pieces.** Anything of value is a ticket: a body and a stub joined by a dashed perforation with a bite out of each edge. The stub always holds the action or the answer (the two choices, Deposit and Withdraw, Convert, the claim button, the invite code).
2. **Every mark is information.** The serial is the day and the question number (`1127-3`), the hole row is where you are in the five, the ten hole card is points toward the next CT, the meter on a certificate is days served. There is no barcode, no fake wear, no texture.
3. **Yellow means points, and nothing else.** The header pill, +50P, a hit, a punched hole, the tape that marks an undone pick. If it is highlighted, it is something you earned or can earn.
4. **Two inks answer, black prints.** Vermilion is left, Cojam blue is right, on both the stub and the tray. Blue is also the one primary action per screen. Selection inside forms is ink black, so an option never looks like an answer.
5. **Motion is mechanical.** Things tear, drop, feed in steps and get stamped: short, with one overshoot at the snap, never floaty. A countdown drains, a strip prints segment by segment, a stamp lands once.

## What I avoided

- Vintage pastiche: no aged paper, grain, typewriter face, rubber stamp texture or "ADMIT ONE" capitals. The tickets are modern transit stock, flat and clean.
- The newspaper concept that already exists: no masthead, columns, rules as decoration or halftone.
- Gradients, glass, glow, emoji and decorative dots; the only gradients are hard stop masks that cut the perforation bites and the half punched hole.
- Barcodes and QR patterns that encode nothing.
- Colour as the only difference between answers, and blue or red on anything that is not an answer, an action or an error.
- Mono as a label face, tracked capitals and eyebrows.
- Inventing data or copy: `assets/i18n.js` and `assets/mock.js` are unchanged copies; seven labels were added in `assets/ticket-i18n.js` in all three languages.
