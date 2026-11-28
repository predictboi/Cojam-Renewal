// Example question sets for local development only: `npm run dev:seed` (platform/api) and the PWA mock adapter.
// They follow the founder's rule (DECISIONS "Question timing"): every question of a day closes at the day's end
// (09:00 KST next day) and its outcome becomes known only after that close, so each text asks about the day after
// the set opens (the set's settle date). Texts never use relative day words such as "tomorrow" or "내일": a past
// question is shown again on the Results screen days later, so every title and settle phrase names the KST date
// with its weekday ("Sun, Nov 29" / "11월 29일(일)" / "11月29日(日)"), built from the set's day by `devQuestionsForDay`.
// Written natively in EN, KO and JA (examples from platform/design/admin/data.js). Never used by the real drafter.
import type { MarketText, MarketTexts } from "./api.ts";
import { currentDayId, dayEnd, kstDateLabels, settleDateLabels, type KstDateLabels } from "./time.ts";

export interface DevQuestion {
  key: string;
  category: "crypto" | "markets" | "weather" | "sports" | "culture";
  /** Card image under the PWA's /assets/img/, null for the category fallback. */
  img: string | null;
  /** Minutes after the day's end (09:00 KST next day) when the outcome is published. */
  resolveAfterMin: number;
  text: MarketTexts;
}

export interface DevQuestionSets {
  /** The set shown as today's deck. */
  today: DevQuestion[];
  /** The set shown as yesterday's (answered, partly resolved). */
  yesterday: DevQuestion[];
  /** The set before (resolved and settled). */
  earlier: DevQuestion[];
  /** Weather questions that replace the market question when the outcomes fall on a weekend, one per set above. */
  weekendSwap: DevQuestion[];
}

const T = (title: string, left: string, right: string, rule: string, settle: string): MarketText => ({ title, left, right, rule, settle });
const q = (key: string, category: DevQuestion["category"], img: string | null, resolveAfterMin: number, en: MarketText, ko: MarketText, ja: MarketText): DevQuestion => ({
  key,
  category,
  img,
  resolveAfterMin,
  text: { en, ko, ja },
});

const at21 = 12 * 60; // 21:00 KST on the set's settle date

/**
 * Every dev question with its texts dated for the set of `dayId`: `d` is the set's settle date (the day after it
 * opens), `n` the date after that, for answers read after midnight KST.
 */
