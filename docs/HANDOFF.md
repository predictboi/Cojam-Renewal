# Handoff: new brand site and token migration feature

This file starts a new session. It carries the working method, design system lessons, review loop and tooling that were proven on the Polyquest project (a Solana prediction market), adapted for a **different brand**: a new website plus a **token migration** feature (old token to new token). Nothing here is Polyquest branded except where marked as an example.

Read this whole file first. Then fill the Brand sheet (section 2) with the founder, or ask for the missing values in one short message, and start.

---

## 1. Working agreements (apply from the first reply)

- **Language:** talk to the founder in Korean. Every deliverable (UI copy, docs, specs, code comments) is in English unless the founder asks for Korean for a specific piece.
- **Korean style:** complete sentences with particles and endings, no noun phrase endings, no em dash. Prefer precise Sino Korean vocabulary over figurative words.
- **No dash punctuation anywhere**, English included: never write " - " or " — " as a sentence break. Use a colon, a comma, a conjunction or two sentences. (List bullets are fine.)
- **Speed:** the founder wants fast turnaround. Run independent work in parallel, at most 5 agents at once. Fix small things immediately instead of asking. Ask first only when a wrong guess is expensive or cannot be undone.
- **Structure first for big pieces:** for a large deliverable (a site, a video, a contract), show the structure in one message, get a yes, then build without stopping.
- **Show, do not narrate:** send drafts as soon as they are useful, keep progress notes short, end with what was made and one next step.

---

## 2. Brand sheet (fill before building)

| Field | Value |
| --- | --- |
| Brand name and exact casing | `TBD` |
| One line positioning | `TBD` |
| Primary colour and accent | `TBD` (pick one accent; it only marks the primary action and the current selection) |
| Ground (background) colour | `TBD` (dark graphite like `#0c0d10` worked well for a trading product) |
| Type | `TBD` (Pretendard Variable worked for Korean plus English; tabular numerals for figures) |
| Logo files and rules | `TBD` (for example: mark colour inside the tile, minimum size) |
| Domains | `TBD` (app domain, landing domain) |
| Chain | `TBD` (EVM chain id or Solana cluster) |
| Old token | `TBD` (address, decimals, standard, current holders estimate, where it trades or traded) |
| New token | `TBD` (address, decimals, standard, total supply, who holds the migration reserve) |
| Ratio | `TBD` (for example 1:1, or 100 old : 1 new) |
| Migration window | `TBD` (start, end, what happens after the end) |
| Who cannot migrate on chain | `TBD` (exchange balances, LP positions, vesting contracts, lost wallets) |
| Contact for support | `TBD` (one address for everything) |
| Legal lines that must appear | `TBD` |
| Words to avoid | `TBD` |

---

## 3. Scope

1. **Website:** landing (what the token is, why it migrates, how, timeline, FAQ, contract addresses), the migration app, a public migration dashboard (supply migrated, holders migrated, time left), docs/help.
2. **Migration feature:** connect wallet, detect old balance, show what you will get, approve if needed, migrate, confirm, add the new token to the wallet, history.
3. **Optional later:** a short vertical promo and a how to migrate video using the pipeline in section 9.

Start with a working HTML prototype of the site and the migration flow against mock state (no chain). It is cheap to review, captures cleanly, and becomes the developer handoff. Then wire the real contract.

---

## 4. Token migration: product and contract spec

### 4.1 Choose the model

| Model | How it works | Use when |
| --- | --- | --- |
| **Swap contract (recommended default)** | User approves the old token, calls `migrate(amount)`; the contract takes the old tokens (burns them or locks them at a dead address) and sends new tokens from a pre funded reserve at the fixed ratio. | Holders keep tokens in their own wallets; you want self service at any time inside the window. |
| **Snapshot plus claim** | Balances are fixed at a block; a Merkle root is published; holders claim new tokens with a proof. Old token is frozen or abandoned. | Old token is broken, paused, or exploited; or you need to exclude addresses. |
| **Exchange handled** | Exchanges swap balances held on their books. | Always in parallel for CEX held supply; announce exchange support separately. |

Most real migrations use the swap contract for wallets plus exchange support for CEX balances, with a published policy for everyone else.

### 4.2 Swap contract requirements

