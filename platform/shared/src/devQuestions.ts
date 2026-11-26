// Example question sets for local development only: `npm run dev:seed` (platform/api) and the PWA mock adapter.
// They follow the founder's rule (DECISIONS "Question timing"): every question of a day closes at the day's end
// (09:00 KST next day) and its outcome becomes known only after that close, so each text asks about the day after
// the set opens ("tomorrow" seen from the set's day). Written natively in EN, KO and JA (examples from
// platform/design/admin/data.js). Never used by the real drafter.
import type { MarketText, MarketTexts } from "./api.ts";

export interface DevQuestion {
  key: string;
  category: "crypto" | "markets" | "weather" | "sports" | "culture";
  /** Card image under the PWA's /assets/img/, null for the category fallback. */
  img: string | null;
  /** Minutes after the day's end (09:00 KST next day) when the outcome is published. */
  resolveAfterMin: number;
  text: MarketTexts;
}

const T = (title: string, left: string, right: string, rule: string, settle: string): MarketText => ({ title, left, right, rule, settle });
const q = (key: string, category: DevQuestion["category"], img: string | null, resolveAfterMin: number, en: MarketText, ko: MarketText, ja: MarketText): DevQuestion => ({
  key,
  category,
  img,
  resolveAfterMin,
  text: { en, ko, ja },
});

const at21 = 12 * 60; // 21:00 KST on the day after the set
const coin = (key: string, img: string, sym: string, en: string, ko: string, ja: string) =>
  q(
    key,
    "crypto",
    img,
    at21,
    T(en, "No", "Yes", `Binance ${sym}/USDT price at 21:00 KST`, "21:00 tomorrow"),
    T(ko, "아니요", "예", `바이낸스 ${sym}/USDT 오후 9시 가격`, "내일 오후 9시"),
    T(ja, "超えない", "超える", `Binance ${sym}/USDTの21時の価格`, "明日の21時"),
  );
const high = (key: string, enCity: string, koCity: string, jaCity: string, deg: number, enSrc: string, koSrc: string, jaSrc: string) =>
  q(
    key,
    "weather",
    "q3-seoul-weather.svg",
    9 * 60,
    T(`Will ${enCity} reach ${deg}°C or higher tomorrow?`, "No", "Yes", `${enSrc}, daily high`, "18:00 tomorrow"),
    T(`내일 ${koCity} 낮 기온, ${deg}도까지 오를까요?`, "아니요", "예", `${koSrc} 일 최고기온`, "내일 오후 6시"),
    T(`明日の${jaCity}、最高気温は${deg}℃に届く？`, "届かない", "届く", `${jaSrc}の日最高気温`, "明日の18時"),
  );

/** Today's set (the deck). */
export const DEV_TODAY: DevQuestion[] = [
  coin("btc-100k", "q1-bitcoin.svg", "BTC", "Will Bitcoin be above $100,000 at 21:00 tomorrow?", "내일 밤 9시, 비트코인은 10만 달러 위에 있을까요?", "明日の21時、ビットコインは10万ドルを超えている？"),
  q(
    "usdkrw-1400",
    "markets",
    "q2-dollar-won.svg",
    7 * 60,
    T("Will the dollar end tomorrow above 1,400 won?", "No", "Yes", "Seoul FX market close, 15:30 KST", "16:00 tomorrow"),
    T("내일 원/달러 환율, 1,400원 위에서 끝날까요?", "아니요", "예", "서울 외환시장 종가 (오후 3시 30분)", "내일 오후 4시"),
    T("明日のドル/ウォン、終値は1,400ウォンを上回る？", "上回らない", "上回る", "ソウル外国為替市場の終値（15時30分）", "明日の16時"),
  ),
  high("seoul-10", "Seoul", "서울", "ソウル", 10, "KMA Seoul station", "기상청 서울 관측소", "韓国気象庁ソウル観測所"),
  q(
    "epl-3goals",
    "sports",
    "q4-football.svg",
    22 * 60,
    T("Tomorrow night's Premier League match: 3 goals or more?", "2 or fewer", "3 or more", "Total goals at full time", "07:00 in two days"),
    T("내일 밤 프리미어리그 경기, 3골 이상 나올까요?", "2골 이하", "3골 이상", "정규 시간 90분 기준 합계 득점", "모레 오전 7시"),
    T("明日夜のプレミアリーグ、合計3点以上入る？", "2点以下", "3点以上", "90分終了時の合計得点", "あさっての午前7時"),
  ),
  coin("xrp-250", "q5-kaia.svg", "XRP", "Will XRP be above $2.50 at 21:00 tomorrow?", "내일 밤 9시, XRP는 2.5달러 위에 있을까요?", "明日の21時、XRPは2.5ドルを超えている？"),
];

