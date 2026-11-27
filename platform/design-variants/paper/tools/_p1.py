import io, re
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8').write(s)

# ---------------- mock.js: example questions that follow the decided rule (outcome known only after the day ends at 09:00 KST) ----------------
p = 'assets/mock.js'; s = rd(p)
a = s.index('    questions: {'); b = s.index('    set: ["q1"')
def coin(sym, en, ko, ja):
    return ('en: { title: "%s", left: "No", right: "Yes", rule: "Binance %s/USDT price at 21:00 KST", settle: "21:00 tomorrow" },\n'
            '        ko: { title: "%s", left: "아니요", right: "예", rule: "바이낸스 %s/USDT 오후 9시 가격", settle: "내일 오후 9시" },\n'
            '        ja: { title: "%s", left: "超えない", right: "超える", rule: "Binance %s/USDTの21時の価格", settle: "明日の21時" } }') % (en, sym, ko, sym, ja, sym)
def q(en, ko, ja):
    f = lambda t: '{ title: "%s", left: "%s", right: "%s", rule: "%s", settle: "%s" }' % t
    return 'en: %s,\n        ko: %s,\n        ja: %s }' % (f(en), f(ko), f(ja))
Q = '''    /* Example questions, the compliant sets of platform/shared/src/devQuestions.ts (DEV_TODAY, DEV_YESTERDAY, DEV_EARLIER).
       Rule: every question of a day closes at the day's end (09:00 KST the next day) and its outcome becomes known only after that close,
       so each text asks about the day after the set opens. Authored per language, not translated word for word. */
    questions: {
      q1: { n: 1, img: "assets/img/q1-bitcoin.svg", cat: "crypto", focus: "50% 14%",
        ''' + coin("BTC", "Will Bitcoin be above $100,000 at 21:00 tomorrow?", "내일 밤 9시, 비트코인은 10만 달러 위에 있을까요?", "明日の21時、ビットコインは10万ドルを超えている？") + ''',
      q2: { n: 2, img: "assets/img/q2-dollar-won.svg", cat: "markets", focus: "42% 10%",
        ''' + q(("Will the dollar end tomorrow above 1,400 won?", "No", "Yes", "Seoul FX market close, 15:30 KST", "16:00 tomorrow"),
                ("내일 원/달러 환율, 1,400원 위에서 끝날까요?", "아니요", "예", "서울 외환시장 종가 (오후 3시 30분)", "내일 오후 4시"),
                ("明日のドル/ウォン、終値は1,400ウォンを上回る？", "上回らない", "上回る", "ソウル外国為替市場の終値（15時30分）", "明日の16時")) + ''',
      q3: { n: 3, img: "assets/img/q3-seoul-weather.svg", cat: "weather", focus: "50% 8%",
        ''' + q(("Will Seoul reach 10°C or higher tomorrow?", "No", "Yes", "KMA Seoul station, daily high", "18:00 tomorrow"),
                ("내일 서울 낮 기온, 10도까지 오를까요?", "아니요", "예", "기상청 서울 관측소 일 최고기온", "내일 오후 6시"),
                ("明日のソウル、最高気温は10℃に届く？", "届かない", "届く", "韓国気象庁ソウル観測所の日最高気温", "明日の18時")) + ''',
      q4: { n: 4, img: "assets/img/q4-football.svg", cat: "sports", focus: "50% 20%",
        ''' + q(("Tomorrow night's Premier League match: 3 goals or more?", "2 or fewer", "3 or more", "Total goals at full time", "07:00 in two days"),
                ("내일 밤 프리미어리그 경기, 3골 이상 나올까요?", "2골 이하", "3골 이상", "정규 시간 90분 기준 합계 득점", "모레 오전 7시"),
                ("明日夜のプレミアリーグ、合計3点以上入る？", "2点以下", "3点以上", "90分終了時の合計得点", "あさっての午前7時")) + ''',
      q5: { n: 5, img: "assets/img/q5-kaia.svg", cat: "crypto", focus: "50% 22%",
        ''' + coin("XRP", "Will XRP be above $2.50 at 21:00 tomorrow?", "내일 밤 9시, XRP는 2.5달러 위에 있을까요?", "明日の21時、XRPは2.5ドルを超えている？") + ''',
      /* earlier days, shown on Results: yesterday's set (p1 to p5) and the set before (p6 to p10) */
      p1: { cat: "crypto",
        ''' + coin("ETH", "Will Ethereum be above $3,500 at 21:00 tomorrow?", "내일 밤 9시, 이더리움은 3,500달러 위에 있을까요?", "明日の21時、イーサリアムは3,500ドルを超えている？") + ''',
      p2: { cat: "markets",
        ''' + q(("Will the KOSPI close higher tomorrow than today?", "No", "Yes", "KRX KOSPI official close against the previous close", "15:40 tomorrow"),
                ("내일 코스피, 오늘보다 높게 마감할까요?", "아니요", "예", "한국거래소 코스피 공식 종가, 전일 종가 대비", "내일 오후 3시 40분"),
                ("明日のKOSPI、終値は今日を上回る？", "上回らない", "上回る", "韓国取引所KOSPIの公式終値（前日終値比）", "明日の15時40分")) + ''',
      p3: { cat: "weather",
        ''' + q(("Will it rain in Tokyo tomorrow?", "No", "Yes", "JMA Tokyo station, 0.5 mm or more in the day", "00:10 in two days"),
                ("내일 도쿄에 비가 올까요?", "아니요", "예", "일본 기상청 도쿄 관측소, 하루 강수량 0.5mm 이상", "모레 0시 10분"),
                ("明日、東京で雨は降る？", "降らない", "降る", "気象庁・東京の日降水量0.5mm以上", "あさっての0時10分")) + ''',
      p4: { cat: "sports",
        ''' + q(("Will the home team win tomorrow night's V-League match?", "No", "Yes", "Official KOVO match result", "22:00 tomorrow"),
                ("내일 밤 V리그, 홈팀이 이길까요?", "아니요", "예", "KOVO 공식 경기 결과", "내일 오후 10시"),
                ("明日夜のVリーグ、ホームチームは勝つ？", "勝たない", "勝つ", "KOVO公式の試合結果", "明日の22時")) + ''',
      p5: { cat: "culture",
        ''' + q(("Will the Korean box office No. 1 change tomorrow?", "No", "Yes", "KOBIS daily box office, tomorrow against today", "10:30 in two days"),
                ("내일 국내 박스오피스 1위, 바뀔까요?", "아니요", "예", "영화진흥위원회 통합전산망 일별 박스오피스 (오늘 대비 내일)", "모레 오전 10시 30분"),
                ("明日の韓国の映画興行ランキング、1位は入れ替わる？", "変わらない", "入れ替わる", "韓国映画振興委員会（KOBIS）の日別興行成績（今日と明日を比較）", "あさっての午前10時30分")) + ''',
      p6: { cat: "crypto",
        ''' + coin("BTC", "Will Bitcoin be above $98,000 at 21:00 tomorrow?", "내일 밤 9시, 비트코인은 9만 8천 달러 위에 있을까요?", "明日の21時、ビットコインは9万8千ドルを超えている？") + ''',
      p7: { cat: "markets",
        ''' + q(("Will the Nikkei 225 close above 40,000 tomorrow?", "No", "Yes", "Nikkei 225 official close", "15:40 tomorrow"),
                ("내일 닛케이 225, 4만 선 위에서 마감할까요?", "아니요", "예", "닛케이 225 공식 종가", "내일 오후 3시 40분"),
                ("明日の日経平均、終値は4万円を超える？", "超えない", "超える", "日経平均株価の終値", "明日の15時40分")) + ''',
      p8: { cat: "weather",
        ''' + q(("Will Seoul drop below 0°C tomorrow?", "No", "Yes", "KMA Seoul station, daily low", "18:00 tomorrow"),
                ("내일 서울, 영하로 내려갈까요?", "아니요", "예", "기상청 서울 관측소 일 최저기온", "내일 오후 6시"),
                ("明日のソウル、氷点下まで下がる？", "下がらない", "下がる", "韓国気象庁ソウル観測所の日最低気温", "明日の18時")) + ''',
      p9: { cat: "sports",
        ''' + q(("Will both teams score in tomorrow night's Premier League match?", "No", "Yes", "Goals by both teams at full time", "07:00 in two days"),
                ("내일 밤 프리미어리그, 두 팀 모두 골을 넣을까요?", "아니요", "예", "정규 시간 종료 기준 양 팀 득점", "모레 오전 7시"),
                ("明日夜のプレミアリーグ、両チームとも得点する？", "しない", "する", "試合終了時点の両チームの得点", "あさっての午前7時")) + ''',
      p10: { cat: "crypto",
        ''' + coin("KAIA", "Will KAIA be above $0.15 at 21:00 tomorrow?", "내일 밤 9시, KAIA는 0.15달러 위에 있을까요?", "明日の21時、KAIAは0.15ドルを超えている？") + '''
    },
'''
s = s[:a] + Q + s[b:]
# results: today's set cannot have an answer yet (all waiting); the pending hit belongs to yesterday's set
a = s.index('    results: ['); b = s.index('    /* the answer source of each earlier question')
R = '''    /* Results. Today's set has no answer yet (its outcomes fall after 09:00 KST tomorrow): every row waits. Yesterday's set is being answered today:
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
'''
s = s[:a] + R + s[b:]
a = s.index('    /* the answer source of each earlier question'); b = s.index('    /* Friend invites.')
s = s[:a] + '    pastRules: {},   /* every example question now carries its own source (rule) in the three languages */\n' + s[b:]
s = s.replace('days: { 0: { pts: 15, n: 1 }, 1: { pts: 35, n: 2 }, 2: { pts: 35, n: 2 } }', 'days: { 0: { pts: 15, n: 1 }, 1: { pts: 35, n: 2 }, 2: { pts: 35, n: 2 } }')
s = s.replace("/* Mock data for the static design.", "/* Mock data for the static design (copied from platform/design/assets/mock.js; the example questions and the results rows were replaced, see below).")
wr(p, s)
print('mock ok')