- Fixed ratio, set at deploy, immutable. Handle decimals explicitly: `newAmount = oldAmount * RATIO_NUM * 10^newDec / (RATIO_DEN * 10^oldDec)`; round down; reject amounts that round to zero; never lose dust silently (either migrate whole balance or show the remainder).
- Pull pattern: `transferFrom` the old token into the contract (or burn), then transfer new tokens out. Checks, effects, interactions order; reentrancy guard.
- Measure what actually arrived (balance before and after) so fee on transfer or rebasing old tokens cannot over credit.
- Window: `start`, `end`; after `end` only the documented late path works (or none).
- Admin powers limited to: pause and unpause, top up the reserve, recover tokens that are neither old nor new, and after the window plus a grace period, sweep the unused reserve to a published address. **No ability to move user funds or change the ratio.** Use a multisig and a timelock for admin.
- Events: `Migrated(user, oldAmount, newAmount)`, `Paused`, `Unpaused`, `ReserveToppedUp`, `Swept`.
- Optional: `permit` (EIP 2612) on EVM for one signature migrations when the old token supports it; batch migration for partners.
- Solana variant: an Anchor program with a reserve token account owned by a PDA; support both SPL Token and Token 2022 if the old token uses extensions (check transfer fees and transfer hooks).
- External audit before mainnet. State the audit status on the site; never call an unaudited contract audited.

### 4.3 Edge cases to design for (write the policy for each)

- Tokens on exchanges (exchange swaps them; list supporting exchanges and dates).
- Tokens in liquidity pools (user removes liquidity first; show an inline hint when LP tokens are detected).
- Vesting or locked contracts (separate admin path or contract upgrade; document).
- Multisig and smart contract wallets (must work with contract callers; test with a Safe).
- Blacklisted or exploited addresses (exclusion list, published reason).
- Lost keys and late migrators (policy after the window).
- Very small balances (minimum, or allow full balance migration only).
- Old token still trading (warn about buying old tokens late; show the deadline everywhere).

### 4.4 Migration flow states (every one must exist and be reachable)

1. Not connected: explainer, ratio, deadline, contract addresses with copy buttons, "Connect wallet".
2. Wrong network: one button to switch.
3. Connected, no old balance: friendly empty state, links to FAQ (exchange, LP, vesting cases).
4. Has balance: amount field (default full balance, Max button), live "You will receive" figure, ratio line, deadline, gas estimate.
5. Approval needed: step indicator "1 Approve, 2 Migrate", explain why approval exists in one line.
6. Waiting for wallet: spinner, "Confirm in your wallet", Cancel.
7. Pending on chain: tx link, elapsed time, safe to close the page note.
8. Success: new balance, tx link, "Add NEW to wallet", share, migrate another wallet.
9. Errors, each inline with the fix as a button: rejected in wallet ("Nothing was sent"), insufficient gas, paused contract, window closed, reserve empty, RPC failure (Retry), partial state (approved but not migrated: resume at step 2).
10. History: past migrations for this wallet from events.

Copy rules: say what happens in plain words ("Migrate 12,500 OLD to 125 NEW"), show units on every figure, human dates ("Ends Mar 3, in 21 days"), no jargon without a help popover (ratio, approval, gas, reserve).

### 4.5 Trust and safety on the page

- A permanent banner: the only official URL, "We will never ask for your seed phrase", "Migration never requires sending tokens to a person or address".
- Contract addresses shown in full with copy and explorer links, and the same addresses in docs and social posts.
- Self custody: the user signs every step; the site never holds funds.
- Public dashboard numbers come from chain data, not from a database the team edits.

### 4.6 Testing

- Contract: unit tests for ratio math with different decimals, rounding, dust, fee on transfer mock, pause, window edges, reentrancy, sweep after grace, admin cannot touch user funds. Fork tests against the real old token.
- Front end: mock every state in section 4.4 with `?state=` query values for captures and review; then testnet end to end with test tokens; then a small mainnet dry run with team wallets.
- Credentials: only test keys and test wallets in any automated run, kept in project seed or example config files, never real keys.

### 4.7 Launch checklist

Audit report linked; multisig and timelock live; reserve funded and verified on chain; exchange partners confirmed with dates; announcement with addresses on every official channel; dashboard live; support FAQ live; monitoring on `Migrated` events and reserve balance; pause runbook written and rehearsed.

---

## 5. Design playbook (what moved scores from 58 to 86 of 100)

The Polyquest redesign went from 58 (existing product) to 86 (final) on an independent 100 point design score, and to 35 or 36 of 40 on Nielsen usability. What made the difference:

1. **Start from scratch, keep only the colours.** Restyling the old layout capped scores around 79. A fresh build with the old palette scored higher on the first try.
2. **One accent with exactly two jobs:** the primary action and the current selection. Never use it as a data colour, a delta or a decoration. Separate green and red for change and profit or loss only; amber only for warnings and time pressure.
3. **One signature element** that appears everywhere and carries the product idea (Polyquest: the outcome "tape", a stacked split bar). For migration, a good candidate is a **conversion bar**: old amount flowing into new amount with the ratio, reused on the landing, the app, the dashboard and the success state.
4. **Type:** one family, tabular numerals for all figures, a tight scale (12, 13, 14, 16, 20, 24, 32), weights 400, 500, 600, sentence case, no monospace for UI text.
5. **Surfaces:** page ground, one raised level for panels, an inset level for inputs, hairline borders, radius 8 for controls and 12 for panels, never a card inside a card.
6. **One primary button per view.** Everything else is outline or ghost.
7. **Dimmed is still readable:** disabled or secondary text uses a muted colour that still passes 4.5:1. Never lower text opacity.
8. **Same thing looks the same:** one header, one button shape, one ticket or form component shared by every page. Build a shared shell file (CSS plus JS) injected last on every page; separate inline styles per page caused visible header drift.
9. **Dense and calm for repeat users, guided for newcomers:** a Table view and a Cards view of the same list with a toggle (remembered per user) served both heavy traders and first timers; cards win on mobile.
10. **Mobile first checks:** rows 64 to 72 px, touch targets 44 px or more, the first mobile screen shows real content, no horizontal scroll.
11. **Words:** say what happens, name the thing in the button ("Migrate 12,500 OLD"), payout or result sentence in plain words, no middle dot chains as separators.

### 5.1 Usability behaviours to build (Nielsen, as working features)

- Status: live "updated 3s ago" stamps, every async state visible, skeletons while loading, balance next to every amount field.
- Control: a way back from every step, Esc closes sheets, Cancel while waiting for the wallet, Undo toasts for reversible actions.
- Error prevention: amount parser that accepts "1,250.75", "$40", "40 OLD" and rejects negatives, exponents and junk with a reason (refuse the key and keep the field empty, do not keep a half value with the button enabled); Max button; review step for large amounts.
- Recovery: inline errors next to the cause with the fix as a button.
- Recognition: labels always visible, last used values offered as chips.
- Efficiency: keyboard shortcuts (`/` search, `Enter` submit, `Esc` back, `?` shortcut list).
- Help: one line "How this works" disclosure in the form, help popovers on every term, a dismissible first visit hint.
- Accessibility floor: 4.5:1 text, visible focus, everything reachable by keyboard, `aria-live="polite"` on status, `prefers-reduced-motion` respected.

---

## 5.2 Design skills to load

- **Already on the account (any session):** `frontend-design` (direction before building), `anthropics-skills:unslop` (remove generic AI looks), `artifact-design` (published pages), `dataviz` (dashboard charts), `design:design-critique`, `design:accessibility-review`, `design:ux-copy`, `design:design-system`, `design:design-handoff`, `video-making`.
- **From the `ui-ux-kit` plugin (install the attached `ui-ux-kit.plugin` once):** `impeccable` (design passes and polish), `hallmark` (new sites that look designed), `web-design-guidelines` (Vercel interface guidelines review), `redesign-existing-projects`, `animate` (interface motion), `motion-design` (video beats and pacing).
- **Order that worked:** frontend-design or hallmark to set the direction, build, impeccable or unslop to polish, web-design-guidelines and accessibility-review to check, then the independent reviewer in section 7. Load a skill with the Skill tool before using it, and only after the content is gathered.

## 6. Build rules for the prototype

- Plain HTML, CSS and JS, no framework, works from disk. One file per screen plus shared `base.css`, `system.js` (tokens, helpers, mock ledger state in localStorage with `?reset=1`), `assets.js` (icons and logos inline).
- Real controls only (`button`, `a`, `input`, `select`, `table`). Icons as inline SVG, one stroke style, no emoji.
- Every state reachable by use and by `?state=name` for captures.
- Shared mock state through one object (Polyquest used `PQ_LEDGER`) so an action on one page shows on every other page after reload.

---

## 7. Review loop (use it every round)

1. **Capture** each screen at desktop 1440x900 and mobile 390x844 with `design/shot.js` (Playwright, DPR 2, `--css`, `--jsfile`, `--js`, `--clip`, `--full`). Look at every capture yourself before anyone scores it.
2. **Audit** with `design/audit.js` (contrast under 4.5:1, small touch targets, overflow, accent misuse). It is a helper, not the judge.
3. **Independent score** by a separate agent that did not build the screen: 10 design criteria of 10 points each (Hierarchy, Layout, Spacing, Type, Colour, Consistency, Density, Copy, Mobile, Finish) plus Nielsen 40 points by actually using the page (script and keyboard at both sizes). The reviewer writes `.md` and `.json` with scores and the top fixes.
4. **Fix** the top items and rescore. At most four render and fix rounds per screen. Target: 85+ design, 34+ usability.
5. **Compare** versions on one published page with flip toggles and scores when the founder needs to choose.

