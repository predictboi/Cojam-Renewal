/* Mock data for the static design (copied from platform/design/assets/mock.js; the example questions and the results rows were replaced, see below). No chain or network calls anywhere: every figure on every screen comes from here. */
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
      address: "0x7A3Fc2b91E5D4086AB17c93D5E0f6a2948bd1C7e",
      points: 1250, pendingHit: 50, ct: 1840.5, staked: 1500, kaia: 2.4,
      firstConvert: ahead(3.4),
      signedUp: ago(3.2 / 24)   /* used by the profile states code-*: an invite code can be added for 24 hours after sign up */
    },
    providerNames: "Gmail, Naver, Kakao, Daum, Hanmail, iCloud, Outlook, Hotmail, Yahoo! JAPAN",
    emailProviders: ["gmail.com", "naver.com", "kakao.com", "daum.net", "hanmail.net", "icloud.com", "outlook.com", "hotmail.com", "yahoo.co.jp"],
    /* Questions arrive from the server already written in the three languages (title, two choices, answer rule):
       each language is authored on its own, not translated word for word, so choices may differ in wording.
       `settle` is the settle time as the server phrases it for that language. The app shows the object for the chosen language (App.q). */
    /* Example questions, the compliant sets of platform/shared/src/devQuestions.ts (DEV_TODAY, DEV_YESTERDAY, DEV_EARLIER).
       Rule: every question of a day closes at the day's end (09:00 KST the next day) and its outcome becomes known only after that close,
       so each text asks about the day after the set opens. Authored per language, not translated word for word. */
    questions: {
      q1: { n: 1, img: "assets/img/q1-bitcoin.svg", cat: "crypto", focus: "50% 14%",
        en: { title: "Will Bitcoin be above $100,000 at 21:00 tomorrow?", left: "No", right: "Yes", rule: "Binance BTC/USDT price at 21:00 KST", settle: "21:00 tomorrow" },
        ko: { title: "내일 밤 9시, 비트코인은 10만 달러 위에 있을까요?", left: "아니요", right: "예", rule: "바이낸스 BTC/USDT 오후 9시 가격", settle: "내일 오후 9시" },
        ja: { title: "明日の21時、ビットコインは10万ドルを超えている？", left: "超えない", right: "超える", rule: "Binance BTC/USDTの21時の価格", settle: "明日の21時" } },
      q2: { n: 2, img: "assets/img/q2-dollar-won.svg", cat: "markets", focus: "42% 10%",
        en: { title: "Will the dollar end tomorrow above 1,400 won?", left: "No", right: "Yes", rule: "Seoul FX market close, 15:30 KST", settle: "16:00 tomorrow" },
        ko: { title: "내일 원/달러 환율, 1,400원 위에서 끝날까요?", left: "아니요", right: "예", rule: "서울 외환시장 종가 (오후 3시 30분)", settle: "내일 오후 4시" },
        ja: { title: "明日のドル/ウォン、終値は1,400ウォンを上回る？", left: "上回らない", right: "上回る", rule: "ソウル外国為替市場の終値（15時30分）", settle: "明日の16時" } },
      q3: { n: 3, img: "assets/img/q3-seoul-weather.svg", cat: "weather", focus: "50% 8%",
        en: { title: "Will Seoul reach 10°C or higher tomorrow?", left: "No", right: "Yes", rule: "KMA Seoul station, daily high", settle: "18:00 tomorrow" },
        ko: { title: "내일 서울 낮 기온, 10도까지 오를까요?", left: "아니요", right: "예", rule: "기상청 서울 관측소 일 최고기온", settle: "내일 오후 6시" },
        ja: { title: "明日のソウル、最高気温は10℃に届く？", left: "届かない", right: "届く", rule: "韓国気象庁ソウル観測所の日最高気温", settle: "明日の18時" } },
      q4: { n: 4, img: "assets/img/q4-football.svg", cat: "sports", focus: "50% 20%",
        en: { title: "Tomorrow night's Premier League match: 3 goals or more?", left: "2 or fewer", right: "3 or more", rule: "Total goals at full time", settle: "07:00 in two days" },
        ko: { title: "내일 밤 프리미어리그 경기, 3골 이상 나올까요?", left: "2골 이하", right: "3골 이상", rule: "정규 시간 90분 기준 합계 득점", settle: "모레 오전 7시" },
        ja: { title: "明日夜のプレミアリーグ、合計3点以上入る？", left: "2点以下", right: "3点以上", rule: "90分終了時の合計得点", settle: "あさっての午前7時" } },
      q5: { n: 5, img: "assets/img/q5-xrp.svg", cat: "crypto", focus: "50% 14%",
        en: { title: "Will XRP be above $2.50 at 21:00 tomorrow?", left: "No", right: "Yes", rule: "Binance XRP/USDT price at 21:00 KST", settle: "21:00 tomorrow" },
        ko: { title: "내일 밤 9시, XRP는 2.5달러 위에 있을까요?", left: "아니요", right: "예", rule: "바이낸스 XRP/USDT 오후 9시 가격", settle: "내일 오후 9시" },
        ja: { title: "明日の21時、XRPは2.5ドルを超えている？", left: "超えない", right: "超える", rule: "Binance XRP/USDTの21時の価格", settle: "明日の21時" } },
      /* earlier days, shown on Results: yesterday's set (p1 to p5) and the set before (p6 to p10) */
      p1: { cat: "crypto",
        en: { title: "Will Ethereum be above $3,500 at 21:00 tomorrow?", left: "No", right: "Yes", rule: "Binance ETH/USDT price at 21:00 KST", settle: "21:00 tomorrow" },
        ko: { title: "내일 밤 9시, 이더리움은 3,500달러 위에 있을까요?", left: "아니요", right: "예", rule: "바이낸스 ETH/USDT 오후 9시 가격", settle: "내일 오후 9시" },
        ja: { title: "明日の21時、イーサリアムは3,500ドルを超えている？", left: "超えない", right: "超える", rule: "Binance ETH/USDTの21時の価格", settle: "明日の21時" } },
      p2: { cat: "markets",
        en: { title: "Will the KOSPI close higher tomorrow than today?", left: "No", right: "Yes", rule: "KRX KOSPI official close against the previous close", settle: "15:40 tomorrow" },
        ko: { title: "내일 코스피, 오늘보다 높게 마감할까요?", left: "아니요", right: "예", rule: "한국거래소 코스피 공식 종가, 전일 종가 대비", settle: "내일 오후 3시 40분" },
        ja: { title: "明日のKOSPI、終値は今日を上回る？", left: "上回らない", right: "上回る", rule: "韓国取引所KOSPIの公式終値（前日終値比）", settle: "明日の15時40分" } },
      p3: { cat: "weather",
        en: { title: "Will it rain in Tokyo tomorrow?", left: "No", right: "Yes", rule: "JMA Tokyo station, 0.5 mm or more in the day", settle: "00:10 in two days" },
        ko: { title: "내일 도쿄에 비가 올까요?", left: "아니요", right: "예", rule: "일본 기상청 도쿄 관측소, 하루 강수량 0.5mm 이상", settle: "모레 0시 10분" },
        ja: { title: "明日、東京で雨は降る？", left: "降らない", right: "降る", rule: "気象庁・東京の日降水量0.5mm以上", settle: "あさっての0時10分" } },
      p4: { cat: "sports",
        en: { title: "Will the home team win tomorrow night's V-League match?", left: "No", right: "Yes", rule: "Official KOVO match result", settle: "22:00 tomorrow" },
        ko: { title: "내일 밤 V리그, 홈팀이 이길까요?", left: "아니요", right: "예", rule: "KOVO 공식 경기 결과", settle: "내일 오후 10시" },
        ja: { title: "明日夜のVリーグ、ホームチームは勝つ？", left: "勝たない", right: "勝つ", rule: "KOVO公式の試合結果", settle: "明日の22時" } },
      p5: { cat: "culture",
        en: { title: "Will the Korean box office No. 1 change tomorrow?", left: "No", right: "Yes", rule: "KOBIS daily box office, tomorrow against today", settle: "10:30 in two days" },
        ko: { title: "내일 국내 박스오피스 1위, 바뀔까요?", left: "아니요", right: "예", rule: "영화진흥위원회 통합전산망 일별 박스오피스 (오늘 대비 내일)", settle: "모레 오전 10시 30분" },
        ja: { title: "明日の韓国の映画興行ランキング、1位は入れ替わる？", left: "変わらない", right: "入れ替わる", rule: "韓国映画振興委員会（KOBIS）の日別興行成績（今日と明日を比較）", settle: "あさっての午前10時30分" } },
      p6: { cat: "crypto",
        en: { title: "Will Bitcoin be above $98,000 at 21:00 tomorrow?", left: "No", right: "Yes", rule: "Binance BTC/USDT price at 21:00 KST", settle: "21:00 tomorrow" },
        ko: { title: "내일 밤 9시, 비트코인은 9만 8천 달러 위에 있을까요?", left: "아니요", right: "예", rule: "바이낸스 BTC/USDT 오후 9시 가격", settle: "내일 오후 9시" },
        ja: { title: "明日の21時、ビットコインは9万8千ドルを超えている？", left: "超えない", right: "超える", rule: "Binance BTC/USDTの21時の価格", settle: "明日の21時" } },
      p7: { cat: "markets",
        en: { title: "Will the Nikkei 225 close above 40,000 tomorrow?", left: "No", right: "Yes", rule: "Nikkei 225 official close", settle: "15:40 tomorrow" },
        ko: { title: "내일 닛케이 225, 4만 선 위에서 마감할까요?", left: "아니요", right: "예", rule: "닛케이 225 공식 종가", settle: "내일 오후 3시 40분" },
        ja: { title: "明日の日経平均、終値は4万円を超える？", left: "超えない", right: "超える", rule: "日経平均株価の終値", settle: "明日の15時40分" } },
      p8: { cat: "weather",
        en: { title: "Will Seoul drop below 0°C tomorrow?", left: "No", right: "Yes", rule: "KMA Seoul station, daily low", settle: "18:00 tomorrow" },
        ko: { title: "내일 서울, 영하로 내려갈까요?", left: "아니요", right: "예", rule: "기상청 서울 관측소 일 최저기온", settle: "내일 오후 6시" },
        ja: { title: "明日のソウル、氷点下まで下がる？", left: "下がらない", right: "下がる", rule: "韓国気象庁ソウル観測所の日最低気温", settle: "明日の18時" } },
      p9: { cat: "sports",
        en: { title: "Will both teams score in tomorrow night's Premier League match?", left: "No", right: "Yes", rule: "Goals by both teams at full time", settle: "07:00 in two days" },
        ko: { title: "내일 밤 프리미어리그, 두 팀 모두 골을 넣을까요?", left: "아니요", right: "예", rule: "정규 시간 종료 기준 양 팀 득점", settle: "모레 오전 7시" },
        ja: { title: "明日夜のプレミアリーグ、両チームとも得点する？", left: "しない", right: "する", rule: "試合終了時点の両チームの得点", settle: "あさっての午前7時" } },
      p10: { cat: "crypto",
        en: { title: "Will KAIA be above $0.15 at 21:00 tomorrow?", left: "No", right: "Yes", rule: "Binance KAIA/USDT price at 21:00 KST", settle: "21:00 tomorrow" },
        ko: { title: "내일 밤 9시, KAIA는 0.15달러 위에 있을까요?", left: "아니요", right: "예", rule: "바이낸스 KAIA/USDT 오후 9시 가격", settle: "내일 오후 9시" },
        ja: { title: "明日の21時、KAIAは0.15ドルを超えている？", left: "超えない", right: "超える", rule: "Binance KAIA/USDTの21時の価格", settle: "明日の21時" } }
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
      { rank: 26, name: "sora", pts: 1000 },
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
    /* Results. Today's set has no answer yet (its outcomes fall after 09:00 KST tomorrow): every row waits. Yesterday's set is being answered today:
       one hit is in and its +50P is on the way. The set before is settled. Then one day that was only partly played. */
    results: [
      { day: 0, done: true, total: 100, rows: [
        { q: "q1", c: "r", out: "wait", exp: "21:00" },
        { q: "q2", c: "r", out: "wait", exp: "16:00" },
        { q: "q3", c: "l", out: "wait", exp: "18:00" },
        { q: "q4", c: "r", out: "wait", exp: "07:00" },
        { q: "q5", c: "r", out: "wait", exp: "21:00" }
      ] },
      { day: 1, done: true, total: 100, pending: 50, rows: [
        { q: "p2", c: "r", out: "pend", at: "22:10" },
        { q: "p1", c: "r", out: "wait", exp: "21:00" },
        { q: "p3", c: "l", out: "wait", exp: "00:10" },
        { q: "p4", c: "r", out: "wait", exp: "22:00" },
        { q: "p5", c: "l", out: "wait", exp: "10:30" }
      ] },
      { day: 2, done: true, total: 250, rows: [
        { q: "p6", c: "r", out: "hit" },
        { q: "p7", c: "l", out: "miss" },
        { q: "p8", c: "r", out: "hit" },
        { q: "p9", c: "r", out: "corr" },
        { q: "p10", c: "l", out: "miss" }
      ] },
      { day: 3, done: false, answered: 3, total: 50, rows: [
        { q: "p1", c: "r", out: "hit" },
        { q: "p2", c: "l", out: "miss" },
        { q: "p3", c: "r", out: "void" },
        { q: "p4", c: null, out: "none" },
        { q: "p5", c: null, out: "none" }
      ] }
    ],
    pastRules: {},   /* every example question now carries its own source (rule) in the three languages */
    /* Friend invites. Code: 6 to 8 characters, capital letters and the digits 2 to 9 (never 0 or 1, so O, I and L are always letters).
       The inviter gets `rate` percent of every point a friend earns, paid at the same moment on top of the friend's points; it converts to CT but is not in the weekly ranking.
       `known` stands for the server lookup on first run; `self` is the new player's own code there (it cannot be used on yourself). Names of friends arrive already masked. */
    invite: {
      code: "MINJI7Q", link: "https://app.cojam.app/i/MINJI7Q", linkShort: "app.cojam.app/i/MINJI7Q", rate: 10, welcome: 100,
      joined: 4, week: 85, total: 1240, by: "minji",
      days: { 0: { pts: 15, n: 1 }, 1: { pts: 35, n: 2 }, 2: { pts: 35, n: 2 } },   /* bonus per results day (day index: points, friends who earned) */
      friends: [
        { name: "da****a", st: "first", pts: 640 },
        { name: "yu**.m", st: "first", pts: 410 },
        { name: "하*", st: "first", pts: 190 },
        { name: "no***e", st: "joined", pts: 0 }
      ],
      known: { MINJI7Q: "minji", DALGONA4: "dalgona" }, self: "SORA52K"
    },
    contracts: ["0x91cb3b346c80ff965a9667ba6228834dbedd71a2", "0x7f223b1607171b81ebd68d22f1ca79157fd4a44b", "0x7879f0a137eae8e45eb670e9ac7bb08c5dfadb84"],
    ago: ago, ahead: ahead
  };
})();
