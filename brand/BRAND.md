# Cojam brand notes

## Logo review (2026-11-12)

The mark is a blue disc (`#124CC4`) holding a white ring shaped like a C, with a horizontal slot through the ring and a notch through the disc edge on the right.

Findings from rendering `cojam-mark.svg` at 16 to 400 px on white, near black and the brand blues:

1. **Vertical offsets.** The disc is centred at y 1024, the white ring at 1030.4, the slot at 1036.9 and the edge notch at 1054.3 (on a 2048 grid). The notch extends 18 units above the slot but 53 below it, so it reads as sagging at large sizes. `cojam-mark-centered.svg` puts all four on y 1024 with an even margin around the slot. Horizontal offset of the ring (7.6 units right of the disc centre) was kept, as it may be optical.
2. **Small sizes.** At 16 px the notch becomes a one pixel jag. A favicon or small UI version should drop the edge notch and keep the ring and slot.
3. **Backgrounds.** The disc disappears on `#3E58E3` (1.3:1) and on `#124CC4` itself; on those grounds use the white ring alone. On a near black ground the disc is 2.6:1, readable at large sizes but weak under 24 px.
4. **Missing files.** No wordmark, no single colour (white or black) version, no horizontal lockup. These are needed for the header, exchange listings and social avatars.

## Colours

| Token | Hex | White text | On dark `#0A0F1E` | Use |
| --- | --- | --- | --- | --- |
| brand | `#124CC4` | 7.35:1 | 2.60:1 | primary action, current selection, the mark |
| brand-2 | `#3E58E3` | 5.66:1 | 3.37:1 | candidate secondary; never adjacent to brand |
| sky | `#97DBFF` | 1.51:1 | 12.63:1 | candidate highlight on dark grounds; dark ink on it |

## Type

Recommended: Pretendard Variable (Latin and Korean) plus Pretendard JP Variable (Japanese), one design across all three languages, tabular numerals for every figure, weights 400 / 500 / 600. Open Font License, self host for production.
