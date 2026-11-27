import io
p = 'REVIEW.md'
s = io.open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:60]
    s = s.replace(a, b)

rep("Two full rounds, plus a first build pass.", "Two full rounds, plus a first build pass, then a focused motion round (last section; the motion spec is `MOTION.md`).")
rep("| Text contrast under 4.5:1 | 0, with one known exception: on a player's very first visit the teaching nudge shows the answer stamp at 40% opacity for 1.5 seconds (`span.qstamp`, `aria-hidden`). It is the \"honest preview\" of the drag, carried over from the current design, and never appears again. With the nudge already seen (`home.html?state=partial`) the screen reports 0 |",
    "| Text contrast under 4.5:1 | 0 on every screen, including the first visit nudge on home (fixed in the motion round: the hint is now a full strength proof stamp, ink on the sheet, that steps in and out) |")
rep("| Motion | 7 | The throw and Undo of the deck, the stamp landing a size up at the commit threshold, the \"+100P\" thunk and the boxes inking in, press feedback, the sheet. Transform and opacity only, reduced motion handled. No page entrance and no stamp animation on results: restrained, but less delight than the current design's reward burst |",
    "| Motion | 9 (was 7) | After the motion round: the sheet lifts, turns about the hand and is thrown; the answer stamp is a proof, presses in with a recoil and an ink ring, and comes down on the pick; Undo pulls the sheet back; the fuse is a printer's rule; day done is an extra edition; stamps land in results; the ranking sets like type; sections turn like pages. Transform, opacity and clip-path only, everything interruptible, reduced motion handled. Not a 10 because nothing has been felt on a real phone yet |")
rep("| **Total** | **83 / 100** | |", "| **Total** | **85 / 100** (83 before the motion round) | |")
rep("4. **Reward moment.** The thunk and the inking boxes are quiet. A stamp sound, a haptic pattern and a one time \"extra edition\" flash of the masthead rule would add delight without leaving the concept.",
    "4. **Reward moment.** Rebuilt in the motion round as the extra edition (see below). Still missing: sound. A short press and stamp sound, off by default, would complete it.")

