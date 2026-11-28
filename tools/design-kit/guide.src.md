# Cojam Daily Prediction: design reference

One self contained guide to the finished design of the Cojam Daily Prediction platform: a mobile web app (PWA) where players make five quick predictions a day by swiping cards, earn points, see results and a weekly ranking, stake tokens and manage a wallet, plus a desktop admin console for the operators. Read it top to bottom once; after that you can design new screens in the same visual language without the source files.

The companion zip (`cojam-design-kit.zip`) holds the runnable design: every screen and state as static HTML with mock data, the shared CSS and JS, the admin, and fresh screenshots. This file is its `README.md`. Every class name and value quoted below is copied from those files, not invented.

## Contents

1. [What this is and how to use it](#1-what-this-is-and-how-to-use-it)
2. [The visual language in rules](#2-the-visual-language-in-rules)
3. [Tokens](#3-tokens)
4. [Page shell](#4-page-shell)
5. [Component inventory](#5-component-inventory)
6. [Interaction patterns](#6-interaction-patterns)
7. [Screen patterns](#7-screen-patterns)
8. [The review method that produced it](#8-the-review-method-that-produced-it)
9. [Language and copy (i18n)](#9-language-and-copy-i18n)
10. [What is in the zip](#10-what-is-in-the-zip)

---

## 1. What this is and how to use it

**What it is.** The design system and screen catalogue of a finished product design, reached after five rounds of building, capturing, independent scoring and fixing. The PWA has 17 screens with about 200 named states; the admin has 8 screens with about 80 states. All of it is plain HTML, CSS and a little vanilla JS: no framework, no build step.

**How to use it as a reference.**

- **Adopt the system and its rules:** the flat section structure, the 2 px ink line language, the three button looks, the one segmented pattern, the single place where the offset shadow is allowed, the display numerals for key figures, the one notice component for one state, the review sheet before any value action, the motion rules and the review loop. These are the parts that made the design score well, and they transfer to any product.
- **Replace the brand:** swap the colour values in the tokens (keep the roles: one loud colour, ink, off white ground, one key accent with few jobs, two equal weight answer colours), the logo, the fonts if you have your own, all copy and all illustrations. The token file is built so that changing values, not names, rebrands every screen.
- **Do not copy** Cojam's name, its mark (`assets/cojam-mark.svg`), its question illustrations (`assets/img/q*.svg`), its product copy or its mock data. Those belong to Cojam. Draw your own pictures under the same rules (section 5.4).
- **Keep the roles when you change colours.** For example, if your accent is orange instead of lime, it still gets only the four jobs listed in section 2, and you must re-check every contrast pair listed in section 3.

**Words used below.** *Ink* is the near black navy `#0B1530`. *Snow* is the page ground `#FDFDFF`. *Blue* is the brand colour `#124CC4`. *Lime* (token `--volt`) is the key accent `#D6FF3D`. *Coral* and *sky* are the two answer colours. *Band* is the blue header area with a 44 px grid. *Display face* is Archivo at 118% width, weight 900, used for figures and titles.

---

## 2. The visual language in rules

These rules come from the final design brief (`ROUND5.md`) and from the CSS as it really is. They are the system; the components in section 5 are only their consequences.

### 2.1 Structure: flat sections and ink lines

- **A screen is one flat surface.** No stacked bordered cards, never a card inside a card. Figures, lists and forms sit straight on the snow ground.
- **Major sections are separated by a 2 px ink line** (`--rule: 2px solid var(--ink)`), applied by `.sec + .sec` (and `.msec + .msec` on money screens): 20 px of space above the content, the line, 8 px of margin above the line.
- **Light hairlines only between rows inside a list** (`--hair: 1px solid var(--line)`, `#DCE3EF`).
- **One tinted block per screen at most** (`.tint`, ground `--inset` `#EEF2F9`), only where it earns it, never one inside another. The open question in the list view and the player's own row in the ranking use the pale sky tint `--sky-tint` for the same reason: they are the one highlighted thing.
- **Lines carry the brand on quiet screens.** Ink outlined number blocks, ink outlined chips, the 4 px ink foot under the current tab, the three figures divided by ink rules: this is what makes a wallet or a profile recognisably the same product below the header.

### 2.2 Exactly three button looks (plus one, admin only)

1. **Primary:** lime fill, 2 px ink edge, hard ink drop `0 4px 0 var(--ink)`, medium radius, 52 px tall. One per view: the main action.
2. **Secondary:** 2 px ink outline on white, medium radius, no shadow, 44 px tall. The same white button on every ground (snow, blue band, ink).
3. **Text link:** underlined words in blue (white on blue or ink grounds), no box. Destructive text links are red (`.btn-danger` in the PWA is a red text link).
4. **Admin only, destructive confirm:** red fill `#B42318` with white text (6.6:1), used only as the confirming button inside a destructive confirmation dialog (block an account, void a question, cancel, discard). The PWA never has it.

There is no grey filled button anywhere. A switched off primary keeps the primary's shape: a flat pale lime `--volt-off` with muted ink text, no drop. A switched off secondary loses its ink edge to `--line-strong`.

### 2.3 One segmented pattern

A 2 px ink outlined track with a medium radius; segments divided by the same ink line; the current segment filled ink with white text. No thumb, no soft shadow, no grey track. Where a control navigates to another page it must read as tabs or links, not as a filter: page tabs stand on the ink rule with a 4 px ink foot under the current one (`.mtabs`), and the card / list view switch on the blue band is a white outlined pair of links (`.viewsw`).

### 2.4 The offset shadow has one home

The hard drop belongs to **the primary button** and to **the single main object of a screen**: the prediction card on home (`--shadow-deck`) and the login panel on login (`--shadow-card`, it is the one object on that screen). The answer buttons carry a small `0 3px 0` drop because they are the primary action of the card. On the blue full screen states, small illustrative pieces (the gate sticker, the onboarding art, the system icon tile) echo the drop at a small size. Nothing else carries one: no shadows on sections, lists, notices, chips, toasts or mobile sheets.

### 2.5 The blue grid header band

Tab root screens open with a blue band (`.ph`) drawn with the landing page's 44 px grid: `--band` is two 1 px white lines at 12% opacity every 44 px over `#124CC4`. The title is set in the display face, upper case (Latin), 22 to 24 px. The band carries the screen title and at most one status line (on home: the count, the day progress and the time left). Sub pages get the plain blue app header with a back arrow and a title instead. Full screen states (gate, login, first run, system screens) use the band as the whole ground.

### 2.6 Display numerals for key figures

Every figure that matters (balances, points, ranks, prizes, rates, countdowns, the reward) is set in the display face: `font-family: var(--font-display); font-weight: 900; font-stretch: var(--wide)` (Archivo at 118%), tight tracking `-0.02em` to `-0.03em`, with the unit in a smaller size (`small` at 0.5em, normal width). Ordinary numbers in sentences stay in the text face with tabular numerals (`font-variant-numeric: tabular-nums` on `body`). A zero is not a hero: "0P" drops to plain muted text (`.rs-pts.is-zero`).

### 2.7 Chips and number blocks only for real counts

Ink outlined number blocks or chips in the landing's style are used only for real counts, ranks, steps or states: the rank block in a ranking row, the count of open stakes on a tab, the step number in a list of steps, a "Hit" or "Waiting" state chip. Never as decoration.

### 2.8 Lime has four jobs only

Lime `#D6FF3D` is used only for: **the primary action**, **the current selection** (a chosen lock period, the profile avatar on the profile screen), **day progress** (the five blocks), and **the reward moment** (the "+100P" figure pops in lime and settles to white). Never for a hit, a figure, an answer, a chart or decoration. The current tab and the current segment are ink, not lime. On the home screen at rest there is no lime at all except the progress blocks already done.

### 2.9 The two answer colours

The two answers of a prediction have their own colours everywhere: **left (no, down, under) is coral `#FF7A66`, right (yes, up, over) is sky `#4DB0FF`**, tuned to equal OKLCH lightness (0.731 and 0.733) and close chroma so neither looks recommended. Ink text on both (7.07:1 and 7.70:1). The colour follows the answer onto the drag stamp, the drag tint, the dot beside every made pick (pick line, list, day done, results) and the admin split bars. Neither is lime.

### 2.10 What never appears

No gradients as decoration (the only gradients are the grid pattern, the image scrim under card text, the skeleton shimmer and the 16 px fade above a pinned action bar), no glow, no glass or blur, no emoji, no soft drop shadows on mobile surfaces, no grey filled buttons, no pill shaped buttons (full pills only for small chips, the points pill and the logo chip), no text below 4.5:1, no touch target below 44 px.

### 2.11 Copy rules

- Plain words that say what happens. Name the thing in the button: "Stake 500 CT", "Convert 1,000P to 1 CT", "Withdraw 250 CT", "Block account".
- Sentence case for everything except the band titles, which are upper case in the display face (Latin only; Korean and Japanese have no case).
- No spaced hyphen (`" - "`) or spaced em dash (`" — "`) as a sentence break: use a colon, a comma, a conjunction or two sentences.
- Never show a result before it is confirmed: the day done screen says the picks are being saved and only then that the points were added.
- A control that is off says why in one line next to it. Nothing dead is left on the screen.
- Errors name the cause and offer the fix as a button ("Try again", "Paste", "Max").
- English is the source; Korean and Japanese are written natively, not translated literally (section 9).

---

## 3. Tokens

Every colour, size, radius, shadow and duration lives in `assets/tokens.css`. Components and screens hard code nothing (the admin has a few literal sizes because it is a dense desktop tool). To rebrand, change values here.

### 3.1 The groups

| Group | Tokens | Role and notes |
| --- | --- | --- |
| Brand blue | `--brand #124CC4`, `--brand-hover`, `--brand-deep`, `--brand-tint` | The one loud colour: app header, page band, links, focus ring. Snow on blue 7.35:1, blue text on snow 7.24:1. Never blue text on ink (2.6:1). |
| Key accent | `--volt #D6FF3D`, `--volt-hover`, `--on-volt #0B1530`, `--volt-off` | Lime, four jobs only (2.8). Ink on lime 15.7:1, lime on blue 6.38:1. Never lime text on snow (1.2:1). `--volt-off` is the switched off primary (ink-2 on it 6.6:1). |
| Answers | `--pick-l #FF7A66`, `--pick-r #4DB0FF`, `--pick-l-hot`, `--pick-r-hot`, `--on-pick` | Coral left, sky right, equal weight. Ink on coral 7.07:1, on sky 7.70:1; the hot shades (drag armed, hover, press) 6.29 and 6.91. |
| Sky | `--sky #97DBFF`, `--sky-tint #E3F5FF` | Secondary fill: chips, the third podium step, the "Copied" state, the deck's second card; the tint is hover and the one highlighted row. Sky on blue 4.86:1. Never sky text on snow (1.5:1). |
| Grounds | `--snow #FDFDFF`, `--surface #FFFFFF`, `--inset #EEF2F9`, `--stage #070E22` | Page ground, raised white (buttons, fields, chips), the one tinted block, and the dark stage around the phone column on wide screens. |
| Lines | `--line`, `--line-strong`, `--line-field #8390AC` | Hairlines between rows; switched off edges; the field edge (3.2:1 on white, so a control is found without the ink edge). |
| Ink | `--ink #0B1530`, `--ink-2 #4A5672`, `--ink-soft`, `--ink-line`, `--ink-raise` | Text and the ink edge; secondary text (7.21:1 on snow, 6.53:1 on mist); secondary text on ink (8.70:1); hairlines and one raised level on ink. |
| On blue | `--on-brand #FFFFFF`, `--on-brand-2 #D6E2FA`, `--band-slot`, `--band-chip`, `--grid-line` | Text on the band (secondary 5.64:1), the empty progress block, the quiet chip and the grid line on blue. |
| Status | `--up #0E7A4D`, `--down #B42318`, `--warn #8A5300` and their tints, `--up-on-ink` | Profit and success, error and loss, warning, each with a tint ground. Up on snow 5.29:1, down on snow 6.47:1, warn on its tint 5.81:1. Used for real status only, never as decoration. |
| Fonts | `--font` (Pretendard Variable), `--font-ja` (Pretendard JP), `--font-display` (Archivo, then Pretendard), `--font-data` (system monospace) | Text face, Japanese text face (switched by `:lang(ja)`), display face for figures and band titles, data face for addresses, hashes and codes only. Local fallbacks with `size-adjust` keep the metrics close while fonts load. |
| Type scale | `--fs-11` to `--fs-40`, `--fs-hero`, `--fs-clock` | 11 (tab badge count only), 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, plus two clamped display sizes. Body is 16; lists and captions 13 to 15. |
| Weights and width | `--fw-regular 400` to `--fw-black 900`, `--wide 118%`, `--wide-max 125%`, `--lh-*` | Display figures 900 at 118% width; band hero titles 125%. Line heights 1.08 (display), 1.25 (titles), 1.5 (body). |
| Space | `--s-2` to `--s-48`, `--gutter 16px`, `--stack 16px`, `--sect 28px`, `--target 44px`, `--head-h 56px`, `--tab-h 62px`, `--app-w 430px` | A 2 / 4 px based scale. 16 px side gutter. 44 px minimum touch target. The app is a 430 px phone column centred on a dark stage on wide screens. |
| Shape | `--r-s 6px`, `--r-m 12px`, `--r-l 24px`, `--r-pill`, `--edge`, `--edge-thin`, `--rule`, `--hair`, `--hair-strong` | Three radii with one job each: small for chips and blocks, medium for buttons, inputs, notes and toasts, large for the prediction card, sheets and the login panel. `--edge` is the 2 px ink line of the secondary button, fields and outlines; `--rule` the 2 px section line. |
| Shadow | `--shadow-hard`, `--shadow-hard-down`, `--shadow-answer`, `--shadow-card`, `--shadow-deck`, `--shadow-toast`, `--ring` | Hard ink drops only, each with a named owner (2.4). The toast gets a 2 px snow ring instead of a shadow so it separates from ink below it. |
| Pattern | `--band`, `--stripes`, `--stripes-ink`, `--card-scrim`, `--chip-on-img` | The 44 px grid band; lime stripes on a pending progress block; ink stripes for "waiting"; the scrim behind the question on an image card (the picture fades out over 54 px, text starts at 56 px on solid ink). |
| Motion | `--ease`, `--ease-out`, `--ease-drawer`, `--ease-spring`, `--dur-press 120ms` to `--dur-deck 420ms`, `--dur-burst`, `--stagger 50ms`, `--press-scale 0.97` | Transform and opacity only, 120 to 420 ms. Spring for press release, tab icon and the deck; drawer easing for sheets. |
| Layers | `--z-head 20`, `--z-pin 25`, `--z-tab 30`, `--z-sheet 50`, `--z-toast 60` | Header, pinned bar, tab bar, sheet, toast. |

### 3.2 The full token file

@@file assets/tokens.css css

---

## 4. Page shell

Every PWA screen is built by one function (`App.mount` in `assets/components.js`) so the header, tab bar, toasts and sheet are identical everywhere. The rendered structure:

```html
<a class="skip" href="#main">Skip to content</a>
<div class="app">                          <!-- .app--pin when a pinned action bar is present, .app--bare for full screen states -->
  <header class="ah">…</header>            <!-- blue app header: logo or back arrow, points pill, avatar -->
  <div class="offbar" role="status">…</div> <!-- only when offline -->
  <main id="main" tabindex="-1">
    <section class="ph">…</section>        <!-- the blue grid band on tab roots -->
    <div class="pg pg-fade">…</div>         <!-- the flat page: sections with ink rules -->
  </main>
  <div class="pin pin--act">…</div>         <!-- optional: the primary action of a form, pinned above the tab bar -->
  <nav class="tb">…</nav>                   <!-- five tabs -->
</div>
<div class="toasts" id="toasts" role="status" aria-live="polite"></div>
<div class="sr-only" id="live" aria-live="polite"></div>
<div class="sheet-root" id="sheet-root"><div class="sheet-scrim" data-sheet-scrim></div><div class="sheet" id="sheet" role="dialog" aria-modal="true" tabindex="-1"></div></div>
```

@@css assets/components.css :: ^(body|\.app|\.app--pin \.pg|\.app--bare \.pg|\.pg|\.num, \.display|\.muted)(?![\w-])(?!.*(:has|is-gate))
@@css assets/components.css :: ^:focus-visible$|^\.on-dark :focus-visible

Notes: the body ground is the dark `--stage`, the app column is snow and at most 430 px wide with a stage shadow on screens 480 px and wider. Tabular numerals and no ligatures for the whole app (Pretendard would otherwise turn `0x4f` into `0×4f`). Korean uses `word-break: keep-all`; Japanese `word-break: auto-phrase` with strict line breaking. The focus ring is a 3 px blue outline, white on blue and ink grounds.

**Icons** are 24 px grid line icons drawn inline as SVG: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins, `aria-hidden="true"`. The current tab uses a filled variant of its icon. In the snippets below `<svg>…</svg>` stands for one of these icons.

---

## 5. Component inventory

Each entry gives the purpose, the anatomy, the essential HTML (as the shared builders in `components.js` render it, trimmed), the essential CSS copied from the real files, the states, and one do / do not line. File paths are relative to the design folder.

### 5.1 App header and points pill

**Purpose.** Identity, the player's points (always visible, a link to the wallet) and the profile avatar, on a blue bar that stays on top.

**Anatomy.** `.ah` (sticky, blue) > `.ah-in` (56 px row) > the logo chip `.chip-logo` (or `.ah-back` arrow plus `.ah-title` on sub pages) and `.ah-end` with the points pill `.pts > .pts-in` (ink pill, display face) and the avatar `.me > .me-in` (white outlined circle, lime when the profile is the current page).

```html
<header class="ah"><div class="ah-in">
  <a class="ah-logo" href="home-cards.html" aria-label="Cojam home"><span class="chip-logo"><img src="assets/cojam-mark.svg" alt="" width="26" height="26">Cojam</span></a>
  <div class="ah-end">
    <a class="pts" id="pts" href="wallet.html" aria-label="1,250 points. Open wallet"><span class="pts-in"><span id="pts-val">1,250P</span><span class="pts-tag">+50</span></span></a>
    <a class="me" href="profile.html" aria-label="Profile and settings"><span class="me-in" aria-hidden="true">M</span></a>
  </div>
</div></header>
<!-- sub page: <header class="ah ah--sub"><div class="ah-in"><a class="ah-back" href="…" aria-label="Back"><svg>…</svg></a><span class="ah-title">Convert points</span>…</div></header> -->
```

@@css assets/components.css :: ^\.(ah|ah-in|ah--sub|ah-logo|chip-logo|ah-back|ah-title|ah-end|pts|pts-in|pts-tag|pts-dot|me|me-in)(?![\w-])

**States.** Points pill: loading (a skeleton bar), ready, pending (a spinner while today's last pick is saved), hits (a sky `+50` tag for points that land later), stale (a muted dot). It pulses (`.is-pulse`, scale 1.06) when points are added. The label for screen readers says the state in words.

**Do / do not.** Do keep the points one tap from the wallet on every screen. Do not put a second action in the header.

### 5.2 Page head band

**Purpose.** The title of a tab root screen and, where it helps, one status line, on the brand's blue grid.

**Anatomy.** `.ph` (the `--band` ground) > `.ph-top` (title `h1` in the display face, upper case, plus an optional control on the right such as the view switch `.viewsw`) > optional `.ph-line` (count `.ph-count`, the day progress `.day5--band`, the time left `.ph-cd`).

```html
<section class="ph">
  <div class="ph-top"><h1>Today's picks</h1>
    <div class="viewsw" role="group" aria-label="View"><a href="home-cards.html" aria-current="page"><span>Cards</span></a><a href="home-terminal.html" aria-label="List view"><svg>…</svg></a></div>
  </div>
  <div class="ph-line"><span class="ph-count"><span id="cnt">0</span><small>/5</small></span>
    <div class="day5 day5--band" role="img" aria-label="0 of 5 answered"><i></i><i></i><i></i><i></i><i></i></div>
    <span class="ph-cd"><span>Closes in</span><b data-cd="34000">09:24:36</b></span>
  </div>
</section>
```

@@css assets/components.css :: ^\.(ph|ph-top|ph-line|ph-count|ph-cd|ph-note|viewsw)(?![\w-])|^:lang\(ko\) \.ph h1

**States.** Title only (most tabs); title plus status line (home); the day done variant where a small label sits over a 60 px "+100P" hero (`assets/screens/home.css`, `.done-stack`); the invite variant with a 76 to 96 px "10%" hero. Korean and Japanese titles go one weight heavier, about 2 px larger, with a 0.35 px text stroke, because Hangul and kana have no wide cut.

**Do / do not.** Do keep the band to a title and one line. Do not stack cards, buttons or paragraphs on the band of a tab screen.

### 5.3 Bottom tab bar

**Purpose.** The five places of the app, always in thumb reach.

**Anatomy.** `.tb` (fixed, snow, hairline on top, five equal columns) > `a` per tab with `.tb-ic` (the icon box, 44 x 30) and the label. The current tab is ink with a filled icon and a heavy label; the others are `--ink-2`. Badges: `.tb-dot` (a sky dot with an ink edge: something waits there) and `.tb-n` (an ink count, "9+" above nine).

```html
<nav class="tb" aria-label="Main">
  <a href="home-cards.html" aria-current="page"><span class="tb-ic"><svg>…</svg><span class="tb-dot"></span><span class="sr-only">predictions left today</span></span><span>Home</span></a>
  <a href="results.html"><span class="tb-ic"><svg>…</svg><span class="tb-n" aria-hidden="true">2</span><span class="sr-only">2 new answers</span></span><span>Results</span></a>
  <a href="ranking.html">…Ranking</a><a href="stakes.html">…Staking</a><a href="wallet.html">…Wallet</a>
</nav>
```

@@css assets/components.css :: ^\.(tb|tb-ic|tb-dot|tb-n)(?![\w-])|^@keyframes tab-in

**States.** Current (ink, filled icon, a small spring as the page loads), rest, pressed (icon scales to 0.9), with dot or count badge.

**Do / do not.** Do mark the current tab with ink weight and a filled icon. Do not use a lime pill or a coloured background behind the current tab.

### 5.4 The prediction card and the deck

**Purpose.** The signature object: one question at a time on a physical deck of three cards. The only object on the home screen, so it alone carries the offset shadow.

**Anatomy.** `.deck` (a grid stack) > three `.qcard` articles positioned by `data-pos` (0 front, 1 and 2 behind, rotated plus and minus 3 degrees, scaled 0.96, tinted sky and brand tint by an `::after` veil). Each card: `.qimg` (the full bleed picture, or `.qimg--fallback` with the category icon in a white tile on the blue grid), `.qtint` (the drag colour wash), two `.qstamp` labels (the answer that a drag would make), `.qcard-top` with two `.qchip` (category and "1 / 5"), and `.qcard-body` on the `--card-scrim` with the question `h2` (clamped to 3 lines, steps down a size when long), `.qcard-meta` (the answer source, and "AI settles it after …" as a button that opens an explanation sheet), the two answer buttons `.choices`, and `.qcard-final` (one line: "+50P if right. Undo for 3 seconds.").

```html
<div class="deck" id="deck">
  <article class="qcard" data-q="1" data-id="q1" data-pos="0" role="group" aria-label="Question 1 of 5: Will Bitcoin close above $100,000 today?">
    <div class="qimg"><img src="assets/img/q1-bitcoin.svg" alt="" width="800" height="1000" decoding="async" draggable="false"></div>
    <span class="qtint" aria-hidden="true"></span>
    <span class="qstamp qstamp--l" aria-hidden="true">No</span><span class="qstamp qstamp--r" aria-hidden="true">Yes</span>
    <div class="qcard-top"><span class="qchip">Crypto</span><span class="qchip" aria-hidden="true">1 / 5</span></div>
    <div class="qcard-body">
      <h2>Will Bitcoin close above $100,000 today?</h2>
      <div class="qcard-meta">
        <span><svg>…</svg><span>Answer: Binance BTC/USDT daily close, 00:00 UTC</span></span>
        <button type="button" class="qmeta-btn" data-ai-info="q1" aria-haspopup="dialog"><svg>…</svg><span>AI settles it after 09:00 tomorrow</span><svg>…</svg></button>
      </div>
      <div class="choices">…two .choice buttons (5.5)…</div>
      <p class="qcard-final">+50P if right. Undo for 3 seconds.</p>
    </div>
  </article>
  <!-- two more .qcard with data-pos="1" and "2" -->
</div>
```

@@css assets/components.css :: ^\.(deck|qcard|qimg|qimg--fallback|qtint|qcard-top|qchip|qcard-body|qcard-meta|qcard-final|qstamp|qstamp--l|qstamp--r)(?![\w-])(?!.*(choice|is-long|> span|svg|qimg img))

**Picture rules.** Every question has a 4:5 portrait picture (800 x 1000). No text, numbers or labels inside the picture (the card carries all text, in three languages). The focal object sits in the top 45% of the frame and away from the two top corners (the chips sit there). The lower half is covered by the question and the buttons, so nothing important goes there. The Cojam pictures are flat SVG illustrations in the palette without lime. With no picture, the card draws the category icon in a white circle with a hard drop on the blue grid.

**States.** Front, behind (content hidden, only the picture shows), dragging (`.is-drag`, no transition), armed (stamp solid, answer button hot, 20% tint), thrown out (`data-pos="out"`), restored by Undo, failed ("Not saved" note on the card), switched off (offline: answers look off but still take a tap that explains why), loading skeleton. An alternative layout with the image on top and text on white (`.qcard--top`) was kept for comparison but is not the chosen one.

**Do / do not.** Do keep every word on the card outside the picture. Do not give any other object on the screen a hard drop while the card is there.

### 5.5 Answer buttons

**Purpose.** The two answers of the question: the tap alternative to the swipe, in the answers' own colours.

**Anatomy.** `.choices` (two equal columns) > `.choice[data-dir="l"]` (coral, left arrow before the word) and `.choice[data-dir="r"]` (sky, right arrow after the word): 54 px tall, 2 px ink edge, medium radius, `0 3px 0` ink drop. The dot `.pk` shows a made pick anywhere else in the app.

```html
<div class="choices">
  <button type="button" class="choice" data-dir="l" aria-label="Pick No for: Will Bitcoin close above $100,000 today?"><svg>…</svg><span>No</span></button>
  <button type="button" class="choice" data-dir="r" aria-label="Pick Yes for: Will Bitcoin close above $100,000 today?"><span>Yes</span><svg>…</svg></button>
</div>
<!-- a made pick, wherever it is shown -->
<span class="pk pk--r"><i aria-hidden="true"></i>Yes</span>
```

@@css assets/components.css :: ^\.(choices|choice|pk)(?![\w-])|^\.qtint\[data-dir="l"\]

**States.** Rest, hover (hot shade), hot during an armed drag (scale 1.04, hot shade), pressed (moves down 2 px onto a 1 px drop), switched off (`aria-disabled="true"`: mist ground, line edge, no drop, but the tap still answers with a toast saying why).

**Do / do not.** Do use the answer colours for every trace of an answer. Do not colour either answer with the accent, or make one look recommended.

### 5.6 Pick bar, Undo and the finishing panel

**Purpose.** Under the deck, in thumb reach: the last pick with a 44 px Undo whose ring is the 3 seconds left; then "Saving", then "Saved". Behind the last card, the finishing panel with a large ring, "Finishing in 3" and a "Finish now" primary button.

**Anatomy.** `.pickbar` (48 px tall even when empty, so the deck never jumps) > `.pickbar-msg` (check icon, "Q2: Yes" with the answer dot) and `.undo` (a secondary button with `.undo-ring`, an SVG circle whose stroke empties over 3 s, and a `kbd` hint "Z" shown only where there is a keyboard). At rest the bar shows a hint (`.pickbar-hint`: "Swipe the card or tap an answer", or "Drag the card, click an answer, or press the arrow keys" on desktop), later "3 left today". `.deck-end` with `.end-ring` sits behind the cards.

```html
<div class="pickbar" id="pickbar">
  <span class="pickbar-msg" id="pick-msg"><svg>…</svg><span>Q1: <span class="pk pk--r"><i aria-hidden="true"></i>Yes</span></span></span>
  <button type="button" class="undo" id="undo" aria-label="Undo question 1: Yes">
    <svg class="undo-ring" viewBox="0 0 22 22" aria-hidden="true"><circle class="trk" cx="11" cy="11" r="8"/><circle class="run" cx="11" cy="11" r="8" style="animation-duration:3000ms;animation-delay:-400ms"/></svg>
    <span>Undo</span><kbd aria-hidden="true">Z</kbd>
  </button>
</div>
<div class="deck-end" id="deck-end" aria-hidden="true">
  <div class="end-ring" aria-hidden="true"><svg class="ring" viewBox="0 0 92 92"><circle class="trk" cx="46" cy="46" r="40"/><circle class="run" cx="46" cy="46" r="40"/></svg><svg>…</svg></div>
  <h2>That is all five</h2><p id="end-p">Finishing in <b>3</b></p>
  <div id="end-act"><button type="button" class="btn btn-primary" id="finish"><span>Finish now</span></button></div>
</div>
```

@@css assets/components.css :: ^\.(pickbar|pickbar-msg|undo|undo-ring|deck-end|end-ring)(?![\w-])(?!.*(kbd|\.spin|is-quiet|is-out|> span|deck-end p b|deck-end h2|\.trk))|^@keyframes undo-run

**States.** Hint, held (message plus Undo with its ring), saving (spinner, quiet), saved (check, fades out after 1.2 s), left count. The finishing panel shows only after the fifth pick while a pick can still be undone; its primary button exists only during that wait, so the home screen carries no lime at rest.

**Do / do not.** Do let the Undo ring be the countdown itself. Do not repaint the bar while a finger may be on Undo (an older pick being saved must not move the button).

### 5.7 Day progress blocks

**Purpose.** The product's signature progress: five blocks for the five predictions of the day. The only lime that may sit on the home screen at rest.

**Anatomy.** `.day5` (five equal columns, 14 px tall blocks) with `i` per question and a state class: `is-done` (lime with ink edge), `is-pend` (moving lime stripes: sent, not yet confirmed), `is-fail` (red tint), `is-miss` (ink), `is-wait` (ink stripes). Variants: `--band` (on blue, empty slots are 20% white), `--sm` (a 92 px inline version), `--lg` (56 px blocks with a check, day done), `--ink` (on ink).

```html
<div class="day5 day5--band" role="img" aria-label="2 of 5 answered" id="day5">
  <i style="--i:0" class="is-done"></i><i style="--i:1" class="is-pend"></i><i style="--i:2"></i><i style="--i:3"></i><i style="--i:4"></i>
</div>
```

@@css assets/components.css :: ^\.day5(?!.*(is-flash|is-wave|--ink|--sm|--lg|is-fill))|^@keyframes stripes$

**States.** Empty, done, pending, failed, missed, waiting; a fill animation as a block completes (`is-fill`), a staggered pop (`is-flash`) and a wave on the day done screen (`is-wave`, every block ends where it started).

**Do / do not.** Do give the progress its own block language and reuse it (stake progress `.mbar` copies its outline). Do not show progress as a thin generic bar.

### 5.8 Sections, labels and the tinted block

**Purpose.** The flat page structure: sections separated by the 2 px ink rule, a heading row, a small label above a figure, and at most one tinted block.

```html
<section class="sec">
  <h2 class="sect-h">Today's picks <a class="linkish" href="results.html">See results</a></h2>
  …rows…
</section>
<section class="sec">…the next section starts under a 2 px ink rule…</section>
```

@@css assets/components.css :: ^\.(sec|sec \+ \.sec, \.sec-rule|rule|tint|lbl|sect-h|hr)(?![\w-])
@@css assets/screens/money.css :: ^\.(msec|msec \+ \.msec, \.mtabs \+ \.msec--rule|mhead)(?![\w-])

**Do / do not.** Do separate major parts with the ink rule and rows with hairlines. Do not wrap a section in a bordered card.

### 5.9 List rows

**Purpose.** Plain rows on the page, separated by hairlines: picks, results, the list view of today's questions, summary rows (label and value), rows that open another page, and questions that open in place.

**Anatomy.**

- `.list` > `.pick` (question clamped to 2 lines on the left, the pick with its dot on the right).
- `.rows` (a `dl`): `dt` muted label, `dd` bold value on the right; `.is-em` sets the value in the display face (the interest in a review).
- `.rowlink` (a 52 px row that is a link: label, value, chevron).
- `.trow` (list view of today's questions: a blue display number, the question, a category chip, a 52 px thumbnail, then "Pick" or the made pick). The open question `.trow.is-open` is the one sky tinted block of that screen and shows the full card body with the two answer buttons.
- `.help` (`details` with a 52 px `summary`: "How staking works").

```html
<ul class="list">
  <li class="pick"><span class="pick-q">Will Bitcoin close above $100,000 today?</span><span class="pick-c"><span class="pk pk--r"><i aria-hidden="true"></i>Yes</span></span></li>
</ul>
<dl class="rows">
  <div><dt>Amount</dt><dd>12,000 CT</dd></div>
  <div class="is-em"><dt>Interest over 90 days</dt><dd>414.2466 CT</dd></div>
</dl>
<details class="help"><summary>How staking works<svg>…</svg></summary><div class="help-body">…</div></details>
```

@@css assets/components.css :: ^\.(list|pick|pick-q|pick-c|rows|rowlink|trow|trow-n|trow-q)(?![\w-])(?!.*(is-done|is-fail|btn|qmeta))

**Do / do not.** Do keep rows 52 to 64 px with a full width touch area. Do not put a box around each row.

### 5.10 Buttons: primary, secondary, text link

**Purpose.** The three looks of section 2.2. One builder (`C.btn(label, { kind, block, sm, icon, iconEnd, href, disabled })`) makes all of them.

```html
<button type="button" class="btn btn-primary btn-block"><span>Stake 500 CT</span></button>   <!-- primary -->
<a class="btn" href="deposit.html"><svg>…</svg><span>Deposit</span></a>                         <!-- secondary -->
<button type="button" class="btn btn-ghost"><span>Cancel</span></button>                         <!-- text link -->
<button type="button" class="btn btn-primary btn-block" disabled><span>Stake 500 CT</span></button> <!-- off: says why next to it -->
<button type="button" class="btn btn-primary btn-block is-busy" disabled><span class="spin"></span><span>Staking 500 CT: sending</span></button>
```

@@css assets/components.css :: ^\.btn(-primary|-ghost|-block|-sm|-icon)?(?![\w-])|^\.btn-ghost, \.btn-danger|^:is\(\.btn-ghost, \.btn-danger\)|^\.(linkish|spin)(?![\w-])|^@keyframes spin

The admin's fourth look, only inside a destructive confirmation (`class="btn btn-primary btn-danger"`):

@@css admin/admin.css :: ^\.btn-danger

**States.** Rest, hover (secondary: sky tint; primary: hover lime), pressed (`.is-pressed` is added on pointer down by one global listener: secondary scales to 0.97 with a sky tint, primary moves down 3 px onto a 1 px drop), switched off, busy (a running transaction: the button that started it is disabled and becomes the status, so nothing floats over the page and the same action cannot start twice), done ("Copied" turns a secondary sky for 2 s). On blue and ink grounds the text link turns white.

**Do / do not.** Do have one primary per view and name the thing in it. Do not add a fourth look in the product, or a grey filled button.

### 5.11 Segmented control and page tabs

**Purpose.** Choosing one of a few options in place (`.seg`), or moving between two pages of one place (`.mtabs`).

```html
<div class="seg" role="group" aria-label="Week" data-seg="week">
  <button type="button" class="seg-btn" data-value="this" aria-pressed="true">This week</button>
  <button type="button" class="seg-btn" data-value="last" aria-pressed="false">Last week</button>
</div>
<nav class="mtabs" aria-label="Staking">
  <a href="staking.html" aria-current="page">New stake</a>
  <a href="stakes.html">My stakes<span class="mtabs-n">2</span></a>
</nav>
```

@@css assets/components.css :: ^\.seg(-btn|-wrap)?(?![\w-])
@@css assets/screens/money.css :: ^\.mtabs(-n)?(?![\w-])

The admin uses the same two patterns at desktop density:

@@css admin/admin.css :: ^\.(seg|tabs)(?![\w-])

**States.** Current (ink), rest, hover and pressed (sky tint), focus (a blue ring outside the track with a white gap), switched off (line coloured track). A real count on a tab sits in an ink outlined number chip.

**Do / do not.** Do use tabs on the ink rule when the choice changes the page. Do not draw a white thumb on a grey track.

### 5.12 Fields with an inline action

**Purpose.** Amounts, addresses, names and codes, in a 56 px box with the same 2 px ink edge as the secondary button, with the unit and an inline action (Max, Paste, Save) inside the box.

**Anatomy.** `.field` > `.field-label` (label left, context such as "Available 1,840.5 CT" right) > `.field-box` (input in 24 px heavy type for amounts, `.field-unit`, `.field-max` as a smaller secondary button) > `.field-msg` (help, a valid echo, or an error in red, `aria-live`). Variants: `--text`, `--mono` (addresses), `--code` (one time codes in the display face, wide tracking). The lock period picker `.period` is a grid of four outlined options; the chosen one is lime (the current selection).

```html
<div class="field">
  <div class="field-label"><label for="amt"><b>Amount</b></label><span>Available <b>1,840.5 CT</b></span></div>
  <div class="field-box"><input id="amt" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="500" aria-describedby="amt-msg"><span class="field-unit">CT</span><button type="button" class="field-max" data-max="amt">Max</button></div>
  <div class="field-msg" id="amt-msg" aria-live="polite">1,000 CT or more earns +1%</div>
</div>
<div class="period" role="group" aria-label="Lock period">
  <button type="button" aria-pressed="false"><b>30<small>d</small></b><span>8%</span></button>
  <button type="button" aria-pressed="true"><b>90<small>d</small></b><span>12%</span></button>
</div>
```

@@css assets/components.css :: ^\.(field|field-label|field-box|field-box--text|field-box--mono|field-box--code|field-unit|field-max|field-cap|field-msg|typo)(?![\w-])|^\.period( button| b| span| button\[aria-pressed="true"\]| button\[disabled\])?$

**States.** Rest, focus (a blue ring outside the ink edge), error (red edge, red message that names the cause and the fix), switched off (mist ground, line edge), valid echo (a pasted address repeated in full, grouped in fours, under the field), "did you mean" for a mistyped email domain (`.typo`, a sky tint row with a one tap fix). The amount parser accepts "1,250.75", "500 CT" and "500ct" and refuses junk with a reason.

**Do / do not.** Do put the unit and the most useful action inside the field. Do not leave the primary enabled while the field holds a value it cannot send.

### 5.13 Address chip and copy block

**Purpose.** Show whose wallet it is without a wall of hex, and copy with one tap. The whole chip or block is the control; for 2 s it turns sky and reads "Copied".

```html
<button type="button" class="addr-chip" data-copy="0x7A3fC2b91E5d4086aB17c93D5E0f6A2948bD1C7e" data-done="Copied" aria-label="Copy address: 0x7A3fC2b91E5d4086aB17c93D5E0f6A2948bD1C7e">
  <span class="addr-chip-v" translate="no">0x7A3f…1C7e</span><svg>…</svg>
</button>
<!-- the full address: always two equal lines of five groups of four -->
<p class="addr-v" translate="no"><span><i>0x7A3f</i><i>C2b9</i><i>1E5d</i><i>4086</i><i>aB17</i></span><span><i>c93D</i><i>5E0f</i><i>6A29</i><i>48bD</i><i>1C7e</i></span></p>
<!-- an invite code -->
<button type="button" class="code-block" data-copy="MINJI7Q" data-done="Copied"><b class="code-v" translate="no">MINJI7Q</b><i class="code-act"><svg>…</svg><svg>…</svg><span>Copy</span></i></button>
```

@@css assets/components.css :: ^\.(addr-chip|addr-chip-v|addr-v)(?![\w-])
@@css assets/screens/invite.css :: ^\.(code-block|code-v|code-act)(?![\w-])

**States.** Rest, hover (sky tint), done (sky ground, check icon, "Copied", announced to screen readers; the chip keeps its width so nothing jumps). Addresses and codes use the data face with ligatures off.

**Do / do not.** Do show the short address as a chip on wallet and profile, and the full grouped address only where it is needed (deposit, a withdraw echo). Do not show a long address on one unbroken line.

### 5.14 Notices: account on hold and notes

**Purpose.** One component for one state everywhere. An account on hold is announced by the same notice on every screen it affects (`C.hold`): white ground, 2 px ink outline, ink pause icon, the title "Account on hold", what it means on this screen, and a link "What this means" to the full explanation. Ordinary notes (`.note`) carry information, warnings (ink on white inside the 2 px ink outline, never cream or brown), real errors (red tint) and success (green tint).

```html
<div class="hold" role="status"><svg>…</svg>
  <div class="hold-body"><b class="hold-t">Account on hold</b>
    <p>You cannot convert points while on hold. You can still withdraw CT, paying the network fee in KAIA.</p>
    <a class="hold-more" href="system.html?state=blocked">What this means<svg>…</svg></a>
  </div>
</div>
<!-- a quiet reason under a control that is off, or the fee line under one that still works -->
<p class="hold-why"><svg>…</svg><span>You pay the network fee in KAIA (about 0.0021 KAIA).</span></p>
<div class="note note-warn"><svg>…</svg><div class="note-body"><div>Send only on Kaia. Tokens sent on another network can be lost.</div></div></div>
<div class="note note-error" role="alert"><svg>…</svg><div class="note-body"><div>We could not load this. Your points and CT are safe on chain.</div><button type="button" class="btn btn-sm" data-reload><svg>…</svg><span>Try again</span></button></div></div>
```

@@css assets/components.css :: ^\.(hold|hold-body|hold-t|hold-more|hold-why|note|note-body|note-warn|note-error|note-ok|note-sky|banner|banner-warn)(?![\w-])

**States.** Hold (with an optional action, for example "My stakes" on the new stake screen), note info, warn, error with a retry button, ok. `.banner` is the slim status line above the deck ("1 pick is still being saved" with "Retry now", "Reconnecting this device").

**Do / do not.** Do use one notice for one state on every screen, and say what still works. Do not invent a new banner style per screen for the same condition.

### 5.15 Toast and offline bar

**Purpose.** A short confirmation or a reason, at the bottom above the tab bar (and above a pinned bar), for 4 s (8 s with an action). The same notice is never stacked. The offline bar sits under the header and says when the data was last updated.

```html
<div class="toasts" id="toasts" role="status" aria-live="polite">
  <div class="toast"><span>Your pick on question 2 was not saved.</span><button type="button">Try again</button></div>
</div>
<div class="offbar" role="status"><svg>…</svg><div>You are offline. Showing what was saved on this device.<small>Last updated 13:09</small></div></div>
```

@@css assets/components.css :: ^\.(toasts|toast|offbar|stamp|live|live-dot)(?![\w-])|^@keyframes (toast-in|toast-out|blink)

**Do / do not.** Do let a button that turns into "Copied" speak for itself instead of a toast. Do not repeat the same message in a toast that the screen already shows.

### 5.16 Bottom sheet and the transaction review sheet

**Purpose.** Every value action (stake, claim, withdraw, convert) opens a review sheet first: a title that is the question ("Stake 12,000 CT for 90 days?"), the facts as rows, the consequence as an outlined warning, then the primary button that names the action and a Cancel text link. The same sheet then walks through signing, steps, sending, success and failure. Picks never use it.

**Anatomy.** `.sheet-root` (fixed, scrim 56% ink) > `.sheet` (snow, 2 px ink edge, large top radius, slides up with the drawer easing; on screens 720 px and wider a centred dialog with the card shadow) > `.sheet-grip`, `h2`, `.rows`, optional `.check` (a required confirmation checkbox that unlocks the button), `.sheet-warn`, `.sheet-acts`. Waiting states use `.sheet-state` with an outlined tile `.sheet-ic` and a spinner; steps use `.txsteps` (ink number blocks: outline while waiting, filled when now or done); success shows `.sheet-done` (what happened as a display figure on ink beside a lime check block, the reward moment at a smaller size).

```html
<div class="sheet-root is-open" id="sheet-root"><div class="sheet-scrim" data-sheet-scrim></div>
  <div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h" tabindex="-1">
    <div class="sheet-grip" data-grip aria-hidden="true"></div>
    <h2 id="sheet-h">Stake 12,000 CT for 90 days?</h2>
    <dl class="rows"><div><dt>Amount</dt><dd>12,000 CT</dd></div><div><dt>Lock period</dt><dd>90 days</dd></div><div><dt>Annual rate</dt><dd>14%</dd></div><div class="is-em"><dt>Interest over 90 days</dt><dd>414.2466 CT</dd></div></dl>
    <p class="sheet-warn"><svg>…</svg><span>No early exit: this CT stays locked until Feb 25, 2027.</span></p>
    <div class="sheet-acts">
      <button type="button" class="btn btn-primary btn-block" data-tx="confirm" id="tx-confirm"><span>Stake 12,000 CT</span></button>
      <button type="button" class="btn btn-ghost btn-block" data-tx="cancel"><span>Cancel</span></button>
    </div>
  </div>
</div>
```

@@css assets/components.css :: ^\.(sheet-root|sheet-scrim|sheet|sheet-grip|sheet-acts|sheet-warn|sheet-ic|sheet-done|sheet-done-ck|sheet-done-fig|txsteps)(?![\w-])(?!.*(svg|small|\.spin|\.st$|is-fail|\.sheet-ic\.is-bad))

**States and flow.** review > signing ("Signing with your Cojam wallet", Cancel) > steps (approve, then stake; only when two transactions are needed) > sending (hash, "Hide") > success (figure, rows, "Done", explorer link) or failed (red tile, the reason, "Try again"). After "Hide" the player moves on: a success confirms with a toast and the sheet stays shut; only a failure comes back, because it needs an answer. Esc closes when closing is safe; focus is trapped and returned; the page behind is `inert`; a grip drag of 80 px closes.

**Do / do not.** Do show a review sheet before anything that moves value. Do not use a sheet for an action that is reversible by Undo.

### 5.17 Podium, rank rows and the pinned own bar

**Purpose.** The weekly ranking: ranks 1 to 3 stand on a podium (ink, blue, sky: three steps of the palette, no lime), ranks 4 to 10 are plain rows with an ink outlined rank block, and the player's own position is pinned in an ink bar above the tab bar (a tap scrolls to "Around you").

```html
<div class="podium">
  <div class="pod"><span class="pod-step">1</span><span class="pod-name">dalgona</span><span class="pod-pts">1,400P</span><span class="pod-prize">385.20<small>CT</small></span></div>
  <div class="pod">…2…</div><div class="pod">…3…</div>
</div>
<ul class="list">
  <li class="krow"><span class="krow-rank">4</span><span><span class="krow-name">하늘</span><span class="krow-pts">1,300P</span></span><span class="krow-prize">128.40<small>CT</small></span></li>
</ul>
<button type="button" class="pin" id="pin"><span class="pin-rank">27</span><span class="pin-main"><b>You</b><span>100P behind the top 10</span></span><span class="pin-pts">950P<small>This week</small></span></button>
```

@@css assets/components.css :: ^\.(podium|pod|pod-step|pod-name|pod-prize|krow|krow-rank|krow-name|krow-prize|pin|pin-rank|pin-main|pin-pts|pin--act)(?![\w-])(?!.*(small|\.tag|is-void|is-me \.krow-pts|::before|\.btn))
@@css assets/screens/rank.css :: ^\.sc-rank( \.podium| \.pod| \.pod-step| \.krow-rank| \.krow\.is-me| \.krow\.is-me \.krow-rank)?$

**States.** Top 10 (own row highlighted inside the list), outside (pinned bar), unranked ("No rank yet. Finish today's 5 to get on the board." with a secondary button on ink), winner, last week being finalised, prizes sent, on hold (no rank, "On hold: no weekly prize"). Ties are explained in one line (`.tie-line`). `.pin--act` is the same pinned position used for the primary action of a form, on snow with a 16 px fade above it.

**Do / do not.** Do pin the player's own position where it is always visible. Do not use the accent for winners.

### 5.18 Stat figures

**Purpose.** Key numbers straight on the surface: a small label, then the figure in the display face. A trio of related figures is divided by 2 px ink rules (results, profile, invite).

```html
<div class="lead-fig"><h2 class="lbl">Available</h2><p class="fig">1,840.5<small>CT</small></p><p class="sub">Updated 7s ago</p></div>
<div class="tri">
  <div class="tri-c"><span class="tri-fig">950P</span><span class="tri-lbl">This week</span><span class="tri-sub">11/20 hits</span></div>
  <div class="tri-c">…</div><div class="tri-c">…</div>
</div>
```

@@css assets/components.css :: ^\.(lead-fig|fig|fig--xl|fig--md|stats|stat)(?![\w-])|^\.pid \.stat
@@css assets/screens/rank.css :: ^\.(tri|tri-c|tri-fig|tri-lbl|tri-sub)(?![\w-])
@@css assets/screens/money.css :: ^\.(mhero|wrow|wrow-go)(?![\w-])

**Do / do not.** Do let one figure be the hero of a screen (CT on the wallet at 40 px, points one step below at 32 px). Do not box figures in tiles.

### 5.19 Tags and state chips

**Purpose.** Short states and categories in the landing's chip style: an ink outline on white for a plain state, ink or sky filled for a strong one; up, warn and down keep their tint with an edge in their own colour. The edge is an inset shadow, so no chip changes size.

```html
<span class="tag">Crypto</span>
<span class="tag tag-ink">Hit</span>
<span class="tag tag-sky">Unlocked</span>
<span class="rchip rchip--wait"><svg>…</svg>Waiting, 09:00</span>
```

@@css assets/components.css :: ^\.tag(-ink|-up|-warn|-down|-sky|-line|-onink)?(?![\w-])
@@css assets/screens/rank.css :: ^\.(rchip|rchip--hit|rchip--corr|rchip--wait, \.rchip--off|rs-count)(?![\w-])

**Do / do not.** Do keep chips for real states and counts. Do not use chips as decoration or as buttons.

### 5.20 Stake position row with progress

**Purpose.** One open stake is one section under the ink rule: the amount as a figure and its state chip, a progress track in the day block language (ink while locked, sky once unlocked), the dates, the interest, and the one action when there is one.

```html
<section class="msec mstake">
  <div class="mstake-top"><div><p class="fig">1,000<small>CT</small></p><p class="sub">90 days at 13%</p></div><span class="tag"><svg>…</svg>Locked</span></div>
  <div class="mbar"><i style="width:24%"></i></div>
  <p class="mbar-meta"><span>Started Nov 6</span><b>Day 22 of 90</b><span>Unlocks Feb 4</span></p>
  <dl class="rows"><div class="is-em"><dt>Interest</dt><dd>7.4795 CT</dd></div></dl>
  <p class="mstake-gap">You can claim from 10 CT. 2.52 CT to go.</p>
</section>
```

@@css assets/screens/money.css :: ^\.(mstats|mstake|mstake-top|mbar|mbar-meta|mstake-gap|mstake-acts)(?![\w-])

**States.** Locked, unlocking (flips while you watch), claimable, unlocked (a primary "Withdraw 503.2877 CT" with the parts named under it), claim below the minimum (one line saying how much is left), on hold (the fee line under each action, off with too little KAIA).

**Do / do not.** Do state everything that leaves the stake in the button. Do not show a percentage bar without the dates that explain it.

### 5.21 Empty, loading, error and offline states, system screens

**Purpose.** Every screen has its loading skeleton, empty state, error state and offline behaviour, designed, not defaulted. Full screen system states (maintenance, update, offline, not found, account on hold) stand on the blue band.

```html
<div class="empty"><div class="empty-ic"><svg>…</svg></div><h2>No results yet</h2><p>Your picks appear here once you play.</p></div>
<span class="skel" style="width:90px;height:14px"></span>
<div class="sys"><div class="sys-ic"><svg>…</svg></div><h1>Cojam is being updated</h1><p>Predictions and payouts are paused. Your points, stakes and CT are safe on chain. We will be back shortly.</p></div>
```

@@css assets/components.css :: ^\.(skel|empty|empty-ic|sys|sys-ic)(?![\w-])(?!.*(\.btn|empty p|empty h2))

**Patterns.** Loading: skeleton bars in the shape of the real content, `aria-busy`, a hidden "Loading" status. Empty: an outlined icon tile, a heading, one sentence, and the one next action where there is one. Error: a red note that names the cause with "Try again". Offline: the offline bar, controls drawn off but still answering a tap with the reason, content kept with its last updated time. The account on hold screen lists "What still works" and "Paused while on hold" in two white outlined boxes on the band, then the contact.

**Do / do not.** Do give each state the one next step. Do not leave a spinner as the only content.

### 5.22 The install Gate

**Purpose.** The first screen of the PWA in a browser: what the product is, a live preview of the card, and how to install it on this exact device (Android, iOS Safari, iOS other browsers, in app browsers, desktop), or the invite that brought the visitor.

**Anatomy.** `.topnote` (an ink line: "Only on app.cojam.app. Cojam never asks for your seed phrase.") > `.gate` on the band: `.gate-bar` (logo chip, language select), `h1` hero in the display face at 125% width with one sky word, `.gate-lede`, `.gate-demo` (a tilted static card over a sky backing card with a rotated `.sticker` "EXAMPLE"), the install panel `.panel` headed "Get the app" (white, 2 px ink edge, large radius, card shadow) with numbered `.steps` and the install action, `.facts`, and `.gate-foot`. On iOS a sky `.ios-point` bubble with a bouncing arrow points at the browser's share button. From 900 px it becomes a two column page.

@@css assets/components.css :: ^\.(gate|gate-demo|sticker|panel|ios-point)(?![\w-])(?!.*(\.btn|:has|swap|foot|col|bar|lede|h2))

**Do / do not.** Do teach the exact install steps for the device in hand. Do not show a generic "Add to home screen" text to everyone.

---

## 6. Interaction patterns

### 6.1 The swipe deck

The deck (`App.deck` in `components.js`) follows the finger and decides on release:

- **Commit threshold:** a drag commits past **35% of the card width** (`ARM = 0.35`) however slowly it was made.
- **Fling:** a fling commits only with real travel: **96 px at 0.5 px/ms**, or **56 px at 1.1 px/ms**, always in the direction of the drag. Release speed is measured over the last 100 ms only, signed, so a pause before release or a flick back is not a fling.
- **Direction lock:** after 10 px, a drag that is more vertical than horizontal hands over to page scroll and never commits.
- **Honest preview:** below the threshold the answer stamp only hints (opacity capped at 0.4) and no button lights; at the threshold the stamp goes solid and snaps up a size, the answer button turns hot, a 20% colour wash covers the card and the phone ticks (5 ms vibration). The card never shows a pick it would not make on release.
- **Feel:** the card follows with `translate(dx, dy * 0.18)` and a rotation of up to 8 degrees. A throw leaves on its side with the speed of the release (190 to 380 ms); the next card springs forward with `--ease-spring` over 420 ms (it rises, straightens and its picture sharpens in). A release below the threshold springs back.
- **Taps and keys play the same throw.** Arrow keys pick from anywhere on the screen unless a form control, link or sheet has focus; a held key never repeats.
- **Guards:** for 400 ms after a commit a tap on an answer is dropped (a quick double tap never answers two cards); a swipe or key within 200 ms is a second deliberate pick and is queued, not lost.
- **First time teaching:** the very first card a player ever sees leans right, then left, once (1.5 s, stamps hinting at 0.4); never under reduced motion, never again.

### 6.2 Undo for 3 seconds, then send

After a pick the next card shows at once. For **3 seconds** (`UNDO_MS = 3000`) the player can press Undo (or Z or Backspace on a keyboard): the thrown card flies back in from the side it left and takes the front; the card that had advanced drops back behind it. Undo acts on the most recent pick only; an earlier pick still inside its window then takes the bar with its own time left. Without Undo, the pick is sent when its window closes. Leaving the screen inside a window sends the held picks at once, and home says "Pick saved" on return.

### 6.3 Optimistic, one action per swipe

A pick is one action: no confirmation dialog, no wallet prompt, no spinner over the card. After the undo window it is sent in the background; the progress block turns to moving stripes (pending), then lime (done). The points pill shows a spinner only while the last pick of the day is being saved. A failure comes back as a red block, a "Not saved" note on the card that returns to the front, and a toast with "Try again". Slow saving shows a slim banner ("1 pick is still being saved") with "Retry now".

### 6.4 "Finish now"

After the fifth pick, while it can still be undone, the deck area shows a 92 px ring that empties with the same 3 seconds and "Finishing in 3", with a primary "Finish now" that sends everything held and opens the day done screen at once. Without it, the day done screen opens 500 ms after the last pick is sent.

### 6.5 Press feedback

One global `pointerdown` listener adds `.is-pressed` to `.btn`, `.choice`, `.seg-btn`, `.field-max`, `.period button` and `.undo`, and keeps it for at least 90 ms so a quick tap is still seen. Secondary: scale 0.97 and sky tint in 120 ms, release with a spring over 180 ms. Primary and answers: move down onto their drop (3 px and 2 px). Tab icons scale to 0.9. All of it is transform and colour only.

### 6.6 Countdowns and live figures

Countdowns (`data-cd`) tick every second in the display face ("Closes in 09:24:36", the day done clock "Next set in"), with a screen reader text that updates once a minute, not every second. "Updated 7s ago" stamps count up with a blue live dot. Staking interest ticks to 4 decimals every second (every 10 s under reduced motion). Points count up when added and the pill pulses once.

### 6.7 Reduced motion

Under `prefers-reduced-motion: reduce` nothing moves on its own: animations stop and transitions shorten to near zero, presses do not scale, the burst on the day done screen is removed, the deck cross fades instead of throwing, and the first time nudge never plays. Countdown rings (Undo, Finish) keep running because they are information, not decoration. The admin stops skeleton pulses and spinners.

@@css assets/components.css :: ^@media \(prefers-reduced-motion: reduce\)

### 6.8 The review sheet before any value action

Anything that moves value goes through review first (5.16): the question as the title, the facts, the consequence, and a primary button that names the amount. A required checkbox unlocks the button where the consequence is serious. While the transaction runs, the button that started it is the status. Cancel is always there while waiting for the wallet. A finished transaction after "Hide" confirms with a toast; a failure reopens the sheet.

### 6.9 How disabled controls say why

- A control that is off has its reason in one line next to it (`.hold-why`, `.pin-note`, `.field-msg`), never only a grey look.
- The answers when offline are `aria-disabled` rather than `disabled`, so a tap still answers with a toast ("Connect to the internet to pick.").
- When a whole feature is off for a state (account on hold on home), the controls are removed and one empty state explains it with a link, so nothing on the screen is dead.
- A field never holds a value the primary cannot send: the error says what to change and the button stays off until it is fixed.

### 6.10 Keyboard and screen readers

Skip link; focus ring 3 px (white on blue and ink); every pick, Undo (Z, Backspace) and sheet (Esc, trapped Tab) works by keyboard; live regions announce picks ("Picked Yes. 4 left. You can undo for 3 seconds."), undo, copy and transaction titles; icons are `aria-hidden`, counts have spoken labels ("2 new answers").

---

## 7. Screen patterns

The PWA is a 430 px column; tab roots open with the band, sub pages with the back arrow header. Each paragraph describes the layout and hierarchy so a new screen can be built the same way. Screenshots of the starred screens are in the zip under `screens/`.

### 7.1 PWA

- **Home, card view (H1) \*.** One fixed composition that fits 390 x 844 and 360 x 780 without scrolling: header, band (title "Today's picks" with the Cards / List switch, then "0/5", the five progress blocks and "Closes in 09:24:36"), the deck of three cards filling the remaining height, the pick bar, the tab bar. The card is the only object with a drop. States include fresh, partial, syncing, slow, failed, reconnect, other device, loading, empty (next set countdown), closed, error, offline, on hold (the deck replaced by one explanation).
- **Home, list view (H2) \*.** The same band with the switch on List. The five questions as numbered rows (blue display numbers 01 to 05, question, category chip, thumbnail, "Pick"). The open question is the one sky tinted block with the answer source and both answer buttons; answered rows turn muted with the pick and its dot. After the fifth pick a block under a 2 px rule shows the finishing countdown.
- **Day done (H3) \*.** The band becomes the reward: a small label "All 5 done", "+100P" at 60 px that waits in quiet blue while the last pick is saved, then pops in lime with a burst of lime, sky and white pieces and settles to white, a status line ("+100P added to your points") and the five blocks full. Below: the primary "See weekly ranking", the next set countdown, then under a 2 px rule "Today's picks" with "See results", the count waiting and when the hit points land, and the five picks as rows with their answer dots.
- **Results (R1) \*.** A trio of figures divided by ink rules (this week, all time, pending), a segmented filter (All, Waiting, Set) with a legend of the result marks, then one section per day: the day heading with five small marks and an outlined total block, an invite bonus line, and question rows with the pick on the left and, always in the same place on the right, the state chip (Hit filled ink, Miss outlined, Waiting muted) and the points. Tapping a row opens the answer in place.
- **Weekly ranking (K1) \*.** A This week / Last week segmented control, the pool as a 40 px figure with "Ends in 2d 9h" opposite, "How prizes work", then under a rule "Top 10" with the live stamp, the podium standing on one ink base line, column labels, rows 4 to 10, and the player's own pinned ink bar above the tab bar.
- **Staking, new stake (S1) \*.** Tabs on the ink rule (New stake, My stakes with an outlined count), the amount field with Max and the tier cue ("1,000 CT or more earns +1%"), the four lock periods as outlined options with the chosen one lime, under a rule the interest as a figure and the lock date with "No early exit", a "How staking works" disclosure, and the primary "Stake 500 CT" pinned above the tab bar with "No fee: Cojam pays the network fee." Review opens the sheet \*.
- **My stakes (S2).** Totals (staked as the hero, interest so far and claimable now), then one section per stake (5.20) with its own action.
- **Wallet (W1) \*.** CT available as the one hero figure, the short address chip with "Updated 7s ago" opposite, Deposit and Withdraw as two secondary buttons, hairline rows for Staked (an outlined count chip that links to stakes) and KAIA (with why it matters), then under a rule Points as the second figure, the rate line, an "On the way" chip with when pending points land, the primary "Convert points", and the invite row.
- **Convert points (W2).** A sub page: the points field with steps of 1,000P, "You get 1 CT" as the figure in the spare middle space, the rules as summary rows (rate, minimum, daily limit, fee), the primary naming both amounts, and "Converting does not change your weekly rank." States cover the 7 day wait, per user and global caps, pause, and the transaction flow.
- **Deposit (W3).** The QR code with the brand mark in its centre, the full address in two grouped lines, a primary "Copy address", a live "Waiting for deposits" line, then network and token as rows with the token contract and a warning note to send only on the right network.
- **Withdraw CT (W4).** The destination field with Paste and a valid echo of the full grouped address, the amount with Max, then the facts directly above the action (your KAIA, network fee, network) and the primary "Withdraw 250 CT", with a review sheet. Errors cover a bad address, own address, a contract address and too little KAIA.
- **Profile (P1) \*.** A sub page with the avatar lime as the current selection: the display name in the display face, the trio rank / this week / points, the invite row, then under rules Account (logged in as, the address chip, explorer link, "Ready to play on this device"), "Name in the ranking" (a text field with an inline Save), preferences, help, and Log out as a text button with the version line.
- **Invite friends (I1) \*.** The band holds the offer: "10%" as a huge figure, one sentence, a sub line, and a worked example as two outlined blocks (a friend earns +350P, you get +35P). Below: the code block that copies, the link in the data face, the primary "Share invite link", a secondary "Copy link", then "How it works" with ink number blocks, my results as a trio, recent friends, and the rules.
- **Login (A1).** On the band: the display headline "Log in to play", one sentence, the login panel (the one object, with the card shadow) with the email field, the providers line, the primary "Send code", a disclosure and the terms; then three facts with sky icons. The code step swaps the headline and uses the wide code field.
- **First run (A2).** Three onboarding steps on the band: an illustration panel (white, ink edge, card shadow) that reuses product pieces (the deck, the progress blocks, a swap of points to CT), a display headline, one sentence, the optional invite code link, the language segments, the primary "Next" and a status line while the account is set up.
- **Gate (G1).** See 5.22.
- **System states (SYS).** Maintenance, update, offline, not found and account on hold, all on the band with an outlined icon tile, a display headline, one or two sentences and one action. Account on hold \* lists what still works and what is paused, then the contact. Each tab screen shows the hold notice (5.14) with the reason for that screen.

### 7.2 Admin (desktop, 1024 px and wider, English only)

- **Shell.** A fixed blue band header (logo chip, "ADMIN" in the display face, system status with a coloured dot, the network badge Mainnet or Kairos test, who is signed in and their role, Sign out) over a 2 px ink rule; a 216 px left navigation on snow divided by a 2 px ink rule, current item ink filled, real counts in outlined chips (warn and down tinted); the main column up to 1240 px with a page head (title in the display face, upper case, a sub line, "Updated 14:32:08 KST" and Refresh). Below 900 px the admin says to open it on a computer.
- **Dashboard \*.** First an alert list between two ink rules: each row is a fixed width state chip (Act now in red; Soon, Check and Review in warn; Notice outlined), one bold sentence with the detail in muted text, and a link to the screen that fixes it. When calm it is one line: "Nothing needs you right now." Then sections under ink rules: today's set as a table (slot number blocks, thumbnails, live chips, answer due, picks, split bars in coral and sky) beside players today as a 40 px figure and smaller figures divided by hairlines; then sections for players, points, reserves (meters against their caps), and invites and abuse.
- **Dense tables.** `.tbl`: 13.5 px text, muted 12.5 px headers over a 1.5 px ink line, hairline rows, right aligned tabular numbers, sortable headers with a small arrow pair, hover in mist, the selected row in sky tint with a 3 px ink bar on its left, row actions on the right as a text link plus small secondary buttons, and a footer line with the count and paging.
- **Confirmation sheets with a required note \*.** Every action that changes something opens a dialog (white, 2 px ink edge, large radius, card shadow) titled as the question ("Block 0xabde…9bac?"), with what will happen in plain words, the facts as key value rows with full addresses, a required "Note" textarea "written to the audit log" (the action stays off until the note is long enough), who signs it, then Cancel as a text link and the action button: lime primary, or the red destructive look for block, void, cancel and discard.
- **Drawers.** Detail views (a player, a question) open as a 640 px drawer from the right with a 2 px ink rule on its edge, a head with state chip, actions and a close button, and sections divided by ink rules.
- **Status chips.** One mapping from state to chip everywhere: Live and Ready ink filled; Answer set, Healthy, Sent, Cleared green; Late, Slow, Review, Fallback warn; Cancelled, Failing, Blocked, Failed red; Corrected and Sending sky; Draft, Closed, Waiting, Off muted outline.
- **Other admin screens:** Reward settings (a parameter table with current and new values, changed inputs ink edged on sky tint, a sticky save bar), Questions (a 14 day calendar strip with five pips per day, an editor with EN, KO and JA columns and a live card crop preview at two widths), Answers, Ranking and airdrop, System (jobs, reserves, logs), Players (review list with risk score bars, blocked accounts, invite clusters), Sign in (the band with the login panel).

@@css admin/admin.css :: ^\.(top|side|alerts|dlg|drawer)$|^\.nav a(\[aria-current="page"\])?$|^\.alerts li|^\.tbl( th| td| \.num| tbody tr:hover td| tbody tr\[aria-selected="true"\] td(:first-child)?)?$

---

## 8. The review method that produced it

### 8.1 The loop

Every round: **build, capture, look, score, fix.**

1. **Capture** each screen with Playwright at the phone sizes **390 x 844 and 360 x 780** (and 430 for the widest phone), device scale 2, touch on, in EN and KO, plus JA at 390 when copy changed, with animations settled (wait for `document.fonts.ready`, then for the screen's own motion). The admin at 1440 x 900. Look at every capture at full size yourself before anyone scores it.
2. **Audit** each screen with a script (8.2).
3. **Independent score** by a separate reviewer that did not build the screen, actually using the page by touch, mouse and keyboard at both sizes. It writes a Markdown and a JSON file with the scores, the evidence for each, and the top five fixes ranked, each naming the element, the problem and the change.
4. **Fix** the top items and rescore. At most four render and fix rounds per screen. **Targets: 85 or more of 100 for design, 34 or more of 40 for usability.**

### 8.2 The two scorecards

**Design, 10 criteria, 10 points each (100):** Hierarchy, Layout, Spacing, Type, Colour, Consistency, Density, Copy, Mobile, Finish.

**Usability, Nielsen's 10 heuristics, 4 points each (40):** Visibility of system status, Match with the real world, User control and freedom, Consistency and standards, Error prevention, Recognition rather than recall, Flexibility and efficiency, Aesthetic and minimal design, Help users recover from errors, Help and documentation.

Example of a real finding that moved the design: the first review of the home screen scored usability 23 of 40 because two taps 120 ms apart answered two questions, a held arrow key answered all five, and picks were final. The fixes became the tap and key guards, the 3 second Undo and the honest drag preview of section 6.1.

### 8.3 The audit checks

A Playwright script renders the page at the target size and reports, for every visible element: **text contrast under 4.5:1** (composited over the real background stack and any opacity), **touch targets under 44 px tall** (links, buttons, inputs, selects, tabs), **horizontal overflow** of the document at **360, 390 and 430** px, **where the accent colour is used** (every lime fill, text and border, which must be only the primary action, the current selection, day progress and the reward), and **monospace misuse** (the data face on words or display sizes). The script is a helper, not the judge. A copy is in the zip at `tools/audit.js`.

### 8.4 Lessons learned

- **Flattening everything lost the brand's character.** Round 4 replaced stacked bordered cards with flat sections and hairlines. Clutter went, usability rose above target, but design stalled at 82: a stock segmented control (white thumb, soft shadow, grey track), grey filled buttons and hairlines made the wallet, results and profile look like any app. Round 5 kept the flat structure and brought back the line language with discipline (2 px ink rules between sections, ink outlined chips and number blocks for real counts, the ink segmented control, three button looks).
- **Quiet screens need the ink line language.** The header band and the deck carry the brand on home; every other screen needs the lines, the display figures and the outlined blocks to be recognisably the same product below the header.
- **One notice component for one state everywhere.** "Account on hold" first appeared as different banners on different screens. One `C.hold` notice with the same title, the reason for that screen and the same link fixed it, and controls that are off now say why in one line.
- **Keep the accent's jobs few.** One early day done screen had seven lime objects in one viewport and the primary action no longer stood out. Lime now has four jobs, and the reward figure settles to white after its moment.
- **Never let the preview promise what the release will not do.** The drag stamp at full strength at 30% when the commit needed 35% read as a broken promise; the stamp now hints at 0.4 below the threshold.
- **No text in pictures.** Labels baked into the art collided with the question, chips and buttons in three languages. Pictures now carry no text and keep the subject in the top 45%.
- **Start from scratch, keep the colours.** In an earlier project restyling an old layout capped scores near 79; a fresh build with the same palette scored higher on the first try.
- **Shared shell, shared builders.** One header, one tab bar, one sheet and one set of component builders injected on every page stopped visible drift between screens.

---

## 9. Language and copy (i18n)

- **English is the source text.** The app ships an EN / KO / JA switch (`?lang=en|ko|ja` for review links, then the saved choice; the device language is never read). Each entry in `assets/i18n.js` is `[en, ko, ja]` side by side so a reviewer can compare the three voices; `t(key, vars)` fills placeholders like `{n}`.
- **Korean and Japanese are written natively, not translated literally.** Fixed terms per language keep the product vocabulary stable (KO: 예측, 선택, 적중, 포인트, 전환, 스테이킹, 입금, 출금; JA: 予想, 的中, ポイント, 交換, ステーク, 入金, 出金).
- **Type per language.** Pretendard for EN and KO, Pretendard JP for JA (switched by `:lang(ja)` on the token), Archivo for display figures and Latin titles. Hangul and kana titles have no wide cut, so on the band they go to the heaviest weight, about 2 px larger, tighter, with a 0.35 px text stroke.
- **Line breaking.** Korean `word-break: keep-all`; Japanese `word-break: auto-phrase` and `line-break: strict`; `text-wrap: balance` on captions and short notes, `pretty` on paragraphs.
- **Length limits on cards.** Questions are written to stay under about 70 characters. The card title is clamped to 3 lines and steps down a size when it is long: more than 44 characters in Latin script, or more than 22 in Hangul, kana or CJK. Meta lines clamp to 2 lines; the card footnote stays on one line at 360 px in every language. Band titles must fit one line at 360 px ("ALL 5 DONE", not "TODAY'S 5 PREDICTIONS DONE").
- **Question text is not in the dictionary.** Title, answers and answer source are authored per language with the question and come from the server.
- **Numbers and money.** Figures use `en-US` grouping in every language; dates use `Intl.DateTimeFormat` in the chosen language. Fiat (KRW) lines appear in Korean only.
- **Check every language at the narrowest width.** The audit and captures run in EN and KO at 360 and 390, and JA at 390.

---

## 10. What is in the zip

```text
README.md            this guide
HOW-TO-PREVIEW.md    how to run the design locally
design/              the runnable design (static, mock data only)
  index.html         PWA hub: every screen and state, one tap each, with an EN / KO / JA switch
  components.html    component library: tokens and every component with its variants
  *.html             17 PWA screens (gate, login, first-run, home-cards, home-terminal, done, results, ranking,
                     staking, stakes, wallet, convert, deposit, withdraw, profile, invite, system)
  ROUND5.md          the final design brief
  assets/            tokens.css, components.css, components.js, i18n.js, mock.js, screens/*.css, img/, cojam-mark.svg
  admin/             hub.html, index.html (dashboard) and 7 more screens, admin.css, admin.js, data.js, pages/*.js
screens/             fresh screenshots: PWA at 390 x 844 in EN, admin at 1440 x 900
tools/audit.js       the audit script of section 8.3
```

Screens take `?state=<name>` for any state listed in the hubs and `?lang=en|ko|ja`. The Cojam name, mark, question pictures and copy are examples to replace, not assets to reuse.
