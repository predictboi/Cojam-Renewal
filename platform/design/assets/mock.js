/* Mock data for the static design. No chain or network calls anywhere: every figure on every screen comes from here. */
(function () {
  "use strict";
  var DAY = 86400000, now = Date.now();
  function ago(d) { return new Date(now - d * DAY); }
  function ahead(d) { return new Date(now + d * DAY); }
  // seconds until the next 09:00 KST (00:00 UTC): the daily set boundary
  function untilNextSet() { var n = new Date(); var next = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 0, 0, 0); return Math.max(1, Math.round((next - n.getTime()) / 1000)); }
  // seconds until Monday 09:00 KST: the weekly boundary
  function untilWeekEnd() { var n = new Date(); var dow = n.getUTCDay(); var add = (8 - dow) % 7 || 7; var next = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + add, 0, 0, 0); return Math.round((next - n.getTime()) / 1000); }

  window.MOCK = {
    version: "1.0.3",
    krwPerCt: 195,
    token: "0x91cb3B346C80ff965a9667ba6228834dbedD71a2",
    oldToken: "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b",
    appUrl: "https://app.cojam.app/",
    qrUrl: "https://app.cojam.app/?src=qr",
    user: {
      name: "minji", email: "minji@naver.com",
      address: "0x7A3fC2b91E5d4086aB17c93D5E0f6A2948bD1C7e",
      points: 1250, pendingHit: 50, ct: 1840.5, staked: 1500, kaia: 2.4,
      firstConvert: ahead(3.4)
    },
    providerNames: "Gmail, Naver, Kakao, Daum, Hanmail, iCloud, Outlook, Hotmail, Yahoo! JAPAN",
    emailProviders: ["gmail.com", "naver.com", "kakao.com", "daum.net", "hanmail.net", "icloud.com", "outlook.com", "hotmail.com", "yahoo.co.jp"],
    set: [
      { n: 1, id: "q1", img: "assets/img/q1-bitcoin.svg", cat: "crypto" },
      { n: 2, id: "q2", img: "assets/img/q2-dollar-won.svg", cat: "markets" },
      { n: 3, id: "q3", img: "assets/img/q3-seoul-weather.svg", cat: "weather" },
      { n: 4, id: "q4", img: "assets/img/q4-football.svg", cat: "sports" },
      { n: 5, id: "q5", img: "assets/img/q5-kaia.svg", cat: "crypto" }
    ],
    untilNextSet: untilNextSet, untilWeekEnd: untilWeekEnd,
    rates: { 30: [8, 9, 10], 90: [12, 13, 14], 180: [18, 19, 20], 365: [25, 26, 27] },
    minStake: 100, minClaim: 10, fee: 0.0021,
    pool: { players: 1284, ct: 1284, split: [30, 20, 15, 10, 7, 5, 4, 3, 3, 3] },
    ranking: [
      { rank: 1, name: "dalgona", pts: 2450, prize: 385.2 },
      { rank: 2, name: "0x4f2a…91bc", pts: 2400, prize: 256.8 },
      { rank: 3, name: "yuki.m", pts: 2350, prize: 192.6, tied: true },
      { rank: 4, name: "하늘", pts: 2350, prize: 128.4, tied: true },
      { rank: 5, name: "kaia_whale", pts: 2300, prize: 89.88 },
      { rank: 6, name: "0x9c1e…77d0", pts: 2250, prize: 64.2 },
      { rank: 7, name: "noodle", pts: 2200, prize: 51.36 },
      { rank: 8, name: "みさき", pts: 2150, prize: 38.52, tied: true },
      { rank: 9, name: "jay.park", pts: 2150, prize: 38.52, tied: true },
      { rank: 10, name: "0x03bd…e41a", pts: 2100, prize: 38.52 }
    ],
    me: { rank: 27, pts: 1350, gap: 750 },
    stakes: [
      { id: "a", amount: 1000, days: 90, rate: 13, start: ago(21) },
      { id: "b", amount: 500, days: 30, rate: 8, start: ago(31) }
    ],
    stakeBig: { id: "d", amount: 12000, days: 180, rate: 20, start: ago(40) },
    stakesClosed: [{ id: "c", amount: 300, days: 30, rate: 8, start: ago(64), paid: 301.97 }],
    week: { pts: 1350, hits: 11, answered: 20, days: 4 },
    all: { pts: 9850, rate: 58 },
    results: [
      { day: 0, done: true, total: 100, pending: 50, rows: [
        { q: "q2.q", cat: "markets", c: "yes", out: "pend", at: "22:10" },
        { q: "q1.q", cat: "crypto", c: "yes", out: "wait", exp: "09:00" },
        { q: "q3.q", cat: "weather", c: "no", out: "wait", exp: "18:00" },
        { q: "q4.q", cat: "sports", c: "q4.r", out: "wait", exp: "07:00" },
        { q: "q5.q", cat: "crypto", c: "q5.r", out: "wait", exp: "09:00" }
      ] },
      { day: 1, done: true, total: 250, rows: [
        { q: "p1.q", cat: "crypto", c: "yes", out: "hit" },
        { q: "p2.q", cat: "markets", c: "no", out: "miss" },
        { q: "p3.q", cat: "weather", c: "yes", out: "hit" },
        { q: "p4.q", cat: "sports", c: "yes", out: "corr" },
        { q: "p5.q", cat: "culture", c: "no", out: "miss" }
      ] },
      { day: 2, done: false, answered: 3, total: 50, rows: [
        { q: "p6.q", cat: "markets", c: "yes", out: "hit" },
        { q: "p7.q", cat: "markets", c: "no", out: "miss" },
        { q: "p3.q", cat: "weather", c: "yes", out: "void" },
        { q: "p1.q", cat: "crypto", c: null, out: "none" },
        { q: "p4.q", cat: "sports", c: null, out: "none" }
      ] }
    ],
    contracts: ["0x91cb3b346c80ff965a9667ba6228834dbedd71a2", "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b", "0x7879f0a137eae8e45eb670e9ac7bb08c5dfadb84"],
    ago: ago, ahead: ahead
  };
})();