s += '''
## Motion round

Asked for by the founder after choosing this concept: stronger effects and motion, inside the newspaper language. Spec: `MOTION.md` (purpose, trigger, duration, curve and the reduced motion answer for every moment). Skills used: `animate` (the gate, the property and curve rules) and `motion-design` (choreography: one lead action, causes before effects, action and rest).

### What changed

- **Swipe and pick.** The sheet scales to 1.012 and casts a flat ink shadow while held; it turns up to 7 degrees about the hand (held low, it leans the other way); the throw keeps the release speed. The answer stamp is now three states: a dashed proof under the threshold, pressed in at the threshold (fill, 1.36 to 1.05 to 1.12 recoil, a ring of ink, haptic tick), and brought down on the pick. A tap or an arrow key holds the sheet 130 ms so the stamp is seen landing before the throw. The next sheet rises in 420 ms; a release under the threshold flicks back with an overshoot; the numbered boxes ink in from the bottom, 70 ms apart.
- **Undo.** The sheet is pulled back in low from the side it left and settles with the same overshoot. The 3 seconds are a 3 px printer's rule along the bottom of the pick bar, used up from the right (also inside the list view's Undo buttons and under "Finishing in 3"). The ring is gone.
- **Day done.** An extra edition in about 2.2 seconds: the press runs while the last pick is saved, the headline is set letter by letter, the band inks in as "Extra" (호외, 号外) with the issue, "+100P" prints with three rolling reels, a "Paid" stamp lands, the fifth box inks in, the dateline turns from "Closes in" to "Next set in", the points in the masthead count up. A tap or a key skips to the settled page, which is the same layout with nothing moving. It plays once.
- **Results.** Stamps land in list order with a ring of ink, each at its own fixed angle; waiting rows carry a small "going to press" mark instead of the clock; the day totals count up; a row opens like a clipping under a dashed cut line.
- **Ranking.** Rows set from the top 34 ms apart, the prizes of the first three roll, the own bar slides up like a ticker strip, and This week and Last week turn like a page (120 ms out, 200 ms in), with the control switching at once.
- **Staking, wallet, convert.** The result figure rolls and retargets while typing; sheets rise on the drawer curve; a "Done" stamp lands on success; countdowns tick like a date stamp (only the changed digit moves). Nothing plays on errors.
- **Chrome.** A page turn of the content between sections (180 ms, direction by tab order, chrome still), the current tab's bar growing in, pressed states on every control (rows and chips darken, framed controls go down 1 px, links thicken), the browser's tap highlight switched off, the toast as a slip of paper pushed up from under the tab bar.
- **First visit nudge.** No more text at 40% opacity: each lean shows a full strength proof stamp and lights the answer button on that side.
- **Wording added** (`assets/paper-i18n.js`, three languages): "Extra", "Paid", "Going to press" (screen reader label of the mark).
- **Hub.** The language switch in the hub masthead clipped and stacked at phone widths. It now uses short labels (EN, 한, 日) in fixed 48 px cells and never shrinks; segment labels never wrap anywhere. `node tools/lang-switch-check.js` checks the language control on the hub, login, first run and profile at 360, 390 and 440 px in three languages: 36 checks, 0 failures.

### Verification of the motion round

- **Scripted runs** (`node tools/flow-test.js`, `node tools/motion-run.js all`): touch swipe, Undo, a release under the threshold, tap, arrow key, five picks, "Finish now", the extra edition, results with rows opened, ranking with two page turns, staking from typing to success, tab changes. **No page errors.**
- **Frame intervals during a drag** (a 2 second scripted drag across both thresholds, driven from `requestAnimationFrame`, device scale 2): 121 frames, average 16.67 ms, p95 16.7 to 16.8 ms, maximum 16.8 ms, 0 frames over 20 ms, at CPU throttle 1x and at 4x. One earlier run at 4x showed 4 frames at 33 ms. This measures the main thread only.
- **Paint and raster cost of the same drag** (`node tools/motion-trace.js`, Chromium trace): with the layer promotion, raster tasks took 37.7 ms in total over the 2 seconds (186 tasks); without it 90.8 ms (327 tasks). A second pair of runs gave 40.1 and 112 ms. Layout 4.5 ms in 18 events, style 41 ms, paint 25 ms. So the halftone is no longer re-rastered when a stamp arms or the wash changes: raster work during a drag fell by about 60%.
- **Honest limits of these numbers:** headless Chromium on a server rasters in software and has no real display, so absolute times do not predict a phone, and compositor frame drops are not visible to `requestAnimationFrame`. The comparison between the two variants is the meaningful part. Nothing was measured on a device.
- **Audit:** rerun on every screen after the round; the result is in the table at the top of this file.
- **Recordings:** `captures/video/` holds five flows as mp4 and webm (390 x 844, KO, and the done moment also in EN) and 18 still frames taken mid animation.

### What I would tune on a real phone

1. The throw: release speed to duration mapping (190 to 380 ms) and the 18 degree exit angle, with real thumbs at both screen edges.
2. The 130 ms hold before the throw on a tap: it must feel like a stamp, not like lag. If it reads as lag, drop it to 90 ms.
3. The overshoot of the flick back and of Undo (ease out back at 440 ms): on a high refresh screen it may want less.
4. The lift shadow: 16% ink, 5 and 9 px. On an OLED phone in sunlight it may need to be stronger or closer.
5. Haptics: the 5 ms tick at the threshold and the 12 ms hit on the pick are guesses; iOS Safari ignores `navigator.vibrate`, so the installed app needs its own haptic path.
6. The extra edition's length. 2.2 seconds is right once; if players finish daily, a shorter cut after the first week (band, figure, stamp, about 1.2 seconds) would respect them.
7. Halftone on low end Android: if the first raster of a new front card shows up as a hitch when the stack advances, ship server rendered 1 bit pictures.
8. The page turn between tabs is a cross document entrance only. With the View Transitions API (or a single page shell) the old page could leave as well.
'''
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
