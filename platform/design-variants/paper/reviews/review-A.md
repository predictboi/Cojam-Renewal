# Review A: Concept A, Daily Paper

Independent review, read only. Reviewer did not build this design.

## Verdict

**Ship as the product direction: yes, after fixes.**

Overall **77 / 100** on the design scale (target 85) and **33 / 40** on the usability scale (target 34). The concept is real and the core loop (home cards, swipe, stamp, Undo, the extra edition, the ranking table) is already at production grade. It misses the target because the money screens were recently compressed into cryptic framed chips, the concept's own "a frame means you can press it" rule is broken in many places, three screens (convert, first run, login) are half empty, the list view is a clear step below the card view, and there are visible typographic defects (a hairline zero in sheets, addresses in two faces, a stamp that collides with the reward figure in Korean).

## How it was checked

- Served on port 8861, captured with Playwright (Chromium, touch, device scale 2) at 390 x 844 and 360 x 780 in EN, KO and JA. Two full passes, because the folder changed while the review ran: pass 1 at about 18:55, pass 2 at about 19:20. **Scores describe pass 2.** About 400 captures in `/tmp/claude-0/-home-user-Cojam-Renewal/b3270fa9-0a00-5483-ac13-fc0e6a3d97c3/scratchpad/review-A/` (`shots/` pass 1, `shots2/` pass 2, `flow/` interaction frames, `sheets/` contact sheets).
- Interactions driven with real touch events (CDP `Input.dispatchTouchEvent`): first visit nudge, short drag and flick back, drag held past the threshold, throw, Undo, a vertical drag (correctly ignored), fuse running out, tap pick, three fast swipes, the fifth pick, the wait, the reward, reload of the done page, home after done; results row open and the two filters; ranking week switch and scroll to "Around you"; staking amount, period, over balance, review, signing, steps, success; convert errors and success; wallet to deposit (copy) and withdraw (bad address, over balance, review, required check, signing, sending, success); profile language switch and log out; login bad email, code, setup; first run pages and invite code error; list view pick.
- Frame by frame (a screenshot every 100 ms): the nudge (2.6 s), flick back, throw, Undo, tap pick, the fifth pick and the whole reward (3.2 s), results stamps, ranking setting and page turn, sheets.
- `node tools/design/audit.js <url> 390 844 --mobile` on 16 screens in EN and on 14 in JA: horizontal overflow 0, contrast under 4.5:1 0, targets under 44 px tall 0 on every screen. Accent and mono flags are all intended uses. A separate scan for controls narrower than 44 px found "List" (23 px wide), "Skip" (28 px), "Cards" (39 px) and "Terms" (38 px).
- No page errors in any flow. One transient `C.q is not a function` on wallet during pass 1 was a mid edit state and did not recur.
- Compared with `platform/design/` only for missing information.

Changes seen between the passes (so the designer knows which state was scored): deposit and withdraw became pages; the question meta line got a "Rules" link; sentences on staking, stakes, wallet and convert became framed chips with "?" buttons; results rows lost "You:" and the "Waiting, 09:00 / +50P if hit" text; list thumbnails became black line art; the Japanese display face became Shippori Antique B1; login lost its three facts.

## Scores

### A. Design criteria per screen (10 each, 100)

Hi hierarchy, Ty typography, Co colour discipline, Sp spacing rhythm, Cc component consistency, Br brand character, Af affordance, Mo motion, De density, Po polish.