/** Yesterday's set (answered, partly resolved). */
export const DEV_YESTERDAY: DevQuestion[] = [
  coin("eth-3500", "q1-bitcoin.svg", "ETH", "Will Ethereum be above $3,500 at 21:00 tomorrow?", "내일 밤 9시, 이더리움은 3,500달러 위에 있을까요?", "明日の21時、イーサリアムは3,500ドルを超えている？"),
  q(
    "kospi-up",
    "markets",
    "q2-dollar-won.svg",
    6 * 60 + 40,
    T("Will the KOSPI close higher tomorrow than today?", "No", "Yes", "KRX KOSPI official close against the previous close", "15:40 tomorrow"),
    T("내일 코스피, 오늘보다 높게 마감할까요?", "아니요", "예", "한국거래소 코스피 공식 종가, 전일 종가 대비", "내일 오후 3시 40분"),
    T("明日のKOSPI、終値は今日を上回る？", "上回らない", "上回る", "韓国取引所KOSPIの公式終値（前日終値比）", "明日の15時40分"),
  ),
  q(
    "tokyo-rain",
    "weather",
    "q3-seoul-weather.svg",
    15 * 60 + 10,
    T("Will it rain in Tokyo tomorrow?", "No", "Yes", "JMA Tokyo station, 0.5 mm or more in the day", "00:10 in two days"),
    T("내일 도쿄에 비가 올까요?", "아니요", "예", "일본 기상청 도쿄 관측소, 하루 강수량 0.5mm 이상", "모레 0시 10분"),
    T("明日、東京で雨は降る？", "降らない", "降る", "気象庁・東京の日降水量0.5mm以上", "あさっての0時10分"),
  ),
  q(
    "vleague-home",
    "sports",
    "q4-football.svg",
    13 * 60,
    T("Will the home team win tomorrow night's V-League match?", "No", "Yes", "Official KOVO match result", "22:00 tomorrow"),
    T("내일 밤 V리그, 홈팀이 이길까요?", "아니요", "예", "KOVO 공식 경기 결과", "내일 오후 10시"),
    T("明日夜のVリーグ、ホームチームは勝つ？", "勝たない", "勝つ", "KOVO公式の試合結果", "明日の22時"),
  ),
  q(
    "boxoffice-change",
    "culture",
    null,
    25 * 60 + 30,
    T("Will the Korean box office No. 1 change tomorrow?", "No", "Yes", "KOBIS daily box office, tomorrow against today", "10:30 in two days"),
    T("내일 국내 박스오피스 1위, 바뀔까요?", "아니요", "예", "영화진흥위원회 통합전산망 일별 박스오피스 (오늘 대비 내일)", "모레 오전 10시 30분"),
    T("明日の韓国の映画興行ランキング、1位は入れ替わる？", "変わらない", "入れ替わる", "韓国映画振興委員会（KOBIS）の日別興行成績（今日と明日を比較）", "あさっての午前10時30分"),
  ),
];