export function devQuestionsForDay(dayId: number): DevQuestionSets {
  const d: KstDateLabels = settleDateLabels(dayId);
  const n: KstDateLabels = kstDateLabels(dayEnd(dayId) + 86_400);

  /** A crypto price at 21:00 KST. `ko` carries its particle ("비트코인은"). */
  const coin = (key: string, img: string, sym: string, en: [name: string, price: string], ko: [subject: string, price: string], ja: [name: string, price: string]) =>
    q(
      key,
      "crypto",
      img,
      at21,
      T(`Will ${en[0]} be above ${en[1]} at 21:00 KST on ${d.en}?`, "No", "Yes", `Binance ${sym}/USDT price at 21:00 KST`, `21:00 KST on ${d.en}`),
      T(`${d.ko} 오후 9시, ${ko[0]} ${ko[1]} 위에 있을까요?`, "아니요", "예", `바이낸스 ${sym}/USDT 오후 9시 가격`, `${d.ko} 오후 9시`),
      T(`${d.ja}21時、${ja[0]}は${ja[1]}を超えている？`, "超えない", "超える", `Binance ${sym}/USDTの21時の価格`, `${d.ja}21時`),
    );
  const high = (key: string, enCity: string, koCity: string, jaCity: string, deg: number, enSrc: string, koSrc: string, jaSrc: string) =>
    q(
      key,
      "weather",
      "q3-seoul-weather.svg",
      9 * 60,
      T(`Will ${enCity} reach ${deg}°C or higher on ${d.en}?`, "No", "Yes", `${enSrc}, daily high`, `18:00 KST on ${d.en}`),
      T(`${d.ko} ${koCity} 낮 기온, ${deg}도까지 오를까요?`, "아니요", "예", `${koSrc} 일 최고기온`, `${d.ko} 오후 6시`),
      T(`${d.ja}の${jaCity}、最高気温は${deg}℃に届く？`, "届かない", "届く", `${jaSrc}の日最高気温`, `${d.ja}18時`),
    );

  const today: DevQuestion[] = [
    coin("btc-100k", "q1-bitcoin.svg", "BTC", ["Bitcoin", "$100,000"], ["비트코인은", "10만 달러"], ["ビットコイン", "10万ドル"]),
    q(
      "usdkrw-1400",
      "markets",
      "q2-dollar-won.svg",
      7 * 60,
      T(`Will the dollar end above 1,400 won on ${d.en}?`, "No", "Yes", "Seoul FX market close, 15:30 KST", `16:00 KST on ${d.en}`),
      T(`${d.ko} 원/달러 환율, 1,400원 위에서 끝날까요?`, "아니요", "예", "서울 외환시장 종가 (오후 3시 30분)", `${d.ko} 오후 4시`),
      T(`${d.ja}のドル/ウォン、終値は1,400ウォンを上回る？`, "上回らない", "上回る", "ソウル外国為替市場の終値（15時30分）", `${d.ja}16時`),
    ),
    high("seoul-10", "Seoul", "서울", "ソウル", 10, "KMA Seoul station", "기상청 서울 관측소", "韓国気象庁ソウル観測所"),
    q(
      "epl-3goals",
      "sports",
      "q4-football.svg",
      22 * 60,
      T(`Premier League at 05:00 KST on ${n.en}: 3 goals or more?`, "2 or fewer", "3 or more", "Total goals at full time", `07:00 KST on ${n.en}`),
      T(`${n.ko} 오전 5시 프리미어리그, 3골 이상 나올까요?`, "2골 이하", "3골 이상", "정규 시간 90분 기준 합계 득점", `${n.ko} 오전 7시`),
      T(`${n.ja}5時のプレミアリーグ、合計3点以上入る？`, "2点以下", "3点以上", "90分終了時の合計得点", `${n.ja}7時`),
    ),
    coin("xrp-250", "q5-kaia.svg", "XRP", ["XRP", "$2.50"], ["XRP는", "2.5달러"], ["XRP", "2.5ドル"]),
  ];

  const yesterday: DevQuestion[] = [
    coin("eth-3500", "q1-bitcoin.svg", "ETH", ["Ethereum", "$3,500"], ["이더리움은", "3,500달러"], ["イーサリアム", "3,500ドル"]),
    q(
      "kospi-up",
      "markets",
      "q2-dollar-won.svg",
      6 * 60 + 40,
      T(`Will the KOSPI close higher on ${d.en} than the day before?`, "No", "Yes", "KRX KOSPI official close against the previous close", `15:40 KST on ${d.en}`),
      T(`${d.ko} 코스피, 전일보다 높게 마감할까요?`, "아니요", "예", "한국거래소 코스피 공식 종가, 전일 종가 대비", `${d.ko} 오후 3시 40분`),
      T(`${d.ja}のKOSPI、終値は前日を上回る？`, "上回らない", "上回る", "韓国取引所KOSPIの公式終値（前日終値比）", `${d.ja}15時40分`),
    ),
    q(
      "tokyo-rain",
      "weather",
      "q3-seoul-weather.svg",
      15 * 60 + 10,
      T(`Will it rain in Tokyo on ${d.en}?`, "No", "Yes", "JMA Tokyo station, 0.5 mm or more in the day", `00:10 KST on ${n.en}`),
      T(`${d.ko} 도쿄에 비가 올까요?`, "아니요", "예", "일본 기상청 도쿄 관측소, 하루 강수량 0.5mm 이상", `${n.ko} 0시 10분`),
      T(`${d.ja}、東京で雨は降る？`, "降らない", "降る", "気象庁・東京の日降水量0.5mm以上", `${n.ja}0時10分`),
    ),
    q(
      "vleague-home",
      "sports",
      "q4-football.svg",
      13 * 60,
      T(`Will the home team win the V-League match on ${d.en}?`, "No", "Yes", "Official KOVO match result", `22:00 KST on ${d.en}`),
      T(`${d.ko} V리그 경기, 홈팀이 이길까요?`, "아니요", "예", "KOVO 공식 경기 결과", `${d.ko} 오후 10시`),
      T(`${d.ja}のVリーグ、ホームチームは勝つ？`, "勝たない", "勝つ", "KOVO公式の試合結果", `${d.ja}22時`),
    ),
    q(
      "boxoffice-change",
      "culture",
      null,
      25 * 60 + 30,
      T(`Will the Korean box office No. 1 change on ${d.en}?`, "No", "Yes", "KOBIS daily box office against the day before", `10:30 KST on ${n.en}`),
      T(`${d.ko} 국내 박스오피스 1위, 바뀔까요?`, "아니요", "예", "영화진흥위원회 통합전산망 일별 박스오피스 (전일 대비)", `${n.ko} 오전 10시 30분`),
      T(`${d.ja}の韓国映画興行ランキング、1位は入れ替わる？`, "変わらない", "入れ替わる", "韓国映画振興委員会（KOBIS）の日別興行成績（前日比）", `${n.ja}10時30分`),
    ),
  ];

  const earlier: DevQuestion[] = [
    coin("btc-98k", "q1-bitcoin.svg", "BTC", ["Bitcoin", "$98,000"], ["비트코인은", "9만 8천 달러"], ["ビットコイン", "9万8千ドル"]),
    q(
      "nikkei-40k",
      "markets",
      "q2-dollar-won.svg",
      6 * 60 + 40,
      T(`Will the Nikkei 225 close above 40,000 on ${d.en}?`, "No", "Yes", "Nikkei 225 official close", `15:40 KST on ${d.en}`),
      T(`${d.ko} 닛케이 225, 4만 선 위에서 마감할까요?`, "아니요", "예", "닛케이 225 공식 종가", `${d.ko} 오후 3시 40분`),
      T(`${d.ja}の日経平均、終値は4万円を超える？`, "超えない", "超える", "日経平均株価の終値", `${d.ja}15時40分`),
    ),
    q(
      "seoul-below0",
      "weather",
      "q3-seoul-weather.svg",
      9 * 60,
      T(`Will Seoul drop below 0°C on ${d.en}?`, "No", "Yes", "KMA Seoul station, daily low", `18:00 KST on ${d.en}`),
      T(`${d.ko} 서울, 영하로 내려갈까요?`, "아니요", "예", "기상청 서울 관측소 일 최저기온", `${d.ko} 오후 6시`),
      T(`${d.ja}のソウル、氷点下まで下がる？`, "下がらない", "下がる", "韓国気象庁ソウル観測所の日最低気温", `${d.ja}18時`),
    ),
    q(
      "epl-btts",
      "sports",
      "q4-football.svg",
      22 * 60,
      T(`Premier League at 05:00 KST on ${n.en}: will both teams score?`, "No", "Yes", "Goals by both teams at full time", `07:00 KST on ${n.en}`),
      T(`${n.ko} 오전 5시 프리미어리그, 두 팀 모두 골을 넣을까요?`, "아니요", "예", "정규 시간 종료 기준 양 팀 득점", `${n.ko} 오전 7시`),
      T(`${n.ja}5時のプレミアリーグ、両チームとも得点する？`, "しない", "する", "試合終了時点の両チームの得点", `${n.ja}7時`),
    ),
    coin("kaia-015", "q5-kaia.svg", "KAIA", ["KAIA", "$0.15"], ["KAIA는", "0.15달러"], ["KAIA", "0.15ドル"]),
  ];

  const weekendSwap: DevQuestion[] = [
    high("tokyo-15", "Tokyo", "도쿄", "東京", 15, "JMA Tokyo station", "일본 기상청 도쿄 관측소", "気象庁・東京"),
    high("osaka-15", "Osaka", "오사카", "大阪", 15, "JMA Osaka station", "일본 기상청 오사카 관측소", "気象庁・大阪"),
    high("busan-15", "Busan", "부산", "釜山", 15, "KMA Busan station", "기상청 부산 관측소", "韓国気象庁釜山観測所"),
  ];

  return { today, yesterday, earlier, weekendSwap };
}