---

## 8. Pitfalls already paid for

- Signed bit shifts in a hash produced negative sizes: use `>>>`.
- A grey segment with white text failed contrast (3:1): dark ink on light segments.
- Labels clipped inside small segments: fit by dropping the secondary value first, then the label.
- Repeated monograms looked like a bug: a unique map per item.
- Balances went negative because a currency was missing from mock data: every token used anywhere must exist in the mock balances.
- Settled results must never imply certainty they do not have (Polyquest rule: winners never shown as 100%). For migration: never show a migrated amount before the chain confirms it.
- Publishing to an existing artifact fails for files not read in that session: list its files first.

---

## 9. Video pipeline (when a promo or how to video is needed)

Proven on a 2:34 vertical promo and a 1:44 comparison film, each with narration and no narration versions.

- **Structure first** (scene table with timing, visuals and subtitle lines), confirm, then build.
- **Single source of timing:** `script.json` (lines with `sub` and `say`) and `plan.py` producing `timeline.json`. Subtitle rule: at least 2.5 s, about 0.18 s per Korean syllable plus 0.6 s, two lines max, about 18 characters per line. Everything (graphics, recordings, audio) reads `timeline.json`.
- **Screen recordings:** `video/rec.js` records real prototype pages with CDP screencast (JPEG q92, DPR 2.2, viewport 390x640 into an 858x1408 phone box), adds tap rings, smooth scroll and human typing, writes a constant frame rate H.264 clip and an `events.json` of taps. Record one scene at a time (parallel runs drop frames).
- **Motion graphics:** Remotion 4.x, one composition, video only (`--muted`), 1080x1920 at 30 fps; demo scenes hold the last clip frame if the clip is shorter. Chromium for Remotion and Playwright is preinstalled; pass `--browser-executable` to the bundled Chromium.
- **Narration:** MiniMax Speech 2.8 HD (voice `Korean_CalmLady`, `language_boost: Korean`, speed 1.05) via the Video (Replicate) connector, all lines in one call with `<#0.5#>` pauses between lines and `<#1.2#>` between scenes. The workspace cannot download from `replicate.delivery` (blocked by the network allowlist), so give the founder the link (expires in about 1 hour) and ask them to attach the mp3; `video/split_narr.py` splits it into lines by silence and writes measured durations, then rerun `plan.py`.
- **Music:** MiniMax Music 2.6 instrumental via the same connector (same download limitation), or the synthesized fallback `video/make_bgm.py`. Never use a copyrighted reference track; recreate the mood.
- **Mix:** `video/mix.py narr|silent` places narration, ducks music under speech, adds UI sounds from events (tap, pop, success, whoosh, type) and normalizes (narration version about -14 LUFS, silent version about -18 LUFS).
- **Trim instead of re-render:** `video/static_scan.py` finds frozen stretches; `video/cutplan.py` cuts tails after the last subtitle and long static runs while protecting every subtitle window; the mixer follows the same cut map (`CUTS=keep.json`) so audio stays in sync. Check frames at every cut: a scene's last few frames can flash a different screen.
- **3D:** `pip install bpy` gives headless Blender 5.x. EEVEE only runs on software GL here (too slow); Cycles at about 20 samples with OpenImageDenoise, 70% resolution upscaled, took about 21 s per frame on 2 CPU cores. Budget 3 to 5 second hero shots, not whole films.
- **Delivery size:** final encode CRF 23 veryfast plus AAC 192k keeps a 2.5 minute 1080x1920 film near 25 MB.

The scripts in `video/` contain absolute paths from the old session; change the `V` root constants and the prototype paths before use.

---

## 10. Environment notes

- Network from the shell is allowlisted: npm, pip and GitHub work; Hugging Face, `replicate.delivery` and most other hosts do not. Do not retry blocked hosts through other routes; ask the founder to attach files instead.
- The machine has 2 CPU cores: a 3 minute 1080x1920 Remotion render takes 30 to 45 minutes. Render once, mux audio separately, splice changed scenes instead of re-rendering everything.
- Publish reviewable pages as artifacts; send files with the file tool.

---

## 11. Suggested first message in the new session

> Read HANDOFF.md. Fill the Brand sheet with me, then propose the site map and the migration flow structure for confirmation. After I confirm, build the HTML prototype of the landing, the migration app (every state in 4.4) and the public dashboard, run the review loop to 85+, and draft the swap contract spec and test plan for the developer.
