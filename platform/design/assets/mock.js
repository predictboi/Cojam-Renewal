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
    /* Questions arrive from the server already written in the three languages (title, two choices, answer rule):
       each language is authored on its own, not translated word for word, so choices may differ in wording.
       `settle` is the settle time as the server phrases it for that language. The app shows the object for the chosen language (App.q). */
    questions: {
      q1: { n: 1, img: "assets/img/q1-bitcoin.svg", cat: "crypto",
        en: { title: "Will Bitcoin close above $100,000 today?", left: "No", right: "Yes", rule: "Binance BTC/USDT daily close, 00:00 UTC", settle: "09:00 tomorrow" },
        ko: { title: "비트코인, 오늘 10만 달러 위에서 마감할까요?", left: "아니요", right: "예", rule: "바이낸스 BTC/USDT 일봉 종가 (오전 9시)", settle: "내일 오전 9시" },
        ja: { title: "ビットコイン、今日の終値は10万ドルを超える？", left: "超えない", right: "超える", rule: "Binance BTC/USDTの日足終値（午前9時）", settle: "明日の午前9時" } },
      q2: { n: 2, img: "assets/img/q2-dollar-won.svg", cat: "markets",
        en: { title: "Will the dollar end today above 1,400 won?", left: "No", right: "Yes", rule: "Seoul FX market close, 15:30 KST", settle: "16:00 today" },
        ko: { title: "오늘 원/달러 환율, 1,400원 위에서 끝날까요?", left: "아니요", right: "예", rule: "서울 외환시장 종가 (오후 3시 30분)", settle: "오늘 오후 4시" },
        ja: { title: "今日のドル/ウォン、終値は1,400ウォンを上回る？", left: "上回らない", right: "上回る", rule: "ソウル外国為替市場の終値（15時30分）", settle: "今日の16時" } },
      q3: { n: 3, img: "assets/img/q3-seoul-weather.svg", cat: "weather",
        en: { title: "Will Seoul reach 10°C or higher tomorrow?", left: "No", right: "Yes", rule: "KMA Seoul station, daily high", settle: "18:00 tomorrow" },
        ko: { title: "내일 서울 낮 기온, 10도까지 오를까요?", left: "아니요", right: "예", rule: "기상청 서울 관측소 일 최고기온", settle: "내일 오후 6시" },
        ja: { title: "明日のソウル、最高気温は10℃に届く？", left: "届かない", right: "届く", rule: "韓国気象庁ソウル観測所の日最高気温", settle: "明日の18時" } },
      q4: { n: 4, img: "assets/img/q4-football.svg", cat: "sports",
        en: { title: "Tonight's Premier League match: 3 goals or more?", left: "2 or fewer", right: "3 or more", rule: "Total goals at full time", settle: "07:00 tomorrow" },
        ko: { title: "오늘 밤 프리미어리그 경기, 3골 이상 나올까요?", left: "2골 이하", right: "3골 이상", rule: "정규 시간 90분 기준 합계 득점", settle: "내일 오전 7시" },
        ja: { title: "今夜のプレミアリーグ、合計3点以上入る？", left: "2点以下", right: "3点以上", rule: "90分終了時の合計得点", settle: "明日の午前7時" } },
      q5: { n: 5, img: "assets/img/q5-kaia.svg", cat: "crypto",
        en: { title: "Will KAIA be higher at 09:00 tomorrow than now?", left: "Lower", right: "Higher", rule: "Binance KAIA/USDT price at 09:00 KST", settle: "09:00 tomorrow" },
        ko: { title: "내일 오전 9시, KAIA는 지금보다 올라 있을까요?", left: "내린다", right: "오른다", rule: "바이낸스 KAIA/USDT 오전 9시 가격", settle: "내일 오전 9시" },
        ja: { title: "明日の朝9時、KAIAは今より上がっている？", left: "下がる", right: "上がる", rule: "Binance KAIA/USDTの午前9時の価格", settle: "明日の午前9時" } },
      /* earlier days, shown on Results */
      p1: { cat: "crypto",
        en: { title: "Will Ethereum close above $3,500 today?", left: "No", right: "Yes" },
        ko: { title: "이더리움, 오늘 3,500달러 위에서 마감할까요?", left: "아니요", right: "예" },
        ja: { title: "イーサリアム、今日の終値は3,500ドルを超える？", left: "超えない", right: "超える" } },
      p2: { cat: "markets",
        en: { title: "Will the KOSPI close higher than yesterday?", left: "No", right: "Yes" },
        ko: { title: "오늘 코스피, 어제보다 높게 마감할까요?", left: "아니요", right: "예" },
        ja: { title: "今日のKOSPI、終値は前日を上回る？", left: "上回らない", right: "上回る" } },
      p3: { cat: "weather",
        en: { title: "Will it rain in Tokyo tomorrow?", left: "No", right: "Yes" },
        ko: { title: "내일 도쿄에 비가 올까요?", left: "아니요", right: "예" },
        ja: { title: "明日、東京で雨は降る？", left: "降らない", right: "降る" } },
      p4: { cat: "sports",
        en: { title: "Will the home team win tonight's V-League match?", left: "No", right: "Yes" },
        ko: { title: "오늘 밤 V리그, 홈팀이 이길까요?", left: "아니요", right: "예" },
        ja: { title: "今夜のVリーグ、ホームチームは勝つ？", left: "勝たない", right: "勝つ" } },
      p5: { cat: "culture",
        en: { title: "Will this week's box office No. 1 change?", left: "No", right: "Yes" },
        ko: { title: "이번 주 박스오피스 1위, 바뀔까요?", left: "아니요", right: "예" },
        ja: { title: "今週の映画ランキング、1位は入れ替わる？", left: "変わらない", right: "入れ替わる" } },
      p6: { cat: "markets",
        en: { title: "Will gold close above $2,700 today?", left: "No", right: "Yes" },
        ko: { title: "오늘 금값, 2,700달러 위에서 마감할까요?", left: "아니요", right: "예" },
        ja: { title: "今日の金価格、終値は2,700ドルを超える？", left: "超えない", right: "超える" } },
      p7: { cat: "markets",
        en: { title: "Will the Nikkei 225 close above 40,000?", left: "No", right: "Yes" },
        ko: { title: "닛케이 225, 4만 선 위에서 마감할까요?", left: "아니요", right: "예" },
        ja: { title: "日経平均、終値は4万円を超える？", left: "超えない", right: "超える" } }
    },
    set: ["q1", "q2", "q3", "q4", "q5"],
    untilNextSet: untilNextSet, untilWeekEnd: untilWeekEnd,
    rates: { 30: [8, 9, 10], 90: [12, 13, 14], 180: [18, 19, 20], 365: [25, 26, 27] },
    minStake: 100, minClaim: 10, fee: 0.0021,
    pool: { players: 1284, ct: 1284, split: [30, 20, 15, 10, 7, 5, 4, 3, 3, 3] },
    /* A day pays at most 350P (100P for the set plus 5 hits x 50P), so four days in, the leader has at most 1,400P.
       Equal points are ordered by who reached the total first: every rank is distinct and no prize is split. */
    ranking: [
      { rank: 1, name: "dalgona", pts: 1400, prize: 385.2 },
      { rank: 2, name: "0x4f2a…91bc", pts: 1350, prize: 256.8 },
      { rank: 3, name: "yuki.m", pts: 1300, prize: 192.6 },
      { rank: 4, name: "하늘", pts: 1300, prize: 128.4 },
      { rank: 5, name: "kaia_whale", pts: 1250, prize: 89.88 },
      { rank: 6, name: "0x9c1e…77d0", pts: 1200, prize: 64.2 },
      { rank: 7, name: "noodle", pts: 1150, prize: 51.36 },
      { rank: 8, name: "みさき", pts: 1100, prize: 38.52 },
      { rank: 9, name: "jay.park", pts: 1100, prize: 38.52 },
      { rank: 10, name: "0x03bd…e41a", pts: 1050, prize: 38.52 }
    ],
    around: [
      { rank: 25, name: "0x77aa…c2d1", pts: 1000 },
      { rank: 26, name: "sora", pts: 950 },
      { rank: 27, name: "minji", pts: 950, me: true },
      { rank: 28, name: "bongbong", pts: 900 },
      { rank: 29, name: "0x1e09…4b7f", pts: 900 }
    ],
    me: { rank: 27, pts: 950, gap: 100 },
    stakes: [
      { id: "a", amount: 1000, days: 90, rate: 13, start: ago(21) },
      { id: "b", amount: 500, days: 30, rate: 8, start: ago(31) }
    ],
    stakeBig: { id: "d", amount: 12000, days: 180, rate: 20, start: ago(40) },
    stakesClosed: [{ id: "c", amount: 300, days: 30, rate: 8, start: ago(64), paid: 301.97 }],
    week: { pts: 950, hits: 11, answered: 20, days: 4 }   /* 4 x 100P + 11 x 50P */,
    all: { pts: 9850, rate: 58 },
    results: [
      { day: 0, done: true, total: 100, pending: 50, rows: [
        { q: "q2", c: "r", out: "pend", at: "22:10" },
        { q: "q1", c: "r", out: "wait", exp: "09:00" },
        { q: "q3", c: "l", out: "wait", exp: "18:00" },
        { q: "q4", c: "r", out: "wait", exp: "07:00" },
        { q: "q5", c: "r", out: "wait", exp: "09:00" }
      ] },
      { day: 1, done: true, total: 250, rows: [
        { q: "p1", c: "r", out: "hit" },
        { q: "p2", c: "l", out: "miss" },
        { q: "p3", c: "r", out: "hit" },
        { q: "p4", c: "r", out: "corr" },
        { q: "p5", c: "l", out: "miss" }
      ] },
      { day: 2, done: false, answered: 3, total: 50, rows: [
        { q: "p6", c: "r", out: "hit" },
        { q: "p7", c: "l", out: "miss" },
        { q: "p3", c: "r", out: "void" },
        { q: "p1", c: null, out: "none" },
        { q: "p4", c: null, out: "none" }
      ] }
    ],
    contracts: ["0x91cb3b346c80ff965a9667ba6228834dbedd71a2", "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b", "0x7879f0a137eae8e45eb670e9ac7bb08c5dfadb84"],
    ago: ago, ahead: ahead
  };
})();