| Screen | Hi | Ty | Co | Sp | Cc | Br | Af | Mo | De | Po | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Login | 8 | 8 | 9 | 7 | 8 | 8 | 8 | 7 | 6 | 8 | 77 |
| First run | 8 | 8 | 8 | 6 | 7 | 7 | 8 | 6 | 6 | 7 | 71 |
| Home, cards | 9 | 8 | 9 | 8 | 8 | 9 | 8 | 9 | 8 | 8 | **84** |
| Home, list | 7 | 8 | 8 | 7 | 7 | 7 | 7 | 7 | 7 | 6 | 71 |
| Day done | 9 | 8 | 9 | 8 | 8 | 9 | 8 | 8 | 8 | 7 | 82 |
| Results | 8 | 8 | 8 | 8 | 8 | 9 | 7 | 8 | 8 | 7 | 79 |
| Ranking | 9 | 8 | 9 | 8 | 8 | 9 | 8 | 8 | 9 | 8 | **84** |
| Staking, new stake | 8 | 8 | 9 | 8 | 7 | 8 | 7 | 8 | 8 | 8 | 79 |
| My stakes | 8 | 8 | 9 | 7 | 7 | 8 | 6 | 7 | 7 | 7 | 74 |
| Wallet (with deposit, withdraw) | 8 | 8 | 9 | 7 | 7 | 8 | 7 | 7 | 8 | 7 | 76 |
| Convert | 7 | 8 | 9 | 5 | 7 | 7 | 7 | 7 | 5 | 7 | 69 |
| Profile | 8 | 8 | 9 | 8 | 8 | 7 | 8 | 6 | 8 | 8 | 78 |
| Invite | 8 | 8 | 9 | 7 | 8 | 8 | 8 | 7 | 8 | 7 | 78 |
| Account on hold | 8 | 8 | 9 | 8 | 8 | 7 | 8 | 6 | 8 | 8 | 78 |
| **Whole** | 8 | 8 | 9 | 7 | 7 | 9 | 7 | 8 | 7 | 7 | **77** |

### B. Nielsen heuristics per screen (4 each, 40)

| Screen | Total | Main losses |
| --- | --- | --- |
| Login | 34 | Value of the app no longer stated; typo `gmial.com` got no suggestion while typing |
| First run | 32 | Explains the swipe instead of letting the user do it; "Setting up your game" still spinning on page 3 |
| Home, cards | 36 | Three progress displays; non pressable boxes look pressable |
| Home, list | 33 | Thumbnails carry no information; "Pick" floats; saved state slow to confirm |
| Day done | 35 | Reward figure shows wrong amounts while rolling; layout jumps when paid |
| Results | 32 | Waiting rows are a bare icon and a time; legend does not match the row mark |
| Ranking | 35 | Own bar duplicates the own row; address faces differ |
| Staking, new stake | 34 | Rate not labelled as annual on the options; lock warning is a small chip |
| My stakes | 31 | "90d", "13%", "22 / 90", "≥ 10 CT" need decoding; static tags look like buttons |
| Wallet | 33 | "= 1 CT" and "+50P 22:10" chips are cryptic; withdraw success omits the address |
| Convert | 34 | Clear, but the disabled action is a pale blue slab with the reason only in the label |
| Profile | 34 | Language switch reloads and throws the user back to the top |
| Invite | 34 | "4" chip on the profile row has no label; the 10% is said three times |
| Account on hold | 35 | Good; no way back shown in the first screen height |

Whole product by heuristic:

| Heuristic | Score | Note |
| --- | --- | --- |
| 1. Visibility of system status | 3 | Fuse, boxes, saving states, sheets with steps are excellent. Lost: home after the day is done still says "Closes in"; results waiting rows; "Updated 9s ago" is filler |
| 2. Match with the real world | 3 | "≥ 10 CT", "= 1 CT", "90d", the press icon, "Extra" need learning |
| 3. User control and freedom | 4 | Undo, Finish now, Cancel in every sheet, Hide during sending, Skip |
| 4. Consistency and standards | 3 | Frame means pressable, except where it does not; two faces for addresses; list thumbnails differ from card pictures |
| 5. Error prevention | 4 | Withdraw review with a required check, full address repeated in groups, own address and contract address refused |
| 6. Recognition rather than recall | 3 | Help moved behind "?" buttons; chips drop their labels |
| 7. Flexibility and efficiency | 3 | Keys, tap, swipe, list view, Max, one tap fixes. Lost: forced 3 s before the reward on every day |
| 8. Aesthetic and minimalist design | 3 | Strong, but convert, first run and login are empty and home repeats progress three times |
| 9. Help users recover from errors | 4 | "That is more than your 1,840.5 CT" with "Use 1,840.5 CT" is the model |
| 10. Help and documentation | 3 | Present, but hidden behind small "?" boxes |
| **Total** | **33** | |