// The fixed exports below are dated from the current day when the module loads (the PWA mock adapter shows them as
// today's, yesterday's and the earlier set). Use `devSet` or `devQuestionsForDay` for a given day.
const loadDay = currentDayId();

/** Today's set (the deck), dated for the current day. */
export const DEV_TODAY: DevQuestion[] = devQuestionsForDay(loadDay).today;

/** Yesterday's set (answered, partly resolved), dated for the day before the current one. */
export const DEV_YESTERDAY: DevQuestion[] = devQuestionsForDay(loadDay - 1).yesterday;

/** The set before (resolved and settled), dated for two days before the current one. */
export const DEV_EARLIER: DevQuestion[] = devQuestionsForDay(loadDay - 2).earlier;

/** Markets are shut on Saturday and Sunday: a set whose next day is a weekend uses one of these instead (DECISIONS "Drafting schedule"). Dated for the current day. */
export const DEV_WEEKEND_SWAP: DevQuestion[] = devQuestionsForDay(loadDay).weekendSwap;

/** True when the day after `dayId` (the day its outcomes fall on) is a Saturday or Sunday in KST. */
export function outcomeDayIsWeekend(dayId: number): boolean {
  // dayId * 86400 is 09:00 KST, so the UTC date of (dayId + 1) * 86400 is the KST date of the next day.
  const dow = new Date((dayId + 1) * 86_400_000).getUTCDay();
  return dow === 0 || dow === 6;
}

/** One of the sets for a given day, dated for that day, with the market question swapped out when its outcome falls on a weekend. */
export function devSet(which: "today" | "yesterday" | "earlier", dayId: number): DevQuestion[] {
  const i = which === "today" ? 0 : which === "yesterday" ? 1 : 2;
  const sets = devQuestionsForDay(dayId);
  const set = sets[which];
  if (!outcomeDayIsWeekend(dayId)) return set;
  return set.map((x) => (x.category === "markets" ? sets.weekendSwap[i] : x));
}