/** The set before (resolved and settled). */
export const DEV_EARLIER: DevQuestion[] = [
  coin("btc-98k", "q1-bitcoin.svg", "BTC", "Will Bitcoin be above $98,000 at 21:00 tomorrow?", "내일 밤 9시, 비트코인은 9만 8천 달러 위에 있을까요?", "明日の21時、ビットコインは9万8千ドルを超えている？"),
  q(
    "nikkei-40k",
    "markets",
    "q2-dollar-won.svg",
    6 * 60 + 40,
    T("Will the Nikkei 225 close above 40,000 tomorrow?", "No", "Yes", "Nikkei 225 official close", "15:40 tomorrow"),
    T("내일 닛케이 225, 4만 선 위에서 마감할까요?", "아니요", "예", "닛케이 225 공식 종가", "내일 오후 3시 40분"),
    T("明日の日経平均、終値は4万円を超える？", "超えない", "超える", "日経平均株価の終値", "明日の15時40分"),
  ),
  q(
    "seoul-below0",
    "weather",
    "q3-seoul-weather.svg",
    9 * 60,
    T("Will Seoul drop below 0°C tomorrow?", "No", "Yes", "KMA Seoul station, daily low", "18:00 tomorrow"),
    T("내일 서울, 영하로 내려갈까요?", "아니요", "예", "기상청 서울 관측소 일 최저기온", "내일 오후 6시"),
    T("明日のソウル、氷点下まで下がる？", "下がらない", "下がる", "韓国気象庁ソウル観測所の日最低気温", "明日の18時"),
  ),
  q(
    "epl-btts",
    "sports",
    "q4-football.svg",
    22 * 60,
    T("Will both teams score in tomorrow night's Premier League match?", "No", "Yes", "Goals by both teams at full time", "07:00 in two days"),
    T("내일 밤 프리미어리그, 두 팀 모두 골을 넣을까요?", "아니요", "예", "정규 시간 종료 기준 양 팀 득점", "모레 오전 7시"),
    T("明日夜のプレミアリーグ、両チームとも得点する？", "しない", "する", "試合終了時点の両チームの得点", "あさっての午前7時"),
  ),
  coin("kaia-015", "q5-kaia.svg", "KAIA", "Will KAIA be above $0.15 at 21:00 tomorrow?", "내일 밤 9시, KAIA는 0.15달러 위에 있을까요?", "明日の21時、KAIAは0.15ドルを超えている？"),
];

/** Markets are shut on Saturday and Sunday: a set whose next day is a weekend uses one of these instead (DECISIONS "Drafting schedule"). */
export const DEV_WEEKEND_SWAP: DevQuestion[] = [
  high("tokyo-15", "Tokyo", "도쿄", "東京", 15, "JMA Tokyo station", "일본 기상청 도쿄 관측소", "気象庁・東京"),
  high("osaka-15", "Osaka", "오사카", "大阪", 15, "JMA Osaka station", "일본 기상청 오사카 관측소", "気象庁・大阪"),
  high("busan-15", "Busan", "부산", "釜山", 15, "KMA Busan station", "기상청 부산 관측소", "韓国気象庁釜山観測所"),
];

/** True when the day after `dayId` (the day its outcomes fall on) is a Saturday or Sunday in KST. */
export function outcomeDayIsWeekend(dayId: number): boolean {
  // dayId * 86400 is 09:00 KST, so the UTC date of (dayId + 1) * 86400 is the KST date of the next day.
  const dow = new Date((dayId + 1) * 86_400_000).getUTCDay();
  return dow === 0 || dow === 6;
}

/** One of the sets for a given day, with the market question swapped out when its outcome falls on a weekend. */
export function devSet(which: "today" | "yesterday" | "earlier", dayId: number): DevQuestion[] {
  const i = which === "today" ? 0 : which === "yesterday" ? 1 : 2;
  const set = [DEV_TODAY, DEV_YESTERDAY, DEV_EARLIER][i];
  if (!outcomeDayIsWeekend(dayId)) return set;
  return set.map((x) => (x.category === "markets" ? DEV_WEEKEND_SWAP[i] : x));
}