## The ten most important fixes

1. **Money screens: put the sentences back, drop the chip shorthand.** Pass 1 had this right and pass 2 regressed.
   - `stakes.html`, every stake: "90d" and "13%" chips, "22 / 90", and a lone "≥ 10 CT" chip (EN, KO, JA, both widths). Restore "90 days at 13% a year", "Day 22 of 90", "You can claim from 10 CT. 2.52 CT to go."
   - `wallet.html`, Points block: the ink filled "= 1 CT" chip and "+50P 22:10". Restore "1,000P = 1 CT. You can convert 1 CT now." and "+50P lands about 22:10".
   - `staking.html`: "No early exit" is the single most important condition on the screen and it is a 13 px chip with the same weight as "No fee". Give it its own line with the lock icon and the date, as in pass 1 and as the review sheet still does. Label the four options as annual ("12% a year", KO "연 12%", JA "年率12%"): the word "annual" only appears in the review sheet. KO and JA label "이자" / "利息" lost the period; restore "90일간 이자".
   - `withdraw.html` success sheet: "Sent 250 CT" shows neither the destination address nor the remaining balance. Add both rows (the convert success sheet already shows balances).

2. **Make the frame rule true.** CONCEPT rule 1 says only things you can pick up or press are framed. Not pressable but framed with the same 1 px ink edge and sheet fill as buttons: the five day boxes (home, list, done), "Locked" and "Unlocked" tags and the "90d" chips (stakes), the date / "No early exit" / "No fee" chips (staking), "1,000P = 1 CT" chips (convert), "= 1 CT" and "+50P" (wallet), "Fee: you pay" (withdraw), the "2" and "4" count chips (staking tab, wallet Staked row, profile invite row), "Joined" (invite), the numbered step boxes (login setup, staking steps). Next to them sit real controls of the same look ("Pick", "Undo", "?", the address copy chip). Give static labels a different skin: no frame, a paper-2 fill or a leading rule, text in the text face. Keep the frame for controls only. The new "?" buttons then stop looking like one more tag.

3. **Fix the two numeral and address defects.**
   - Hairline zero: in `ranking.html?state=how` the prize column reads "385.2**0**", "256.8**0**", "1**0**" with a thin, different zero (seen JA 390, cause is language independent: the Besley cells in `#sheet` compute `font-variant-numeric: tabular-nums`, which REVIEW.md round 1 says was removed everywhere). Remove it there and grep for any other Besley element that inherits it.
   - Ranking names: ranks 1 to 3 set "0x4f2a…91bc" in Besley; ranks 4 to 10 and "Around you" set "0×9c1e…77d0" in Pretendard, where the contextual alternate turns "0x" into "0×" (a multiplication sign). CONCEPT says addresses use the data face. Set every short address in the mono face, or at least switch off `calt` on them, at one size per row tier.

4. **Day done: four flaws in the best moment of the product.**
   - KO 360 and KO 390: the "지급 완료" stamp overlaps the "P" of "+100P" and runs about 5 px past the right gutter; JA and EN at 390 touch the gutter too. Place the stamp below the figure's cap line on narrow widths or cap its width, and keep it inside the 16 px gutter after rotation.
   - The reels pass through "+629P", "+341P", "+075P", "+198P" for a fixed reward of 100 (frames at 1100 to 1500 ms). A reward screen must never display a wrong amount, even for 400 ms. Count up from +0 to +100, or roll only the last two digits, and do not clip the digits at the top of the line box.
   - When the points are paid (about 1000 ms) the "Saving your last pick" line is removed and everything below jumps up 22 px. MOTION says the layout is exactly the settled page from the start: reserve the height.
   - `home.html` after the day is done: the dateline still reads "Closes in 04:47:27" over "That is all five", while `done.html` reads "Next set in". Use "Next set in" on both.

