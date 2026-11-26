# Round 5 brief (shared by four parallel agents)

Read this, `CLAUDE.md` (house rules) and the last rows of `docs/platform/DECISIONS.md`. Do not commit or push. English is the default language; `?lang=ko|ja`.

## Why
The last round flattened the ordinary screens (sections and hairlines instead of stacked bordered cards). An independent review scored design 82.0 (home 86, login 84, done 82, ranking 81, staking 81, profile 80, wallet 78, results 78; target 85); usability is above target everywhere. Verdict: hierarchy and affordance are fine, the clutter is gone, but the quiet screens lost the brand's character. A stock iOS segmented control (white thumb, soft shadow, grey track), grey filled buttons and hairlines replaced the cards; cover the header and wallet, results and profile could be any app. The landing (`site/index.html`) is built from ink outlines, numbered blocks, lime and sky chips.

## Direction
Keep the flat structure: no stacked bordered cards, no card in card. Bring the brand's line language back with discipline so each screen is recognisably Cojam below the header. Do not undo what works: the deck, login, header band, podium, pinned rank bar, the flows.

Rules for everyone:
- Lime `#D6FF3D` only for the primary action, the current selection, day progress and the day done reward moment. Answers are coral (left) and sky (right). Never lime for a hit, a figure or decoration.
- Exactly three button looks: primary (lime, ink edge, offset shadow), secondary (2 px ink outline, white ground, medium radius, no shadow), text link. No grey filled buttons.
- One segmented pattern: 2 px ink outline track, current segment filled ink with white text. Where a control navigates to another page it reads as tabs or links, not as a filter.
- Major sections are separated by a 2 px ink line; light hairlines only between rows inside a list.
- Key figures use the display numerals. Ink outlined number blocks or chips in the landing's style only for real counts, ranks, steps or states. No decoration without a job, no gradients, glow, glass or emoji.
- Copy: plain, native in KO and JA (not literal), no " - " or " — " as a sentence break.

## Working in parallel (important)
Four agents edit this folder at the same time. Each owns the files listed in its own prompt.
- **System agent** owns `assets/tokens.css`, `assets/components.css`, and `assets/components.js` except the `App.deck` code. It restyles the shared classes **in place, keeping every existing class name**, so the other agents never need to touch them.
- **Screen agents** put screen specific CSS in a new file `assets/screens/<group>.css` and link it from their HTML files after `components.css`. They do not edit `tokens.css` or `components.css`. If a shared component needs a change, they write the request at the end of their report rather than editing it.
- `assets/i18n.js` and `assets/mock.js` are shared: read the file again immediately before every edit, change only the lines for your own keys, keep each edit small, and if an edit fails because the file changed, read again and retry.
- Use your own preview port (given in your prompt). Do not run `tests/e2e-touch.js` (the lead runs it once at the end; it fails under parallel load). Check your own screens with captures and `node tools/design/audit.js <url> <w> <h> --mobile` at 390x844 and 360x780 in EN and KO (JA at 390 when you changed copy), with animations settled. Capture only your own screens, named `v6-<screen>-<lang>-<width>.png`, under `captures/`.
- Keep the round short: fix what is listed, look at your captures at full size, stop. Report what changed, what you did not fix and why, and any request for the system agent.
