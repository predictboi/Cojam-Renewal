# Review: Pocket Arcade

Two full critique and fix rounds were run on the captures at full size (390 x 844 in EN and KO, 360 x 780 for home, done and ranking, JA for home, done, ranking and results), plus the scripted checks below. This file records the last round.

## Scripted checks (last run)

| Check | Tool | Result |
| --- | --- | --- |
| Design audit, 31 screens and states, EN at 390 x 844 | `sh tools/audit-all.sh en` (runs `tools/design/audit.js`, `AUDIT_ACCENT=#124CC4`) | 0 overflow, 0 contrast failures, 0 targets under 44 px |
| Same, KO at 390 x 844 | `sh tools/audit-all.sh ko` | 0 overflow, 0 contrast failures, 0 targets under 44 px |
| Same, JA at 360 x 780 | `sh tools/audit-all.sh ja 360 780` | 0 overflow, 0 contrast failures, 0 targets under 44 px |
| Touch flow: swipe right, Undo, swipe left, tap, arrow key, two swipes, "Finish now", reward, points 1,250P to 1,350P | `node tools/flow-test.js` | Pass, no page errors |
| Language control never wraps or clips (hub, login, first run, profile; 360, 390 and 440 px; EN, KO, JA) | `node tools/lang-switch-check.js` | 36 checked, 0 failed |
| Drag frame times, 2 second scripted drag, CPU throttle 1x and 4x | `node tools/motion-run.js perf` | 16.7 ms average, 0 frames over 20 ms at both rates |
| Missing copy keys on every captured screen | `node tools/capture-all.js` | None |

The audit's "mono" list still names the wallet address groups, the invite code and the invite link. Those are the three places the concept sets data in the monospace face on purpose (an address or a code must be compared character by character), so they are left as they are.

The Web Interface Guidelines were checked by hand against the points that apply to this prototype (visible focus on every control, no `transition: all`, transform and opacity only, reduced motion, 44 px targets, `aria-live` for async status, labels on icon only controls, `text-wrap: balance` on headings, tabular numerals in tables, no layout shift from ticking figures). The skill itself was not loaded in this run.

## Round 1: what was wrong and what was changed

| Finding | Fix |
| --- | --- |
| The face of every thick key was a pseudo element, so the key itself had no background: the audit (and any tool that reads the DOM) measured white text on a cream page | Every key now carries its face colour as its own background; the pseudo elements only draw the side and the rim |
| Cards behind the front card were dimmed to 55%, which made their text fail contrast while still readable | The cards behind are full strength: they are covered by the front card anyway and are simply there when it leaves |
| The hidden answer stickers and the hidden fourth and fifth cards were still in the rendering at opacity 0 | They are taken out with `visibility` and only come in when they have something to show |
| The view switch (38 px), the language select (40 px) and the hub "Open" links (36 px) were under the 44 px target | All are 44 px |
| The list view rows were unstyled grid leftovers | Redrawn as five small cards; the open one stands on a side and carries the two answer keys; a picked row gets its numbered sticker |
| The capsule lid landed across Jam's face, and the "Paid" sticker ran off the right edge | The lid comes to rest above the cup, Jam stands clear under it, coin and sticker sit inside the stage at 360 px |
| During a drag the answer sticker sat in the middle and left the screen with the card | The sticker sits on the trailing side of the card (right answer on the left edge, left answer on the right edge), so it stays in view through the whole drag |
| On the home error state the notice stretched to the full height of the deck | States without a deck keep their own height |
| Ranking sections ran into each other; the own rank bar touched the raised tab key | One 16 px rhythm between sections; the bar sits 12 px above the dock |

## Round 2: what was wrong and what was changed

| Finding | Fix |
| --- | --- |
| Korean and Japanese labels under 18 px (segments, list and card switch, staking tabs, small buttons, result stickers) were muddy in the fat display face | Under 18 px those labels use Pretendard at 800; the display face is kept for 18 px and up, where it has room |
| First place on the podium differed only by height and colour | A small crown sits on the first place avatar; first place also has the largest avatar, block, rank and prize |
| The first run nudge made the hidden sticker visible to assistive tools for its whole run | The nudge now steps `visibility` together with `opacity`, so the sticker exists only while it shows |
| Result stickers in Korean sat low in their rim | One pixel less top padding for KO and JA |
| The podium blocks rose together and read as one mass | Third, second, first rise 0, 90 and 220 ms apart; avatars drop on after each block has landed; the three prizes roll up in the same order |

## Scores after round 2 (each out of 10)

| Criterion | Score | Note |
| --- | --- | --- |
| Hierarchy | 8 | One loud thing per screen (the card, the capsule, the podium, the balance). Home still stacks three small rows above the card (live chip, title, count) |
| Typography | 8 | Lilita One gives the toy voice and its figures are strong. Bagel Fat One is heavier than Lilita One at the same size, so Korean headlines are a little darker than English ones |
| Colour discipline | 9 | Four colours, four meanings, kept on every screen; coral and mint appear nowhere but on answers |
| Spacing rhythm | 8 | 16 px between groups, 12 px inside, 8 and 10 px between keys. The Day done page has a loose gap between the stage and the headline at 390 px |
| Component consistency | 8 | One key, one card, one sticker, one divider. The pinned action bar on staking and convert is a card with a rim while the own rank bar is ink: two looks for one position |
| Brand character | 9 | The sticker on the card, the sticker sheet, the capsule and Jam are this concept's own and are not interchangeable with another app |
| Affordance | 9 | Thick means pressable and flat means not, with no exceptions found; answers carry arrows and words |
| Motion | 8 | The slap, the throw, the capsule and the podium are specific and all are skippable or interruptible. The week switch on ranking replays the whole podium, which is one show too many on the second tap |
| Density | 7 | Money screens are calm and complete. Results is long: each day is a tall card, and three days need a lot of scrolling |
| Polish | 8 | Rims, radii and depths are consistent. Not yet hand tuned: optical centring of Hangul on keys, the lid highlight, the crown |

Average: 8.2.

## What I would still improve

1. Put the count and the sticker sheet on the same row as the title on home, so the card starts 40 px higher.
2. Draw Jam in two more poses (pointing at the card for the first run, holding a coin for convert success outside the money rule if the founder allows it) and give the capsule a short idle before the drop on slow connections.
3. A second Korean display face with a real 18 px cut, or a lighter Hangul weight, to balance Bagel Fat One against Lilita One.
4. Make the two pinned bars one component.
5. On the week switch, let only the blocks change height instead of replaying the full podium entrance.
6. Compact rows for older days on Results.
7. Test the drag on real mid range Android hardware: the numbers above are from desktop Chromium with CPU throttling.