5. **List view needs to come up to the card view.** `home-list.html`, all languages: the thumbnails are now solid black squares with white line art (pass 1: illegible halftone mush). They are the heaviest objects on the screen, they look like a different product from the halftone card pictures, and the XRP one is garbled. Use the same picture and screen as the card, cropped to the subject on paper-2, or remove thumbnails and let the big numeral lead. The "Pick" button floats between the category and the thumbnail with no alignment to anything: put it on the row's right edge under the thumbnail or make the whole row the target. Answered rows turn the headline grey, which reads as disabled rather than done: keep ink and show the answer block.

6. **Three half empty screens.**
   - `convert.html` (all languages): after the chips the page is blank from y = 345 to y = 710 of 844. Put the facts back as rows (rate, minimum, daily limit and what is left, fee), show the points that remain after converting, and let the "You get" figure sit on the sheet colour as the thing being produced.
   - `first-run.html`: an oxford rule with no nameplate above it, a 320 px panel holding a 130 px drawing, then 200 px of nothing on pages 2 and 3. Put the nameplate over the rule, size the panel to its content, and make page 1 a real card the user swipes once (see fix 10).
   - `login.html`: the page ends at 60% of the height; the three facts (5 questions a day, free to play, points turn into CT) were removed, so a new visitor is no longer told what this is. Restore them under the panel.

7. **Results: say what a waiting row is waiting for.** `results.html`, all languages: a waiting row is now a press icon and "21:00". The questions say "tomorrow", the row does not; the icon is unexplained; the legend shows a dashed square for "Waiting" while the rows use the bars icon and the day header uses dashed squares. Restore "Answer about 21:00 tomorrow" and "+50P if hit" in grey, use one mark for waiting in the legend, the day header and the row, and give the five mini squares beside "Today" an accessible label and at least 12 px. JA 390, opened row: the dashed cut line and the detail stop at the left column, leaving a hole under the right column; let the clipping span the row.

8. **Japanese and Korean typography.**
   - JA display, Shippori Antique B1 (better weight match than the earlier mincho, keep it): kana are set very loose. "ウォレット" (wallet title, 360 and 390), "ビットコインは" (home headline), "ステーキング" read as letterspaced words. Apply about `-0.04em` to `-0.06em` tracking with `font-feature-settings: "palt"` on JA display text, and check that the ornate "？" does not collide.
   - JA 390 home card: the meta line breaks as "…21時の価 / 格", one orphan kanji. JA 360: the settle line is cut with an ellipsis ("…結果を確定し…"), which hides when the answer is set. Allow two lines, never truncate a rule.
   - JA mixed numerals: "明日の21時" sets Besley 900 figures beside kana of a different colour and width; reduce the figure size by about 4% in JA headlines or set figures in the JA face there.
   - KO: Hahmlet is good at display sizes. The mixed line "5문제 완료" and "10만 달러" hold. Keep `word-break: keep-all`; no bad breaks found at 360.
   - EN 360 home: "Answer: Binance BTC/USDT price at 21:00 / KST" leaves "KST" alone on a line; apply `text-wrap: pretty` or balance to the meta line.

9. **Home: trim the repeated progress and the end wait.**
   - Progress is shown three times within 100 px: "0/5", the five numbered boxes, and "No. 1 of 5" on the card. Keep the boxes and the card number; drop the "0/5" figure or fold it into the boxes' label.
   - After the fifth pick the deck becomes an empty dashed frame with two fuses (one under the tick, one in the pick bar), "Finishing in 3" and a "Finish now" button, then a 500 ms pause before the page changes: 2.4 s measured from the last frame to navigation, 3.5 s from the swipe. Every day ends with a wait. Go straight to the done page and keep Undo alive there for its 3 seconds (the "press running" band is the natural place for it).
   - While a card is armed the answer wash tints the opposite button (teal over persimmon turns "No" brown, frame `en-drag-armed-held-1.png`). Exclude the buttons from the wash.

