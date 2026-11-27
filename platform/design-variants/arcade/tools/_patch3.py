# Adapts the scripted motion run to this concept (names of the flows and the mid animation frames).
import re
p = 'tools/motion-run.js'
s = open(p, encoding='utf8').read()
a = s.index('async function stills(b) {'); b = s.index('// frame intervals while')
s = s[:a] + '''async function stills(b) {
  await still(b, 'frame-01-sticker-growing-ko', 'ko', 'home.html?state=fresh', 60, async pg => { await down(pg, 195, 330); await glide(pg, 195, 270, 330, 200); });
  await still(b, 'frame-02-sticker-slapped-ko', 'ko', 'home.html?state=fresh', 90, async pg => { await down(pg, 195, 330); await glide(pg, 195, 345, 330, 260); });
  await still(b, 'frame-03-tap-sticker-throw-ko', 'ko', 'home.html?state=fresh', 260, async pg => { await pg.locator('.qcard[data-pos="0"] .choice[data-dir="l"]').tap(); });
  await still(b, 'frame-04-undo-flying-back-ko', 'ko', 'home.html?state=fresh', 110, async pg => { await swipe(pg, 1, { ms: 260 }); await sleep(pg, 700); await pg.locator('#undo').tap(); });
  await still(b, 'frame-05-undo-fuse-ko', 'ko', 'home.html?state=fresh', 1300, async pg => { await swipe(pg, 1, { ms: 260 }); });
  await still(b, 'reward-1-capsule-drops-ko', 'ko', 'done.html?state=moment', 260);
  await still(b, 'reward-2-capsule-wobbles-ko', 'ko', 'done.html?state=moment', 720);
  await still(b, 'reward-3-lid-flies-jam-jumps-ko', 'ko', 'done.html?state=moment', 1080);
  await still(b, 'reward-4-coin-sticker-slapped-ko', 'ko', 'done.html?state=moment', 1290);
  await still(b, 'reward-5-fifth-sticker-and-paid-ko', 'ko', 'done.html?state=moment', 1560);
  await still(b, 'reward-6-settled-ko', 'ko', 'done.html?state=moment', 3200);
  await still(b, 'reward-4-coin-sticker-slapped-en', 'en', 'done.html?state=moment', 1290);
  await still(b, 'frame-10-results-stickers-landing-ko', 'ko', 'results.html', 330);
  await still(b, 'frame-12-ranking-podium-rising-ko', 'ko', 'ranking.html', 420);
  await still(b, 'frame-13-ranking-avatars-dropping-ko', 'ko', 'ranking.html', 700);
  await still(b, 'frame-14-staking-review-rising-ko', 'ko', 'staking.html', 140, async pg => { await pg.locator('#go').tap(); });
  await still(b, 'frame-15-staking-success-sticker-ko', 'ko', 'staking.html?state=success', 1060);
}

''' + s[b:]
for x, y in [
 ("'a-swipe-stamp-undo-ko'", "'a-swipe-sticker-undo-ko'"),
 ("'b-five-picks-extra-edition-' + lang", "'b-five-picks-capsule-reward-' + lang"),
 ("'c-results-stamps-ko'", "'c-results-stickers-ko'"),
 ("'d-ranking-setting-page-turn-ko'", "'d-ranking-podium-ko'"),
 (".qimg .ht, .qtint, .qstamp, .deck-lift", ".qtint, .qstamp, .deck-lift, .qcard"),
]:
    assert x in s, x
    s = s.replace(x, y)
open(p, 'w', encoding='utf8').write(s)
print('ok')
