# Polyquest 3 minute Korean intro and demo video: shared brief

Root: `V=/tmp/claude-0/-home-claude/691c9df2-07d9-5485-b8b7-f9f339a11b7a/scratchpad/vid3`
Design prototypes (the screens the developer built into staging): `P=/tmp/claude-0/-home-claude/691c9df2-07d9-5485-b8b7-f9f339a11b7a/scratchpad/export/unslop-review`, files `$P/home/original.html`, `$P/market/original.html`, `$P/mypage/original.html` (each 3 MB, base64 fonts and images inline). NEVER Read `original.html` with the Read tool (multi megabyte lines). Read or grep `$P/<page>/lite.html` (same file with base64 stripped) to understand markup, ids and scripts. Never edit the originals: copy them into your own folder if you need changes, or inject CSS/JS at capture time.

## The film
- Vertical 9:16, 1080x1920, 30 fps, about 182 s. Audience: people who have never used a prediction market and never used Polyquest. Tone: marketing, upbeat, confident (this is an upsell piece). Korean subtitles (and a second version with Korean narration). UI copy stays English like the product.
- Script and timing: `$V/script.json` (lines) and `$V/timeline.json` (scene start/duration in seconds, subtitle windows per line, relative to the scene start). Timing is an estimate now; it is recomputed by `$V/plan.py` when the narration file arrives, so code must read durations from `timeline.json`, never hard code them.
- Scenes: hook (motion), explain (motion), login, deposit, browse, trade, swap, polymarket, mypage (all demo = screen recording of the prototypes), outro (motion).

## Frame layout (all scenes)
- Background: graphite `#0c0d10` with a very soft lime glow and fine grain; lime `#7ce85c` is the only accent. Font: Pretendard Variable (`$P/fonts/` or `$V/../export/pq-intro/public/PretendardVariable.woff2`). Logo: `$V/../export/pq-intro/public/mark.svg` and `wordmark.svg` (the shape inside the lime tile is WHITE, never black).
- Demo scenes: top band y 0 to 318 holds a small lime chip with the step ("01 로그인") at y about 120 and a bold headline (Pretendard 800, about 64 px, white) at y about 190. The recorded phone screen sits in a rounded rectangle (radius 44, 1 px border rgba(255,255,255,.10), soft shadow) at x 111, y 318, size 858x1408. Subtitles live in the band y 1740 to 1900.
- Subtitles: Pretendard 700, 46 px, line height 1.35, white, centred, max two lines (the text already contains the line break), on a dark pill rgba(0,0,0,.55) with 18 px x 30 px padding, fade 6 frames in and out. Each subtitle shows for its window in `timeline.json` (min 2.5 s).

## Product truth (do not contradict)
- Polyquest: prediction markets on Solana. Two market kinds: Originals (made by creators, AMM pool, pay with any Solana token) and Polymarket markets (order book, paid in pUSD). Market tags in UI are AMM / CLOB.
- Login: email, Telegram, X, or a Solana wallet (Mobile Wallet Adapter, Solflare, WalletConnect, Open in Phantom, Open in OKX Wallet, Open in Solflare). Email login creates a Solana wallet automatically. Self custodial: Polyquest never holds user funds. Deposit by QR or copy address.
- Any token: pay with SOL, BONK, USDT, memecoins; Polyquest swaps in one click. DO NOT show or say "Jupiter" anywhere (hide or rewrite any Jupiter text in the UI at capture time).
- Polymarket: one click creates the Polymarket wallet and account (the "Set up Polymarket" flow on My page, status becomes Ready), then Solana assets move in with one click (Deposit) and the user trades Polymarket markets in pUSD.
- A share pays 1.00 if its outcome wins. Settled markets never show the winner as 100%: show the closing price with a Won tag and the payout per share separately.
- Brand is "Polyquest". Never write dash punctuation (" - " or " — ") in any on screen text.

## Clip contract (screen recordings)
- One file per demo scene: `$V/clips/<scene>.mp4`, exactly 858x1408, 30 fps constant, H.264 yuv420p, `-crf 18 -preset veryfast`, no audio. Length: the scene `dur` from `timeline.json` minus 0.3 s (if shorter, the last frame is held; never longer).
- Record the real prototype pages in Chromium at viewport 390x640, deviceScaleFactor 2.2, mobile + touch emulation, so frames are 858x1408 and crisp. Recommended: CDP `Page.startScreencast` (format jpeg, quality 92, maxWidth 858, maxHeight 1408, everyNthFrame 1), keep each frame with its timestamp, then build constant frame rate video with the ffmpeg concat demuxer using per frame durations. Do not use Playwright recordVideo (1 Mbit VP8, soft text).
- Show touches: inject an in page tap indicator (a 44 px white ring with a lime core that scales in and fades over 450 ms) at every tap, plus smooth scrolling (no jumps) and human paced typing (about 90 ms per character).
- Write `$V/clips/<scene>.events.json`: `[{"t": seconds, "type": "tap"|"type"|"scroll"|"success", "label": "..."}]` so the mixer can add UI sounds.
- Pace actions so they line up with the subtitle windows in `timeline.json` for that scene (each line describes what is on screen at that moment). Leave the first 0.5 s calm.
- Look at sample frames (extract with ffmpeg, view with Read) and fix anything broken: overlapping UI, wrong state, empty images, Jupiter text, scroll jumps.

## Working rules
- Work only inside your own folder named in your task, plus the output paths named there. Shell cwd resets between calls: use absolute paths.
- Chromium: `require('playwright')` works from any directory; do not install browsers. Remotion renders need `--browser-executable=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.
- Do not spawn agents. Do not reach the network except npm/pip registries. Finish with a short report: files written, lengths, anything you could not do.