10. **Smaller interaction faults that cost trust.**
    - `ranking.html` scrolled to "Around you": the pinned "You" bar stays on screen directly under the highlighted own row, so the same line shows twice. Hide the pin while the own row is in view.
    - Ranking page turn: the frame at about 100 ms after the tap is a completely empty page below the control. Overlap the out and in phases so the page is never blank.
    - `profile.html` language switch: the page reloads and returns to the top, so the user loses the Preferences section they were in. Keep the scroll position, or switch in place.
    - First run teaches by text and a static drawing; the product's one gesture is never practised. Let page 1 be a sample card that must be swiped or tapped once. The first visit nudge on home is good (full strength stamp, both sides, stops on touch) but it only starts 700 ms after load and runs 1.5 s; a user who taps early never sees it.
    - Narrow targets: "List" 23 px wide, "Skip" 28 px, "Cards" 39 px, "Terms" 38 px. Pad them to 44 px wide.

## Smaller issues

Home and deck
- Picture at 360: the coin is cropped at the top by the shorter image area (EN, KO, JA). Anchor the crop to the subject.
- The weather picture prints as a nearly blank field of faint dots with a thin outline (KO 360 partial); the halftone has no mid tone there. Check every picture for a visible ground.
- The home tab icon (a filled blob with a square dot) is not recognisable as "home" or "today"; the other four icons are standard line icons.
- The points chip and the "M" avatar in the masthead are two framed boxes of nearly the same size; the avatar reads as a letter stamp, not a profile entry. A small "profile" cue or the name helps.
- "Day 5, week 48" appears in the dateline and again in the Extra band 60 px below it.
- The pick bar replaces the swipe hint with "Q1: Yes" and Undo; good. When several picks are held, only the last can be undone and nothing says so.

Day done
- "5 waiting for answers [?]": the explanation ("Answers are set within 48 hours. Each right pick pays +50P about 6 hours later.") was visible in pass 1 and is now behind the "?". It is the answer to the user's next question; show it.
- The line "+100P added to your points" was removed in pass 2; the figure and the stamp carry it, fine, but the masthead count up is then the only confirmation of the balance.

Results
- The summary's third cell: "+50P / Pending / 22:10" lost "about"; a bare time reads as a fact.
- The "Invite bonus" row lost its one line explanation in pass 2; in pass 1 JA 390 that line wrapped to an orphan "ん。". Keep the line, fix the wrap with `text-wrap: pretty`.
- Stamps: HIT and MISS and Corrected differ by word, frame and fill, so they work without colour. Keep.

Ranking
- Last week: the pinned bar sets "1,200P" and "Last week" with almost no leading; the two lines nearly touch (EN 390).
- "Updated 15s ago" beside "Top 10" and "Ends in 2d 4h" in the dateline are both good; the staking and wallet dateline cell "Updated 9s ago" says nothing useful. Use it for something true to the section (next unlock date, or leave the cell empty).
- At 360 the rank 2 address truncates to "0x4f2a…9…", an ellipsis inside an ellipsis.

Staking and stakes
- Empty amount: the interest figure becomes a 44 px wide dash; show "0 CT" in grey as CONCEPT rule 3 says.
- Disabled primary button is a pale blue slab (stake, convert, withdraw). It is the most generic looking element in the product. Use the paper-2 fill with an ink-3 edge so it reads as switched off, and keep the reason in the label as now.
- Success sheet: the primary button, a "Done" link and a "View on Kaiascan" link stack as three centred actions; in KO the stamp says "완료" and the link under the button says "완료" too.
- "Locked" (outlined, lock icon) and "Unlocked" (ink filled) have opposite visual weight to their meaning for action: the filled one looks like the pressable one. See fix 2.

