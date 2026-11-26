/* Mock data for the admin design. No network or chain calls. One fixed moment, so every screen agrees:
   Thursday 26 Nov 2026, 14:32 KST. Day 4 of week 48 (Mon 23 Nov 09:00 KST to Mon 30 Nov 09:00 KST).
   Figures that must add up across screens are derived here from the same sources. */
(function () {
  "use strict";
  var IMG = "../assets/img/";
  /* deterministic mock address: 40 hex characters from a seed, with an optional fixed head and tail */
  function A(seed, head, tail) {
    var h = 2166136261, out = "", i;
    for (i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    while (out.length < 40) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; out += (h >>> 0).toString(16).padStart(8, "0"); }
    out = out.slice(0, 40); head = head || ""; tail = tail || "";
    return "0x" + head + out.slice(head.length, 40 - tail.length) + tail;
  }
  function TX(seed) { return A(seed + "a") + A(seed + "b").slice(2, 26); }
  function sum(a, f) { return a.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); }

  var D = window.AD = { A: A, TX: TX };
  D.now = { day: "Thu 26 Nov 2026", time: "14:32:08", week: 48, weekRange: "Mon 23 Nov to Mon 30 Nov, 09:00 KST", weekEndsIn: 3 * 86400 + 18 * 3600 + 28 * 60, dayEndsIn: 18 * 3600 + 28 * 60 };
  D.owner = "0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb";
  D.token = "0x91cb3B346C80ff965a9667ba6228834dbedD71a2";
  D.contracts = { prediction: A("prediction-contract"), staking: A("staking-contract") };
  D.me = { email: "ops@cojam.app", role: "Operator" };
  D.admins = [
    { email: "founder@cojam.app", role: "Owner", added: "12 Nov 2026", last: "Today 09:14" },
    { email: "ops@cojam.app", role: "Operator", added: "12 Nov 2026", last: "Today 14:02" },
    { email: "dev@cojam.app", role: "Operator", added: "14 Nov 2026", last: "Yesterday 22:40" },
    { email: "cs@cojam.app", role: "Viewer", added: "20 Nov 2026", last: "Today 11:36" }
  ];

  /* ---------- questions ---------- */
  var NY = { ko: ["아니요", "예"], ja: ["いいえ", "はい"] };
  function q(o) { o.ko = o.ko || {}; o.ja = o.ja || {}; ["ko", "ja"].forEach(function (l) { if (!o[l].left) { o[l].left = NY[l][0]; o[l].right = NY[l][1]; } }); if (!o.en.left) { o.en.left = "No"; o.en.right = "Yes"; } return o; }
  D.questions = [
    /* today, Thu 26 Nov: published 08:30, live */
    q({ id: "Q-1126-1", day: "1126", slot: 1, cat: "Crypto", img: IMG + "q1-bitcoin.svg", imgState: "Generated", state: "Live", closes: "Fri 03:00", closesIn: 12 * 3600 + 28 * 60, due: "Fri 09:05", conf: 0.97, source: "AI", picks: [1046, 856],
      src: ["https://www.binance.com/en/trade/BTC_USDT"], resolve: "Take the Binance BTC/USDT 1 day candle that closes at 00:00 UTC on 27 Nov. Above 100,000.00 is Yes; equal or below is No.",
      en: { title: "Will Bitcoin close above $100,000 today?", rule: "Binance BTC/USDT daily close, 00:00 UTC", settle: "09:00 tomorrow" },
      ko: { title: "비트코인, 오늘 10만 달러 위에서 마감할까요?", rule: "바이낸스 BTC/USDT 일봉 종가 (오전 9시)", settle: "내일 오전 9시" },
      ja: { title: "ビットコイン、今日の終値は10万ドルを超える？", left: "超えない", right: "超える", rule: "Binance BTC/USDTの日足終値（午前9時）", settle: "明日の午前9時" } }),
    q({ id: "Q-1126-2", day: "1126", slot: 2, cat: "Markets", img: IMG + "q2-dollar-won.svg", imgState: "Generated", state: "Live", closes: "Today 15:00", closesIn: 28 * 60, due: "Today 16:00", conf: 0.98, source: "AI", picks: [693, 1181],
      src: ["https://www.smbs.biz/ExRate/TodayExRate.jsp"], resolve: "Seoul FX market closing rate for USD/KRW at 15:30 KST on 27 Nov. Above 1,400.0 is Yes.",
      en: { title: "Will the dollar end today above 1,400 won?", rule: "Seoul FX market close, 15:30 KST", settle: "16:00 today" },
      ko: { title: "오늘 원/달러 환율, 1,400원 위에서 끝날까요?", rule: "서울 외환시장 종가 (오후 3시 30분)", settle: "오늘 오후 4시" },
      ja: { title: "今日のドル/ウォン、終値は1,400ウォンを上回る？", left: "上回らない", right: "上回る", rule: "ソウル外国為替市場の終値（15時30分）", settle: "今日の16時" } }),
    q({ id: "Q-1126-3", day: "1126", slot: 3, cat: "Weather", img: IMG + "q3-seoul-weather.svg", imgState: "Generated", state: "Live", closes: "Fri 09:00", closesIn: 18 * 3600 + 28 * 60, due: "Fri 18:10", conf: 0.99, source: "AI", picks: [1210, 651],
      src: ["https://www.weather.go.kr/w/obs-climate/land/city-obs.do"], resolve: "Daily maximum temperature at KMA station 108 (Seoul) for 27 Nov. 10.0°C or higher is Yes.",
      en: { title: "Will Seoul reach 10°C or higher tomorrow?", rule: "KMA Seoul station, daily high", settle: "18:00 tomorrow" },
      ko: { title: "내일 서울 낮 기온, 10도까지 오를까요?", rule: "기상청 서울 관측소 일 최고기온", settle: "내일 오후 6시" },
      ja: { title: "明日のソウル、最高気温は10℃に届く？", left: "届かない", right: "届く", rule: "韓国気象庁ソウル観測所の日最高気温", settle: "明日の18時" } }),
    q({ id: "Q-1126-4", day: "1126", slot: 4, cat: "Sports", img: IMG + "q4-football.svg", imgState: "Replaced", state: "Live", closes: "Fri 04:55", closesIn: 14 * 3600 + 23 * 60, due: "Fri 07:10", conf: 0.94, source: "AI", picks: [772, 1066],
      src: ["https://www.premierleague.com/matches"], resolve: "Total goals at full time (90 minutes plus stoppage time) of the 20:00 GMT match on 27 Nov. 3 or more is the right choice.",
      en: { title: "Tonight's Premier League match: 3 goals or more?", left: "2 or fewer", right: "3 or more", rule: "Total goals at full time", settle: "07:00 tomorrow" },
      ko: { title: "오늘 밤 프리미어리그 경기, 3골 이상 나올까요?", left: "2골 이하", right: "3골 이상", rule: "정규 시간 90분 기준 합계 득점", settle: "내일 오전 7시" },
      ja: { title: "今夜のプレミアリーグ、合計3点以上入る？", left: "2点以下", right: "3点以上", rule: "90分終了時の合計得点", settle: "明日の午前7時" } }),
    q({ id: "Q-1126-5", day: "1126", slot: 5, cat: "Crypto", img: IMG + "q5-kaia.svg", imgState: "Generated", state: "Live", closes: "Fri 03:00", closesIn: 12 * 3600 + 28 * 60, due: "Fri 09:05", conf: 0.97, source: "AI", picks: [905, 906],
      src: ["https://www.binance.com/en/trade/KAIA_USDT"], resolve: "Binance KAIA/USDT last price at 09:00:00 KST on 27 Nov against the price recorded at publish (0.1482). Higher is the right choice; equal is Lower.",
      en: { title: "Will KAIA be higher at 09:00 tomorrow than now?", left: "Lower", right: "Higher", rule: "Binance KAIA/USDT price at 09:00 KST", settle: "09:00 tomorrow" },
      ko: { title: "내일 오전 9시, KAIA는 지금보다 올라 있을까요?", left: "내린다", right: "오른다", rule: "바이낸스 KAIA/USDT 오전 9시 가격", settle: "내일 오전 9시" },
      ja: { title: "明日の朝9時、KAIAは今より上がっている？", left: "下がる", right: "上がる", rule: "Binance KAIA/USDTの午前9時の価格", settle: "明日の午前9時" } }),

    /* Fri 27 Nov: scheduled, editable until 08:30 */
    q({ id: "Q-1127-1", day: "1127", slot: 1, cat: "Markets", img: IMG + "q2-dollar-won.svg", imgState: "Generated", state: "Scheduled", closes: "Fri 14:30", due: "Fri 15:40", conf: 0.98, source: "AI",
      src: ["https://indexes.nikkei.co.jp/en/nkave"], resolve: "Nikkei 225 official closing value on 27 Nov. Above 40,000.00 is Yes.",
      en: { title: "Will the Nikkei 225 close above 40,000?", rule: "Nikkei 225 official close", settle: "15:40 today" },
      ko: { title: "닛케이 225, 4만 선 위에서 마감할까요?", rule: "닛케이 225 공식 종가", settle: "오늘 오후 3시 40분" },
      ja: { title: "日経平均、終値は4万円を超える？", left: "超えない", right: "超える", rule: "日経平均株価の終値", settle: "今日の15時40分" } }),
    q({ id: "Q-1127-2", day: "1127", slot: 2, cat: "Crypto", img: IMG + "q1-bitcoin.svg", imgState: "Generated", state: "Scheduled", closes: "Sat 03:00", due: "Sat 09:05", conf: 0.97, source: "AI",
      src: ["https://www.binance.com/en/trade/ETH_USDT"], resolve: "Binance ETH/USDT 1 day candle closing at 00:00 UTC on 28 Nov. Above 3,500.00 is Yes.",
      en: { title: "Will Ethereum close above $3,500 today?", rule: "Binance ETH/USDT daily close, 00:00 UTC", settle: "09:00 tomorrow" },
      ko: { title: "이더리움, 오늘 3,500달러 위에서 마감할까요?", rule: "바이낸스 ETH/USDT 일봉 종가 (오전 9시)", settle: "내일 오전 9시" },
      ja: { title: "イーサリアム、今日の終値は3,500ドルを超える？", left: "超えない", right: "超える", rule: "Binance ETH/USDTの日足終値（午前9時）", settle: "明日の午前9時" } }),
    q({ id: "Q-1127-3", day: "1127", slot: 3, cat: "Weather", img: IMG + "q3-seoul-weather.svg", imgState: "Generated", state: "Scheduled", closes: "Sat 09:00", due: "Sun 00:10", conf: 0.96, source: "AI",
      src: ["https://www.data.jma.go.jp/obd/stats/data/mdrr/pre_rct/alltable/pre24h00.html"], resolve: "JMA Tokyo station precipitation for 28 Nov, 00:00 to 24:00 JST. 0.5 mm or more is Yes.",
      en: { title: "Will it rain in Tokyo tomorrow?", rule: "JMA Tokyo station, 0.5 mm or more", settle: "00:10 Sunday" },
      ko: { title: "내일 도쿄에 비가 올까요?", rule: "일본 기상청 도쿄 관측소 강수량 0.5mm 이상", settle: "일요일 0시 10분" },
      ja: { title: "明日、東京で雨は降る？", left: "降らない", right: "降る", rule: "気象庁・東京の降水量0.5mm以上", settle: "日曜の0時10分" } }),
    q({ id: "Q-1127-4", day: "1127", slot: 4, cat: "Sports", img: IMG + "q4-football.svg", imgState: "Generated", state: "Scheduled", closes: "Fri 18:55", due: "Fri 21:40", conf: 0.93, source: "AI",
      src: ["https://www.kovo.co.kr/game/v-league"], resolve: "Result of the 19:00 KST V-League men's match on 27 Nov. A home win is Yes.",
      en: { title: "Will the home team win tonight's V-League match?", rule: "Official KOVO match result", settle: "21:40 today" },
      ko: { title: "오늘 밤 V리그, 홈팀이 이길까요?", rule: "KOVO 공식 경기 결과", settle: "오늘 오후 9시 40분" },
      ja: { title: "今夜のVリーグ、ホームチームは勝つ？", left: "勝たない", right: "勝つ", rule: "KOVO公式の試合結果", settle: "今日の21時40分" } }),
    q({ id: "Q-1127-5", day: "1127", slot: 5, cat: "Markets", img: IMG + "q2-dollar-won.svg", imgState: "Generated", state: "Scheduled", closes: "Sat 02:00", due: "Sat 06:10", conf: 0.95, source: "Manual",
      src: ["https://www.lbma.org.uk/prices-and-data/precious-metal-prices"], resolve: "LBMA Gold Price PM for 27 Nov in USD. Above 2,700.00 is Yes.",
      en: { title: "Will gold close above $2,700 today?", rule: "LBMA Gold Price PM, USD", settle: "06:10 tomorrow" },
      ko: { title: "오늘 금값, 2,700달러 위에서 마감할까요?", rule: "LBMA 금 가격 PM (달러)", settle: "내일 오전 6시 10분" },
      ja: { title: "今日の金価格、終値は2,700ドルを超える？", left: "超えない", right: "超える", rule: "LBMA金価格PM（ドル）", settle: "明日の午前6時10分" } }),

    /* Sat 28 Nov: 4 of 5 */
    q({ id: "Q-1128-1", day: "1128", slot: 1, cat: "Crypto", img: IMG + "q1-bitcoin.svg", imgState: "Generated", state: "Scheduled", closes: "Sun 03:00", due: "Sun 09:05", conf: 0.97, source: "AI", src: ["https://www.binance.com/en/trade/BTC_USDT"], resolve: "Binance BTC/USDT 1 day candle closing at 00:00 UTC on 29 Nov against the 28 Nov close. Higher is Yes.",
      en: { title: "Will Bitcoin close higher than yesterday?", rule: "Binance BTC/USDT daily close", settle: "09:00 tomorrow" }, ko: { title: "비트코인, 어제보다 높게 마감할까요?", rule: "바이낸스 BTC/USDT 일봉 종가", settle: "내일 오전 9시" }, ja: { title: "ビットコイン、終値は前日を上回る？", left: "上回らない", right: "上回る", rule: "Binance BTC/USDTの日足終値", settle: "明日の午前9時" } }),
    q({ id: "Q-1128-2", day: "1128", slot: 2, cat: "Sports", img: IMG + "q4-football.svg", imgState: "Generated", state: "Scheduled", closes: "Sat 23:55", due: "Sun 02:10", conf: 0.92, source: "AI", src: ["https://www.premierleague.com/matches"], resolve: "Both teams score at least one goal by full time in the 15:00 GMT match on 28 Nov.",
      en: { title: "Will both teams score in tonight's Premier League match?", rule: "Goals by both teams at full time", settle: "02:10 tomorrow" }, ko: { title: "오늘 밤 프리미어리그, 두 팀 모두 골을 넣을까요?", rule: "정규 시간 종료 기준 양 팀 득점", settle: "내일 오전 2시 10분" }, ja: { title: "今夜のプレミアリーグ、両チームとも得点する？", left: "しない", right: "する", rule: "試合終了時点の両チームの得点", settle: "明日の午前2時10分" } }),
    q({ id: "Q-1128-3", day: "1128", slot: 3, cat: "Weather", img: IMG + "q3-seoul-weather.svg", imgState: "Generated", state: "Scheduled", closes: "Sun 09:00", due: "Sun 18:10", conf: 0.99, source: "AI", src: ["https://www.weather.go.kr/w/obs-climate/land/city-obs.do"], resolve: "Daily minimum temperature at KMA station 108 (Seoul) for 29 Nov. Below 0.0°C is Yes.",
      en: { title: "Will Seoul drop below 0°C tomorrow?", rule: "KMA Seoul station, daily low", settle: "18:00 tomorrow" }, ko: { title: "내일 서울, 영하로 내려갈까요?", rule: "기상청 서울 관측소 일 최저기온", settle: "내일 오후 6시" }, ja: { title: "明日のソウル、氷点下まで下がる？", left: "下がらない", right: "下がる", rule: "韓国気象庁ソウル観測所の日最低気温", settle: "明日の18時" } }),
    q({ id: "Q-1128-4", day: "1128", slot: 4, cat: "Crypto", img: IMG + "q5-kaia.svg", imgState: "Generated", state: "Scheduled", closes: "Sun 03:00", due: "Sun 09:05", conf: 0.97, source: "AI", src: ["https://www.binance.com/en/trade/KAIA_USDT"], resolve: "Binance KAIA/USDT last price at 09:00:00 KST on 29 Nov. Above 0.1500 is Yes.",
      en: { title: "Will KAIA be above $0.15 at 09:00 tomorrow?", rule: "Binance KAIA/USDT price at 09:00 KST", settle: "09:00 tomorrow" }, ko: { title: "내일 오전 9시, KAIA는 0.15달러 위에 있을까요?", rule: "바이낸스 KAIA/USDT 오전 9시 가격", settle: "내일 오전 9시" }, ja: { title: "明日の朝9時、KAIAは0.15ドルを上回っている？", left: "下回る", right: "上回る", rule: "Binance KAIA/USDTの午前9時の価格", settle: "明日の午前9時" } }),

    /* Sun 29 Nov: 5 of 5, one image rejected by the check */
    q({ id: "Q-1129-1", day: "1129", slot: 1, cat: "Crypto", img: IMG + "q1-bitcoin.svg", imgState: "Generated", state: "Scheduled", closes: "Mon 03:00", due: "Mon 09:05", conf: 0.97, source: "AI", src: ["https://www.binance.com/en/trade/BTC_USDT"], resolve: "Binance BTC/USDT 1 day candle closing at 00:00 UTC on 30 Nov. Above 100,000.00 is Yes.",
      en: { title: "Will Bitcoin end the week above $100,000?", rule: "Binance BTC/USDT daily close, 00:00 UTC", settle: "09:00 tomorrow" }, ko: { title: "비트코인, 10만 달러 위에서 한 주를 마칠까요?", rule: "바이낸스 BTC/USDT 일봉 종가 (오전 9시)", settle: "내일 오전 9시" }, ja: { title: "ビットコイン、10万ドル超えで今週を終える？", left: "終えない", right: "終える", rule: "Binance BTC/USDTの日足終値（午前9時）", settle: "明日の午前9時" } }),
    q({ id: "Q-1129-2", day: "1129", slot: 2, cat: "Sports", img: IMG + "q4-football.svg", imgState: "Generated", state: "Scheduled", closes: "Sun 13:55", due: "Sun 16:40", conf: 0.93, source: "AI", src: ["https://www.kovo.co.kr/game/v-league"], resolve: "Result of the 14:00 KST V-League women's match on 29 Nov. A 3 to 0 set score for either team is Yes.",
      en: { title: "Will today's V-League match end in straight sets?", rule: "Official KOVO set score", settle: "16:40 today" }, ko: { title: "오늘 V리그 경기, 3대0으로 끝날까요?", rule: "KOVO 공식 세트 스코어", settle: "오늘 오후 4시 40분" }, ja: { title: "今日のVリーグ、ストレートで決着する？", left: "しない", right: "する", rule: "KOVO公式のセットカウント", settle: "今日の16時40分" } }),
    q({ id: "Q-1129-3", day: "1129", slot: 3, cat: "Culture", img: null, imgState: "Rejected by check", imgWhy: "The check found lettering that reads as a film title in the generated poster wall.", state: "Scheduled", closes: "Sun 23:00", due: "Mon 10:30", conf: 0.88, source: "AI", src: ["https://www.kobis.or.kr/kobis/business/stat/boxs/findWeekendBoxOfficeList.do"], resolve: "KOBIS weekend box office for 27 to 29 Nov against the previous weekend. A different film at No. 1 is Yes.",
      en: { title: "Will this week's box office No. 1 change?", rule: "KOBIS weekend box office", settle: "10:30 Monday" }, ko: { title: "이번 주 박스오피스 1위, 바뀔까요?", rule: "영화진흥위원회 통합전산망 주말 박스오피스", settle: "월요일 오전 10시 30분" }, ja: { title: "今週の映画ランキング、1位は入れ替わる？", left: "変わらない", right: "入れ替わる", rule: "韓国映画振興委員会（KOBIS）の週末興行成績", settle: "月曜の午前10時30分" } }),
    q({ id: "Q-1129-4", day: "1129", slot: 4, cat: "Weather", img: IMG + "q3-seoul-weather.svg", imgState: "Generated", state: "Scheduled", closes: "Mon 09:00", due: "Mon 18:10", conf: 0.96, source: "AI", src: ["https://www.weather.go.kr/w/obs-climate/land/city-obs.do"], resolve: "KMA station 108 (Seoul) records snowfall on 30 Nov.",
      en: { title: "Will Seoul see its first snow tomorrow?", rule: "KMA Seoul station snowfall record", settle: "18:00 tomorrow" }, ko: { title: "내일 서울에 첫눈이 올까요?", rule: "기상청 서울 관측소 적설 기록", settle: "내일 오후 6시" }, ja: { title: "明日、ソウルに初雪は降る？", left: "降らない", right: "降る", rule: "韓国気象庁ソウル観測所の降雪記録", settle: "明日の18時" } }),
    q({ id: "Q-1129-5", day: "1129", slot: 5, cat: "Crypto", img: IMG + "q5-kaia.svg", imgState: "Generated", state: "Scheduled", closes: "Mon 03:00", due: "Mon 09:05", conf: 0.97, source: "AI", src: ["https://www.binance.com/en/trade/KAIA_USDT"], resolve: "Binance KAIA/USDT last price at 09:00:00 KST on 30 Nov against the price at publish. Higher is the right choice.",
      en: { title: "Will KAIA be higher at 09:00 tomorrow than now?", left: "Lower", right: "Higher", rule: "Binance KAIA/USDT price at 09:00 KST", settle: "09:00 tomorrow" }, ko: { title: "내일 오전 9시, KAIA는 지금보다 올라 있을까요?", left: "내린다", right: "오른다", rule: "바이낸스 KAIA/USDT 오전 9시 가격", settle: "내일 오전 9시" }, ja: { title: "明日の朝9時、KAIAは今より上がっている？", left: "下がる", right: "上がる", rule: "Binance KAIA/USDTの午前9時の価格", settle: "明日の午前9時" } })
  ];
  D.q = function (id) { return D.questions.filter(function (x) { return x.id === id; })[0]; };

  /* Founder rule (DECISIONS, Question timing): every question of a day closes together at the end of the day, 09:00 KST next day,
     and its outcome becomes known only after that close. So no question has its own close time; the texts ask about the day after. */
  var NEXT = { "1126": ["Fri", "Sat"], "1127": ["Sat", "Sun"], "1128": ["Sun", "Mon"], "1129": ["Mon", "Tue"] };
  var DUE = { Crypto: [0, "21:05", "21:00 tomorrow", "내일 오후 9시", "明日の21時"], Markets: [0, "16:00", "16:00 tomorrow", "내일 오후 4시", "明日の16時"], Weather: [0, "18:10", "18:00 tomorrow", "내일 오후 6시", "明日の18時"],
    Sports: [1, "07:10", "07:00 in two days", "모레 오전 7시", "あさっての午前7時"], Culture: [0, "10:30", "10:30 tomorrow", "내일 오전 10시 30분", "明日の午前10時30分"] };
  var CRYPTO = {
    "Q-1126-1": ["BTC", "Will Bitcoin be above $100,000 at 21:00 tomorrow?", "내일 밤 9시, 비트코인은 10만 달러 위에 있을까요?", "明日の21時、ビットコインは10万ドルを超えている？"],
    "Q-1126-5": ["KAIA", "Will KAIA be higher at 21:00 tomorrow than now?", "내일 밤 9시, KAIA는 지금보다 올라 있을까요?", "明日の21時、KAIAは今より上がっている？"],
    "Q-1127-1": ["SOL", "Will Solana be above $250 at 21:00 tomorrow?", "내일 밤 9시, 솔라나는 250달러 위에 있을까요?", "明日の21時、ソラナは250ドルを超えている？"],
    "Q-1127-2": ["ETH", "Will Ethereum be above $3,500 at 21:00 tomorrow?", "내일 밤 9시, 이더리움은 3,500달러 위에 있을까요?", "明日の21時、イーサリアムは3,500ドルを超えている？"],
    "Q-1128-1": ["BTC", "Will Bitcoin be higher at 21:00 tomorrow than now?", "내일 밤 9시, 비트코인은 지금보다 올라 있을까요?", "明日の21時、ビットコインは今より上がっている？"],
    "Q-1128-4": ["KAIA", "Will KAIA be above $0.15 at 21:00 tomorrow?", "내일 밤 9시, KAIA는 0.15달러 위에 있을까요?", "明日の21時、KAIAは0.15ドルを超えている？"],
    "Q-1129-1": ["BTC", "Will Bitcoin be above $102,000 at 21:00 tomorrow?", "내일 밤 9시, 비트코인은 10만 2천 달러 위에 있을까요?", "明日の21時、ビットコインは10万2千ドルを超えている？"],
    "Q-1129-5": ["KAIA", "Will KAIA be higher at 21:00 tomorrow than now?", "내일 밤 9시, KAIA는 지금보다 올라 있을까요?", "明日の21時、KAIAは今より上がっている？"]
  };
  /* Friday's set resolves on a Saturday, when markets are shut: its two market questions are a crypto and a weather question instead */
  (function () { var a = D.q("Q-1127-1"); a.cat = "Crypto"; a.img = IMG + "q1-bitcoin.svg"; a.src = ["https://www.binance.com/en/trade/SOL_USDT"];
    var b = D.q("Q-1127-5"); b.cat = "Weather"; b.img = IMG + "q3-seoul-weather.svg"; b.src = ["https://www.data.jma.go.jp/obd/stats/data/mdrr/tem_rct/alltable/mxtemsadext00.html"]; b.resolve = "JMA Tokyo station daily maximum temperature for 28 Nov. 15.0°C or higher is Yes.";
    b.en.title = "Will Tokyo reach 15°C or higher tomorrow?"; b.en.rule = "JMA Tokyo station, daily high"; b.ko.title = "내일 도쿄 낮 기온, 15도까지 오를까요?"; b.ko.rule = "일본 기상청 도쿄 관측소 일 최고기온"; b.ja.title = "明日の東京、最高気温は15℃に届く？"; b.ja.left = "届かない"; b.ja.right = "届く"; b.ja.rule = "気象庁・東京の日最高気温"; })();
  D.questions.forEach(function (x) {
    var n = NEXT[x.day], d = DUE[x.cat], c = CRYPTO[x.id];
    x.closes = n[0] + " 09:00"; x.closesIn = x.day === "1126" ? D.now.dayEndsIn : undefined; x.due = n[d[0]] + " " + d[1]; x.outcome = n[d[0]] + " " + d[1].replace(/:(05|10)$/, ":00");
    x.en.settle = d[2]; x.ko.settle = d[3]; x.ja.settle = d[4];
    if (c) {
      x.en.title = c[1]; x.ko.title = c[2]; x.ja.title = c[3]; x.en.rule = "Binance " + c[0] + "/USDT price at 21:00 KST"; x.ko.rule = "바이낸스 " + c[0] + "/USDT 오후 9시 가격"; x.ja.rule = "Binance " + c[0] + "/USDTの21時の価格";
      x.resolve = "Binance " + c[0] + "/USDT last price at 21:00:00 KST on " + n[0] + ", the day after the set. A price equal to the mark counts as the left choice.";
      if (/higher/.test(c[1])) { x.en.left = "Lower"; x.en.right = "Higher"; x.ko.left = "내린다"; x.ko.right = "오른다"; x.ja.left = "下がる"; x.ja.right = "上がる"; }
      else { x.ja.left = "超えない"; x.ja.right = "超える"; }
    } else {
      x.en.title = x.en.title.replace("Tonight's", "Tomorrow night's").replace("tonight's", "tomorrow night's").replace("today's", "tomorrow's").replace(" today", " tomorrow");
      x.ko.title = x.ko.title.replace("오늘", "내일"); x.ja.title = x.ja.title.replace("今夜", "明日の夜").replace("今日", "明日");
    }
  });
  D.today = D.questions.filter(function (x) { return x.day === "1126"; });

  /* 14 day strip. The drafter writes 7 days ahead every evening; days past that are not expected to be filled yet. */
  D.days = [
    { id: "1126", d: "Thu 26", n: 5, img: 5, tag: "Today", state: "Live" }, { id: "1127", d: "Fri 27", n: 5, img: 5, state: "Scheduled" }, { id: "1128", d: "Sat 28", n: 4, img: 4, state: "Scheduled" },
    { id: "1129", d: "Sun 29", n: 5, img: 4, state: "Scheduled" }, { id: "1130", d: "Mon 30", n: 5, img: 5, state: "Scheduled" }, { id: "1201", d: "Tue 1", n: 5, img: 5, state: "Scheduled" },
    { id: "1202", d: "Wed 2", n: 5, img: 5, state: "Scheduled" }, { id: "1203", d: "Thu 3", n: 3, img: 3, state: "Drafting", far: true }, { id: "1204", d: "Fri 4", n: 0, img: 0, far: true }, { id: "1205", d: "Sat 5", n: 0, img: 0, far: true },
    { id: "1206", d: "Sun 6", n: 0, img: 0, far: true }, { id: "1207", d: "Mon 7", n: 0, img: 0, far: true }, { id: "1208", d: "Tue 8", n: 0, img: 0, far: true }, { id: "1209", d: "Wed 9", n: 0, img: 0, far: true }
  ];
  D.dayLong = { "1126": "Thursday 26 Nov", "1127": "Friday 27 Nov", "1128": "Saturday 28 Nov", "1129": "Sunday 29 Nov" };

  /* drafts the AI wrote that are not on a day yet */
  D.queue = [
    { id: "D-2231", cat: "Markets", img: IMG + "q2-dollar-won.svg", imgState: "Generated", title: "Will the KOSPI close higher tomorrow than today?", l: "No", r: "Yes", rule: "KRX KOSPI official close against the previous close", src: "data.krx.co.kr", conf: 0.98, drafted: "Wed 18:00", fits: "Sun to Thu sets" },
    { id: "D-2232", cat: "Sports", img: IMG + "q4-football.svg", imgState: "Generated", title: "Sunday's K League final: will it go to extra time?", l: "No", r: "Yes", rule: "Official K League match report", src: "kleague.com", conf: 0.91, drafted: "Wed 18:00", fits: "Sat 28 only" },
    { id: "D-2233", cat: "Crypto", img: IMG + "q1-bitcoin.svg", imgState: "Generated", title: "Will XRP be above $2.50 at 21:00 tomorrow?", l: "No", r: "Yes", rule: "Binance XRP/USDT price at 21:00 KST", src: "binance.com", conf: 0.97, drafted: "Wed 18:00", fits: "Any day" },
    { id: "D-2234", cat: "Weather", img: IMG + "q3-seoul-weather.svg", imgState: "Generated", title: "Will Osaka reach 15°C or higher tomorrow?", l: "No", r: "Yes", rule: "JMA Osaka station, daily high", src: "data.jma.go.jp", conf: 0.99, drafted: "Tue 18:00", fits: "Any day" },
    { id: "D-2235", cat: "Culture", img: null, imgState: "Fallback", title: "Will this week's No. 1 song on Melon change?", l: "No", r: "Yes", rule: "Melon weekly chart, published Monday", src: "melon.com", conf: 0.84, drafted: "Tue 18:00", fits: "Sun set only" },
    { id: "D-2236", cat: "Markets", img: IMG + "q2-dollar-won.svg", imgState: "Generated", title: "Will the yen end tomorrow below 155 per dollar?", l: "No", r: "Yes", rule: "Tokyo FX market close, 17:00 JST", src: "boj.or.jp", conf: 0.96, drafted: "Tue 18:00", fits: "Sun to Thu sets" }
  ];

  /* ---------- today in numbers ---------- */
  var picks = sum(D.today, function (x) { return x.picks[0] + x.picks[1]; });   /* 9,286 */
  D.play = { players: 1926, completed: 1788, picks: picks, undone: 407, hitsPaid: 803 + 1233 };
  D.users = { registered: 4812, activeWeek: 2740, newToday: 86, invitedToday: 33, newWeek: 371, invitedWeek: 141, qualified: 1284 };
  /* daily players (first number) and completed days (second), last 30 days ending today (today is still running) */
  D.daily = [[212, 181], [248, 214], [301, 262], [356, 311], [398, 352], [441, 389], [476, 425], [529, 470], [588, 527], [652, 588], [701, 634], [768, 699], [822, 751], [871, 794], [934, 853], [1012, 927], [1088, 1001], [1156, 1066], [1231, 1139], [1302, 1204], [1377, 1279], [1466, 1361], [1548, 1440], [1642, 1528], [1731, 1611], [1836, 1712], [2038, 1902], [2019, 1884], [1996, 1861], [1926, 1788]];
  /* points issued: [today, this week]. Completion is 100P per finished day, a hit 50P, the invite bonus 10% of what invited friends earn, welcome 100P once. */
  D.points = {
    completion: [D.play.completed * 100, (1902 + 1884 + 1861 + D.play.completed) * 100],
    hits: [D.play.hitsPaid * 50, 7536 * 50],
    invite: [9820, 46880],
    welcome: [41 * 100, 163 * 100]
  };
  D.points.total = [0, 1].map(function (i) { return D.points.completion[i] + D.points.hits[i] + D.points.invite[i] + D.points.welcome[i]; });
  D.convert = { rate: 1000, todayCt: 186, todayN: 43, weekCt: 742, weekN: 171, capDay: 20000, capUser: 50, topUser: 12, atUserCap: 0, waiting: 1640 /* players still inside the 7 day wait */ };
  D.reserves = [
    { id: "pred", name: "Prediction reserve", what: "Pays conversions and the weekly airdrop", bal: 24800, unit: "CT", perDay: 389, runway: 64, floor: 5000, k: "ok", note: "206 CT a day in conversions, 1,284 CT a week in airdrops" },
    { id: "stake", name: "Staking rewards fund", what: "Free balance that new stakes reserve their interest from", bal: 38200, unit: "CT", perDay: 1660, runway: 23, floor: 20000, k: "warn", note: "962,400 CT staked, 21,460 CT interest already reserved for open stakes" },
    { id: "fee", name: "Fee payer", what: "Pays the network fee for every sponsored transaction", bal: 184.6, unit: "KAIA", perDay: 41.2, runway: 4, floor: 200, k: "down", note: "About 10,300 sponsored transactions a day" },
    { id: "op", name: "Operator wallet", what: "Registers players, sets answers, settles, blocks and airdrops", bal: 96.3, unit: "KAIA", perDay: 6.8, runway: 14, floor: 50, k: "ok", note: "About 410 operator transactions a day" }
  ];
  D.wallets = { fee: A("fee-payer"), op: A("operator"), pred: D.contracts.prediction, stake: D.contracts.staking };
  D.staking = { total: 962400, owed: 21460, free: 38200, stakes: 418 };
  D.invites = { today: 33, week: 141, shareToday: 33 / 86, shareWeek: 141 / 371, bonusToday: 9820, bonusWeek: 46880, welcomeToday: 41, welcomeWeek: 163 };
  D.abuse = { blocked: 212, blockedWeek: 37, blockedHour: 3, review: 14, clusters: 2 };

  /* ---------- pending owner change ---------- */
  D.pending = {
    by: D.owner, tx: TX("propose-1"), proposed: "Wed 25 Nov, 16:10 KST", applies: "Fri 27 Nov, 16:10 KST", in: 25 * 3600 + 38 * 60,
    items: [{ key: "completion", name: "Completion points", from: "100 P", to: "120 P" }, { key: "hit", name: "Points per hit", from: "50 P", to: "40 P" }]
  };

  /* ---------- reward parameters ---------- */
  D.params = [
    { group: "Daily play", store: "Prediction contract", rows: [
      { key: "completion", name: "Completion points", help: "Paid once when a player answers all 5 of the day", cur: "100", unit: "P", bounds: "0 to 1,000, whole number", err: "Enter a whole number from 0 to 1,000." },
      { key: "hit", name: "Points per hit", help: "Paid for each right answer after the correction window", cur: "50", unit: "P", bounds: "0 to 1,000, whole number", err: "Enter a whole number from 0 to 1,000." },
      { key: "settle", name: "Correction window (settle delay)", help: "Time between an answer being set and hit points being paid", cur: "6", unit: "hours", bounds: "0 to 48 hours", err: "Enter 0 to 48 hours." }
    ] },
    { group: "Conversion to CT", store: "Prediction contract", rows: [
      { key: "rate", name: "Points per CT", help: "1,000 P convert to 1 CT", cur: "1,000", unit: "P per CT", bounds: "100 to 100,000, whole number", err: "Enter how many points make 1 CT, from 100 to 100,000." },
      { key: "minconv", name: "Minimum conversion", help: "Smallest amount a player can convert at once", cur: "1,000", unit: "P", bounds: "A multiple of the rate, up to 1,000,000", err: "The minimum must be a multiple of the rate." },
      { key: "capuser", name: "Conversion cap per player per day", cur: "50", unit: "CT", bounds: "1 to 10,000", err: "Enter 1 to 10,000." },
      { key: "capday", name: "Conversion cap per day, everyone", cur: "20,000", unit: "CT", bounds: "100 to 1,000,000", err: "Enter 100 to 1,000,000." },
      { key: "age", name: "Account age wait", help: "Days after sign up before the first conversion", cur: "7", unit: "days", bounds: "0 to 30 days", err: "Enter 0 to 30 days." }
    ] },
    { group: "Invites", store: "Prediction contract", rows: [
      { key: "ref", name: "Referral rate", help: "Bonus to the inviter on every point a friend earns", cur: "10", unit: "% (1,000 bps)", bounds: "0% to 20%, whole basis points", err: "Enter a rate from 0% to 20%." },
      { key: "welcome", name: "Welcome points", help: "Paid once to an invited friend on their first finished day", cur: "100", unit: "P", bounds: "0 to 1,000, whole number", err: "Enter a whole number from 0 to 1,000." },
      { key: "invday", name: "Invite links per inviter per day", cur: "30", unit: "links", bounds: "1 to 1,000", err: "Enter 1 to 1,000.", store: "Server" }
    ] },
    { group: "Weekly ranking and airdrop", store: "Prediction contract", rows: [
      { key: "poolper", name: "Weekly pool per qualified player", cur: "1", unit: "CT", bounds: "0 or more", err: "Enter 0 or more.", store: "Server" },
      { key: "poolcap", name: "Weekly pool cap", cur: "10,000", unit: "CT", bounds: "0 to 1,000,000", err: "Enter 0 to 1,000,000." },
      { key: "airdelay", name: "Airdrop delay", help: "Time after the week closes before prizes are sent (Wed 21:00 KST), so late answers can land", cur: "60", unit: "hours (Wed 21:00 KST)", bounds: "48 to 96 hours", err: "Enter 48 to 96 hours.", store: "Server" }
    ] },
    { group: "Abuse thresholds", store: "Server", rows: [
      { key: "blockat", name: "Block at risk score", cur: "80", unit: "of 100", bounds: "0 to 100", err: "The review threshold must be below the block threshold." },
      { key: "reviewat", name: "Review from risk score", cur: "50", unit: "of 100", bounds: "0 to 100, below the block score", err: "The review threshold must be below the block threshold." }
    ] }
  ];
  D.split = [30, 20, 15, 10, 7, 5, 4, 3, 3, 3];
  D.stakingRates = { tiers: ["100 to 999 CT", "1,000 to 9,999 CT", "10,000 CT or more"], periods: [[30, [8, 9, 10]], [90, [12, 13, 14]], [180, [18, 19, 20]], [365, [25, 26, 27]]] };
  D.stakingParams = [
    { key: "tier2", name: "Tier 2 starts at", cur: "1,000", unit: "CT", bounds: "Above the minimum stake", err: "Tier limits must go up." },
    { key: "tier3", name: "Tier 3 starts at", cur: "10,000", unit: "CT", bounds: "Above tier 2", err: "Tier limits must go up." },
    { key: "minstake", name: "Minimum stake", cur: "100", unit: "CT", bounds: "1 to 100,000", err: "Enter 1 to 100,000." },
    { key: "minclaim", name: "Minimum interest claim", cur: "10", unit: "CT", bounds: "0 to 1,000", err: "Enter 0 to 1,000." }
  ];

  /* ---------- answers ---------- */
  /* Every set closes at 09:00 KST and its outcomes fall after that: Wednesday's set (closed Thu 09:00) is being answered today, Tuesday's (closed Wed 09:00) is mostly settled. */
  D.answers = [
    { id: "Q-1125-1", set: "Wed 25", title: "Will Ethereum close above $3,500 tomorrow?", l: "No", r: "Yes", picks: [1012, 861], closed: "Thu 09:00", ai: "l", conf: 0.99, setAt: "Thu 09:02", winEnds: "Today 15:02", winIn: 30 * 60, hits: 1012, paid: false, deadline: "Sat 09:00", state: "Answer set", tab: "set",
      rule: "Binance ETH/USDT daily close, 00:00 UTC", ev: [{ src: "Binance ETH/USDT 1 day candle", url: "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d", quote: "close: 3462.18", value: "3,462.18", at: "Thu 09:01:12" }, { src: "CoinGecko ETH daily close (cross check)", url: "https://www.coingecko.com/en/coins/ethereum/historical_data", quote: "Close $3,461.90", value: "3,461.90", at: "Thu 09:01:40" }], tx: TX("ans-1125-1") },
    { id: "Q-1125-2", set: "Wed 25", title: "Will the KOSPI close higher tomorrow than today?", l: "No", r: "Yes", picks: [776, 1104], closed: "Thu 09:00", ai: null, conf: null, setAt: null, due: "Today 16:00", dueIn: 88 * 60, hits: 0, paid: false, deadline: "Sat 09:00", state: "Waiting", tab: "waiting",
      rule: "KRX KOSPI official close against the previous close", ev: [] },
    { id: "Q-1125-3", set: "Wed 25", title: "Will it rain in Tokyo tomorrow?", l: "No", r: "Yes", picks: [1188, 678], closed: "Thu 09:00", ai: null, conf: null, setAt: null, due: "Fri 00:10", dueIn: 9 * 3600 + 38 * 60, hits: 0, paid: false, deadline: "Sat 09:00", state: "Waiting", tab: "waiting",
      rule: "JMA Tokyo station, 0.5 mm or more", ev: [] },
    { id: "Q-1125-4", set: "Wed 25", title: "Will Bitcoin be above $98,000 at 21:00 tomorrow?", l: "No", r: "Yes", picks: [644, 1241], closed: "Thu 09:00", ai: null, conf: null, setAt: null, due: "Today 21:05", dueIn: 6 * 3600 + 33 * 60, hits: 0, paid: false, deadline: "Sat 09:00", state: "Waiting", tab: "waiting",
      rule: "Binance BTC/USDT price at 21:00 KST", ev: [] },
    { id: "Q-1125-5", set: "Wed 25", title: "Will Seoul reach 10°C or higher tomorrow?", l: "No", r: "Yes", picks: [1321, 558], closed: "Thu 09:00", ai: null, conf: null, setAt: null, due: "Today 18:10", dueIn: 3 * 3600 + 38 * 60, hits: 0, paid: false, deadline: "Sat 09:00", state: "Waiting", tab: "waiting",
      rule: "KMA Seoul station, daily high", ev: [] },
    { id: "Q-1124-1", set: "Tue 24", title: "Will the Nikkei 225 close above 40,000 tomorrow?", l: "No", r: "Yes", picks: [987, 902], closed: "Wed 09:00", ai: null, conf: null, setAt: null, due: "Wed 15:40", late: "22h 52m late", hits: 0, paid: false, deadline: "Fri 09:00", deadlineIn: 18 * 3600 + 28 * 60, state: "Late", tab: "late",
      rule: "Nikkei 225 official close", ev: [], err: "The source page timed out on 3 runs, then returned a value for 26 Nov. The run stopped because the date did not match." },
    { id: "Q-1124-2", set: "Tue 24", title: "Tomorrow night's Premier League match: 3 goals or more?", l: "2 or fewer", r: "3 or more", picks: [812, 1077], closed: "Wed 09:00", ai: "r", conf: 0.9, setAt: "Thu 09:12", winEnds: "Today 15:12", winIn: 40 * 60, hits: 1077, paid: false, deadline: "Fri 09:00", state: "Corrected", tab: "corrected",
      rule: "Total goals at full time", ev: [{ src: "Premier League match centre", url: "https://www.premierleague.com/matches", quote: "FT 2 : 1", value: "3 goals", at: "Thu 10:38:05" }], tx: TX("ans-1124-2"),
      corrected: { from: "l", by: "ops@cojam.app", at: "Thu 10:40", why: "A goal in stoppage time. The first fetch read the score at 90:00.", inside: true } },
    { id: "Q-1124-3", set: "Tue 24", title: "Will the Bank of Korea cut its base rate tomorrow?", l: "No", r: "Yes", picks: [1203, 371], closed: "Wed 09:00", ai: null, conf: null, setAt: null, hits: 0, paid: false, deadline: "Fri 09:00", state: "Cancelled", tab: "all",
      rule: "Bank of Korea press release", ev: [], voided: { by: "ops@cojam.app", at: "Tue 09:52", why: "The meeting was moved to next week after the question went live." } },
    { id: "Q-1124-4", set: "Tue 24", title: "Will the home team win tomorrow night's V-League match?", l: "No", r: "Yes", picks: [803, 1041], closed: "Wed 09:00", ai: "l", conf: 0.71, setAt: "Thu 04:10", winEnds: "Thu 10:10", hits: 803, paid: true, deadline: "Fri 09:00", state: "Answer set", tab: "set", flag: "Low confidence",
      rule: "Official KOVO match result", ev: [{ src: "KOVO match centre", url: "https://www.kovo.co.kr/game/v-league", quote: "Set score 1 : 3 (25 Nov, women)", value: "Away win, women's match", at: "Thu 04:09:31" }], tx: TX("ans-1124-4"),
      fix: { right: "r", players: 1041, invited: 372, wrongPaid: 803, week: 48, note: "The run read the women's match played the same evening. The men's 19:00 match ended 3 : 1 for the home team." } },
    { id: "Q-1124-5", set: "Tue 24", title: "Will gold close above $2,700 tomorrow?", l: "No", r: "Yes", picks: [636, 1233], closed: "Wed 09:00", ai: "r", conf: 0.98, setAt: "Thu 06:05", winEnds: "Thu 12:05", hits: 1233, paid: true, deadline: "Fri 09:00", state: "Answer set", tab: "set",
      rule: "LBMA Gold Price PM, USD", ev: [{ src: "LBMA Gold Price PM", url: "https://www.lbma.org.uk/prices-and-data/precious-metal-prices", quote: "PM 2,712.40 USD", value: "2,712.40", at: "Thu 06:04:50" }], tx: TX("ans-1124-5") }
  ];
  D.answerAudit = [
    { t: "Thu 12:05:02", who: "Settle sweep", lv: "info", msg: "Paid 1,233 hits on Q-1124-5 (61,650 P) and 2,160 P invite bonus.", tx: TX("settle-1124-5") },
    { t: "Thu 10:10:04", who: "Settle sweep", lv: "info", msg: "Paid 803 hits on Q-1124-4 (40,150 P) and 1,400 P invite bonus.", tx: TX("settle-1124-4") },
    { t: "Thu 09:02:11", who: "Answer setter", lv: "info", msg: "Set Q-1125-1 to No. Confidence 0.99, 2 sources agree. Window ends 15:02.", tx: TX("ans-1125-1") },
    { t: "Thu 04:10:19", who: "Answer setter", lv: "warn", msg: "Set Q-1124-4 to No. Confidence 0.71, 1 source. Flagged for review.", tx: TX("ans-1124-4") },
    { t: "Wed 16:14:40", who: "Answer setter", lv: "error", msg: "Q-1124-1: source date mismatch after 3 retries. No answer set.", json: '{ "question": "Q-1124-1", "attempts": 4, "last": { "url": "https://indexes.nikkei.co.jp/en/nkave", "status": 200, "parsed_date": "2026-11-25", "expected_date": "2026-11-24" }, "action": "stopped" }' },
    { t: "Thu 10:40:27", who: "ops@cojam.app", lv: "info", msg: "Corrected Q-1124-2 from 2 or fewer to 3 or more inside the window. Reason: A goal in stoppage time. The first fetch read the score at 90:00.", tx: TX("fix-1124-2") },
    { t: "Tue 09:52:03", who: "ops@cojam.app", lv: "info", msg: "Voided Q-1124-3. Reason: The meeting was moved to next week after the question went live.", tx: TX("void-1124-3") }
  ];

  /* ---------- ranking ---------- */
  D.split10 = function (pool) { return D.split.map(function (p) { return Math.round(pool * p) / 100; }); };
  var names = [["dalgona", A("r1", "c41d", "07ae")], ["0x4f2a…91bc", A("r2", "4f2a", "91bc")], ["yuki.m", A("r3")], ["하늘", A("r4")], ["kaia_whale", A("r5")], ["0x9c1e…77d0", A("r6", "9c1e", "77d0")], ["noodle", A("r7")], ["みさき", A("r8")], ["jay.park", A("r9")], ["0x03bd…e41a", A("r10", "03bd", "e41a")]];
  var pts = [750, 700, 700, 650, 650, 650, 600, 600, 600, 550], hit = [7, 6, 6, 5, 5, 5, 4, 4, 4, 3];   /* the most anyone can have by now: 4 finished days and 7 settled hits */
  var first = ["", "", "Reached 700 P at Thu 12:05, after rank 2 (Thu 10:10)", "", "Reached 650 P at Thu 10:10, after rank 4", "Reached 650 P at Thu 12:05, after rank 5", "", "Reached 600 P at Thu 10:10, after rank 7", "Reached 600 P at Thu 12:05, after rank 8", ""];
  var prize = D.split10(D.users.qualified);
  D.rank = names.map(function (nm, i) { return { rank: i + 1, name: nm[0], addr: nm[1], pts: pts[i], hits: hit[i], days: 4, prize: prize[i], tie: first[i] }; });
  D.rankNext = [{ rank: 11, name: "sora", addr: A("r11"), pts: 550, hits: 3, days: 4, tie: "Reached 550 P at Thu 12:05, after rank 10" }, { rank: 12, name: "bongbong", addr: A("r12"), pts: 500, hits: 2, days: 4, tie: "" }];
  D.week = { n: 48, qualified: D.users.qualified, per: 1, cap: 10000, pool: D.users.qualified, playersRanked: 2740, lateAnswers: 2 };
  var lastNames = [["kaia_whale", A("r5")], ["dalgona", A("r1", "c41d", "07ae")], ["みさき", A("r8")], ["yuki.m", A("r3")], ["0x4f2a…91bc", A("r2", "4f2a", "91bc")], ["noodle", A("r7")], ["jay.park", A("r9")], ["하늘", A("r4")], ["sora", A("r11")], ["0x77aa…c2d1", A("l10", "77aa", "c2d1")]];
  var lastPts = [1900, 1850, 1850, 1800, 1750, 1750, 1700, 1700, 1650, 1650];
  var lastPrize = D.split10(1131);
  D.last = { n: 47, range: "Mon 16 Nov to Mon 23 Nov", qualified: 1131, pool: 1131, due: "Wed 25 Nov, 21:00 KST", sentAt: "Wed 25 Nov, 21:00:44 KST", tx: TX("airdrop-47"), block: "233,449,012",
    skipped: { name: "0x5be0…a113", addr: A("frozen-w47", "5be0", "a113"), pts: 1750, wouldBe: 6, why: "Blocked Tue 24 Nov by the risk check (score 88)" },
    rows: lastNames.map(function (nm, i) { return { rank: i + 1, name: nm[0], addr: nm[1], pts: lastPts[i], prize: lastPrize[i] }; }) };

  /* ---------- system ---------- */
  D.jobs = [
    { name: "Question drafter", what: "Writes tomorrow's questions and fills 7 days ahead", every: "Daily 18:00", last: "Wed 18:00", took: "3m 12s", result: "7 drafted, 5 scheduled", next: "Today 18:00", s: "Healthy" },
    { name: "Image generator", what: "One picture per draft, then the content check", every: "After drafting", last: "Wed 18:04", took: "6m 40s", result: "7 generated, 1 rejected by check", next: "Today 18:04", s: "Healthy" },
    { name: "Question publisher", what: "Writes the day's 5 questions on chain", every: "Daily 08:30", last: "Today 08:30", took: "9s", result: "5 published", next: "Fri 08:30", s: "Healthy" },
    { name: "Answer setter", what: "Reads the source and sets each answer on chain", every: "Every 5 min", last: "Today 14:30", took: "41s", result: "1 question late: Q-1124-1", next: "Today 14:35", s: "Slow" },
    { name: "Settle sweep", what: "Pays hit points when a correction window ends", every: "Every 10 min", last: "Today 14:30", took: "2s", result: "Nothing due. Last paid 12:05", next: "Today 14:40", s: "Healthy" },
    { name: "Registration queue", what: "Registers new players and links invites", every: "Continuous", last: "Today 14:32", took: "1s", result: "86 today, 2 waiting", next: "Running", s: "Healthy" },
    { name: "Risk scoring", what: "Scores accounts hourly and at every sign up", every: "Hourly and at sign up", last: "Today 14:00", took: "58s", result: "3 blocked, 5 sent to review", next: "Today 15:00", s: "Healthy" },
    { name: "Ranking aggregator", what: "Rebuilds the weekly standings", every: "Every 5 min", last: "Today 14:30", took: "4s", result: "2,740 players ranked", next: "Today 14:35", s: "Healthy" },
    { name: "Airdrop sender", what: "Sends the weekly prizes to the top 10", every: "Wed 21:00", last: "Wed 21:00", took: "44s", result: "Week 47 sent, 1,131 CT", next: "Wed 2 Dec 21:00", s: "Healthy" },
    { name: "Deposit watcher", what: "Shows incoming CT deposits in the wallet", every: "Continuous", last: "Today 14:32", took: "1s", result: "17 deposits today", next: "Running", s: "Healthy" }
  ];
  D.sponsor = { actions: [["Predict", 1146], ["Play key setup", 31], ["Convert", 14], ["Stake", 6], ["Claim interest", 3]], refusals: [["FROZEN", 4, "Blocked accounts get no sponsored gas"], ["RATE_LIMIT", 2, "More than 30 sends a minute"], ["NOT_REGISTERED", 1, "Wallet is not a player yet"]], median: "1.4 s", keysToday: 143, lastErr: "13:58 RPC timeout on one send, retried and confirmed" };
  D.domains = [
    { d: "gmail.com", name: "Gmail", rule: "Dots and +tags removed", on: true, up: 231, no: 19 }, { d: "naver.com", name: "Naver", rule: "+tags removed", on: true, up: 188, no: 4 },
    { d: "kakao.com", name: "Kakao", rule: "+tags removed", on: true, up: 54, no: 1 }, { d: "daum.net", name: "Daum", rule: "+tags removed", on: true, up: 21, no: 0 },
    { d: "hanmail.net", name: "Hanmail", rule: "+tags removed", on: true, up: 9, no: 0 }, { d: "icloud.com", name: "iCloud", rule: "+tags removed", on: true, up: 38, no: 2 },
    { d: "outlook.com", name: "Outlook", rule: "+tags removed", on: true, up: 17, no: 1 }, { d: "hotmail.com", name: "Hotmail", rule: "+tags removed", on: true, up: 8, no: 0 },
    { d: "yahoo.co.jp", name: "Yahoo! JAPAN", rule: "None", on: true, up: 32, no: 0 }
  ];
  D.refusedDomains = { total: 74, top: [["proton.me", 22], ["qq.com", 11], ["me.com", 9], ["nate.com", 7]] };
  D.images = { generated: 49, rejected: 3, fallback: 1, cost: "5.88 USD", per: "0.12 USD each", model: "Set in the server config (IMAGE_MODEL)" };
  D.chain = { rpc: [["public-en.node.kaia.io", "Healthy", "182 ms"], ["Backup endpoint", "Healthy", "240 ms"]], height: "233,512,884", lag: "1 block" };
  D.app = { version: "1.0.3", min: "1.0.0", maintenance: false, msg: "Cojam is being updated. Your points and picks are safe.", end: "Today 16:00 KST" };
  D.log = [
    { t: "14:32:01", lv: "info", who: "Registration queue", msg: "Registered 0x3e7a…c19d with invite code DALGONA4." },
    { t: "14:30:41", lv: "warn", who: "Answer setter", msg: "Q-1124-1 still without an answer. Deadline Fri 09:00 KST, then the question is cancelled.", json: '{ "question": "Q-1124-1", "due": "2026-11-24T06:40:00Z", "deadline": "2026-11-27T00:00:00Z", "attempts": 4 }' },
    { t: "14:12:36", lv: "warn", who: "Fee payer", msg: "Balance 184.6 KAIA is below the floor of 200 KAIA." },
    { t: "14:00:58", lv: "info", who: "Risk scoring", msg: "Blocked 3 accounts under inviter 0x8d31…c4f0 (scores 84, 86, 91). 5 more sent to review.", tx: TX("freeze-batch") },
    { t: "13:58:12", lv: "error", who: "Relayer", msg: "RPC timeout on a predict send. Retried on the backup endpoint and confirmed in 3.1 s.", json: '{ "action": "predict", "endpoint": "public-en.node.kaia.io", "error": "ETIMEDOUT", "retry": 1, "confirmed_ms": 3100 }' },
    { t: "12:05:02", lv: "info", who: "Settle sweep", msg: "Paid 1,233 hits on Q-1124-5 (61,650 P).", tx: TX("settle-1124-5") },
    { t: "10:10:04", lv: "info", who: "Settle sweep", msg: "Paid 803 hits on Q-1124-4 (40,150 P).", tx: TX("settle-1124-4") },
    { t: "09:02:11", lv: "info", who: "Answer setter", msg: "Set Q-1125-1 to No. Confidence 0.99.", tx: TX("ans-1125-1") },
    { t: "08:30:09", lv: "info", who: "Question publisher", msg: "Published 5 questions for Thu 26 Nov.", tx: TX("publish-1126") },
    { t: "04:10:19", lv: "warn", who: "Answer setter", msg: "Set Q-1124-4 to No with confidence 0.71. Flagged for review.", tx: TX("ans-1124-4") },
    { t: "Wed 21:00:44", lv: "info", who: "Airdrop sender", msg: "Week 47 airdrop sent: 10 payouts, 1,131 CT. 1 blocked winner skipped.", tx: TX("airdrop-47") },
    { t: "Wed 18:10:52", lv: "warn", who: "Image generator", msg: "Image for Q-1129-3 rejected by the check: lettering that reads as a film title." },
    { t: "Wed 16:10:27", lv: "info", who: "Owner wallet", msg: "Proposed: Completion points 100 to 120, Points per hit 50 to 40. Can be applied Fri 27 Nov, 16:10 KST.", tx: TX("propose-1") }
  ];

  /* ---------- players ---------- */
  var inviterA = A("cluster-a", "8d31", "c4f0");
  D.inviterA = inviterA;
  var mails = ["ha*****3@gmail.com", "ha*****4@gmail.com", "ha*****7@gmail.com", "ha*****9@gmail.com", "je****21@naver.com", "je****22@naver.com", "je****25@naver.com", "ha****11@gmail.com"];
  var scoresA = [78, 76, 74, 74, 71, 68, 66, 62];
  var clusterA = scoresA.map(function (s, i) {
    var rules = [{ k: "Sign up burst", t: "11 friends of one inviter joined within 9 minutes" }];
    if (i < 6) rules.push({ k: "Shared network", t: "6 sign ups from one network in 1 hour" });
    if (i < 4) rules.push({ k: "Identical answers", t: "Same 5 answers within 4 s of " + (i ? "0x" + A("ca0").slice(2, 6) + "…" : "3 other accounts") });
    if (i === 0 || i === 2) rules.push({ k: "Shared device", t: "Same device as 2 other accounts" });
    return { addr: A("ca" + i), email: mails[i], joined: "Today 13:5" + (1 + i % 9), score: s, rules: rules, inviter: "luckyday88", inviterAddr: inviterA, friends: 0, days: i < 6 ? 1 : 0, points: i < 6 ? 200 : 0, cluster: "A" };
  });
  var mailsB = ["mi***01@naver.com", "mi***02@naver.com", "mi***03@naver.com", "mi***05@naver.com"], scoresB = [72, 69, 69, 64];
  var clusterB = scoresB.map(function (s, i) {
    return { addr: A("cb" + i), email: mailsB[i], joined: "17 Nov", score: s, rules: [{ k: "Look alike addresses", t: "4 emails that differ by a number only" }, { k: "Convert only", t: "Converted on day 8, 9 and 10 the minute the wait ended; 96% of points converted" }], inviter: "", friends: 0, days: 9, points: 180 - i * 30, cluster: "B" };
  });
  D.review = [{ addr: inviterA, email: "lu******88@gmail.com", name: "luckyday88", joined: "19 Nov", score: 71, rules: [{ k: "Sign up burst", t: "11 friends joined within 9 minutes today" }, { k: "Shared network", t: "Same network as 6 of those friends" }], inviter: "", friends: 14, days: 7, points: 3140, cluster: "A" }]
    .concat(clusterA, clusterB, [{ addr: A("single-1"), email: "t*******k@outlook.com", joined: "14 Nov", score: 53, rules: [{ k: "Convert only", t: "Converts every day at the cap of the day's points; no picks after the 5th" }], inviter: "noodle", inviterAddr: A("r7"), friends: 0, days: 12, points: 0 }]);
  D.clusterAfull = [{ addr: A("cax0"), score: 91, st: "Blocked" }, { addr: A("cax1"), score: 86, st: "Blocked" }, { addr: A("cax2"), score: 84, st: "Blocked" }].concat(clusterA.map(function (p) { return { addr: p.addr, score: p.score, st: "Review", rules: p.rules }; }));
  D.blocked = [
    { addr: A("cax0"), at: "Today 14:00", by: "Risk check", why: "Sign up burst, shared network, shared device, identical answers", score: 91, points: 200, ct: 0, inviter: "luckyday88", friends: 0 },
    { addr: A("cax1"), at: "Today 14:00", by: "Risk check", why: "Sign up burst, shared network, identical answers", score: 86, points: 200, ct: 0, inviter: "luckyday88", friends: 0 },
    { addr: A("cax2"), at: "Today 14:00", by: "Risk check", why: "Sign up burst, shared device, identical answers", score: 84, points: 200, ct: 0, inviter: "luckyday88", friends: 0 },
    { addr: A("bl4"), at: "Today 09:00", by: "Risk check", why: "Identical answer sequences and timing with 7 accounts for 5 days", score: 93, points: 2650, ct: 0, inviter: "", friends: 0 },
    { addr: A("bl5"), at: "Wed 25 Nov 21:14", by: "ops@cojam.app", why: "Reported by a player: sells invite sign ups. Confirmed 19 friends on one device.", score: 77, points: 5120, ct: 12, inviter: "", friends: 19 },
    { addr: A("frozen-w47", "5be0", "a113"), at: "Tue 24 Nov 16:00", by: "Risk check", why: "Shared device with 4 accounts, identical answers", score: 88, points: 8400, ct: 3.5, inviter: "", friends: 2 },
    { addr: A("bl7"), at: "Tue 24 Nov 11:00", by: "Risk check", why: "Convert only: 100% of points converted on 6 straight days", score: 82, points: 0, ct: 0, inviter: "kaia_whale", friends: 0 },
    { addr: A("bl8"), at: "Mon 23 Nov 10:00", by: "Risk check", why: "Sign up burst: 14 sign ups from one network in 1 hour", score: 85, points: 300, ct: 0, inviter: "", friends: 0 },
    { addr: A("bl9"), at: "Mon 23 Nov 10:00", by: "Risk check", why: "Sign up burst: 14 sign ups from one network in 1 hour", score: 85, points: 300, ct: 0, inviter: "", friends: 0 },
    { addr: A("bl10"), at: "Sun 22 Nov 03:00", by: "Risk check", why: "Look alike addresses: 9 emails that differ by a number only", score: 81, points: 1150, ct: 0, inviter: "", friends: 0 }
  ];
  D.inviters = [
    { name: "dalgona", addr: A("r1", "c41d", "07ae"), joined: 38, first: 31, active7: 68, life: 21480, week: 3120, score: 4, flag: "" },
    { name: "kaia_whale", addr: A("r5"), joined: 27, first: 22, active7: 64, life: 14960, week: 2210, score: 9, flag: "" },
    { name: "yuki.m", addr: A("r3"), joined: 19, first: 15, active7: 73, life: 9870, week: 1540, score: 6, flag: "" },
    { name: "luckyday88", addr: inviterA, joined: 14, first: 9, active7: null, life: 310, week: 240, score: 71, flag: "Cluster A" },
    { name: "noodle", addr: A("r7"), joined: 12, first: 9, active7: 58, life: 5230, week: 760, score: 12, flag: "" },
    { name: "0x03bd…e41a", addr: A("r10", "03bd", "e41a"), joined: 11, first: 4, active7: 18, life: 620, week: 110, score: 31, flag: "" },
    { name: "minji", addr: "0x7A3fC2b91E5d4086aB17c93D5E0f6A2948bD1C7e", joined: 4, first: 3, active7: 75, life: 1240, week: 85, score: 2, flag: "" },
    { name: "sora", addr: A("r11"), joined: 3, first: 3, active7: 100, life: 880, week: 60, score: 1, flag: "" }
  ];
  D.clusters = [
    { id: "A", inviter: "luckyday88", addr: inviterA, size: 11, blocked: 3, review: 8, signals: "Sign up burst (9 minutes), shared network (6), shared device (3), identical answers (4)", first: "Today 13:51" },
    { id: "B", inviter: "No inviter", addr: null, size: 4, blocked: 0, review: 4, signals: "Look alike addresses (4), convert only (4)", first: "17 Nov" }
  ];
})();