Wallet, deposit, withdraw
- Wallet: the KAIA value "2.4 KAIA" ends 13 px left of the right gutter while "1,500 CT" above ends at the chevron; align the figures. An empty band between two hairlines sits under "Invite bonus this week" (EN 390, y about 750 to 775 CSS px).
- Wallet shows no fiat equivalent in EN or JA while KO staking shows won; decide per locale and apply it to the balance, which is where users want it.
- Deposit: "Waiting for deposits" with the press icon is a nice state; the warning line is 13 px grey with a small triangle, weak for the one irreversible mistake on the page. Set it in ink.
- Withdraw: the best money flow in the set (mono field, full address repeated in groups of four, "Valid Kaia address", required check, steps, "Hide"). The field still cuts the address at 34 of 42 characters; the grouped repeat solves it, keep both.

Convert
- "In steps of 1,000P" is under the field, the "?" sits beside "You get", and the chips repeat the rate; three places for one rule.
- Pass 1 JA 390 wrapped the row label "手数料" into "手数 / 料" and left "す。" alone on a line; if rows return (fix 6), give the label column a min width and the value `text-wrap: pretty`.

Profile, invite, hold
- Profile: the invite row's "4" chip has no noun ("4 friends").
- Invite: "10%" as an 88 px figure, then a headline that repeats 10%, then "+350P gives +35P". One of the first two is enough. Pass 1 showed two ink rules 20 px apart with nothing between them above "Your invite code"; check it is gone.
- Hold: the "On hold" tag is ink filled like a current selection; the support email is a second framed box under the support button, slightly cut by the fold at 390.
- Log out is a red text link at the very bottom next to nothing; fine, but red here is the only use of `--down` as a link colour.

Motion
- Throw, flick back, Undo pull back, box inking and the fuse are right in every frame captured; the stamp reads at once and the ring is restrained. No jank or half states found.
- Sheet rise and the signing, steps, success sequence are calm and correct. The success stamp lands after the figure, good.
- Results stamps land in order; ten in 700 ms is the limit, do not add more.
- Nothing moves on first run or login; one small move (the sample card leaning) would carry the brand there.

Accessibility and colour
- The two answers are distinguishable without colour: side, arrow direction, word, and the stamp's word. The small colour squares in lists add nothing without colour, but the word stands beside each, so the result holds. Persimmon and teal also separate under red green deficiency (they differ on the blue yellow axis).
- Small text: 12 to 13 px grey (`--ink-2`) on paper measures 7:1 and is legible in all three languages at device scale 2. The 11 px squares in results are the only marks that are too small.

## Done well, keep

- The card view as a whole: kicker, card number, halftone picture, slab headline, the two answer blocks with arrow and word, the stack edge under the card. It fits 390 x 844 and 360 x 780 without scrolling in all three languages.
- The swipe: lift, rotation about the grip point, the dashed proof stamp that becomes a filled stamp at the threshold, the throw with release speed, Undo pulling the same sheet back from the side it left. This is the best single piece of the product.
- The fuse as a printer's rule, and the five boxes with the hatched "being saved" state.
- The Extra band, the letter by letter headline, the masthead chip inverting while it counts to 1,350P, the stamp landing last.
- The ranking table: pool figure, three larger rows instead of a podium, the ink own bar, the blue tinted own row.
- Colour discipline: home at rest has no blue except the mark; blue is action, reward, own row. Do not add a fifth job.
- The masthead and dateline with one live fact, on home, results and ranking where the fact is real.
- Error handling with a one tap fix ("That is more than your 1,840.5 CT" plus "Use 1,840.5 CT"; "You have 1,250P" plus "Use 1,000P"), the email and address messages, the withdraw review with its required check.
- Transaction sheets: review, signing, numbered steps, sending with "Hide", success with the stamp, and nothing playing on failure.
- Hahmlet for Korean display and Shippori Antique B1 for Japanese display: both hold the slab's voice; only the Japanese tracking needs work.
- Audit hygiene: zero overflow, zero contrast failures and zero short targets across 16 screens.

## What would move the scores to target

Fixes 1, 2 and 6 alone lift my stakes, wallet, staking, convert, first run and login by 5 to 10 points each and take the whole to about 84. Fixes 3, 4 and 5 are needed for polish and consistency to reach 8. Usability reaches 35 once the money sentences and the results waiting text return and the home dateline is corrected.
