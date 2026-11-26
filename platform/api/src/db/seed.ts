// npm run dev:seed: fills a local database with a plausible day for PWA and admin work against a local API.
// Today's 5 questions (EN, KO, JA text from platform/design/assets/mock.js), yesterday's resolved set with the
// dev player's picks, a weekly ranking, invites, staking positions and wallet history. Idempotent: rerun at will.
// Use with AUTH_DEV_BYPASS=1 (X-Dev-User: minji, X-Dev-Admin: dev@cojam.app) and DEV_CHAIN=stub for an offline chain.
// Refuses to run when NODE_ENV=production.
import { createDb, createPool, sql } from "./index.ts";
import { migrate } from "./migrate.ts";
import { devIdentity } from "../auth/privy.ts";
import { emailHash } from "../server/hash.ts";
import { currentDayId, dayEnd, weekOf } from "../../../shared/src/time.ts";
import type { MarketContent } from "./types.ts";

if (process.env.NODE_ENV === "production") {
  console.error("dev:seed refuses to run with NODE_ENV=production");
  process.exit(1);
}
const url = process.env.DATABASE_URL ?? "postgres://cojam:cojam@localhost:5432/cojam_dev";
const pool = createPool(url, 1);
await migrate(pool, (m) => console.log(m));
await pool.end();
const db = createDb(url);
const hashKey = process.env.EMAIL_HASH_KEY ?? "dev-email-key";

type Q = { cat: string; img: string; en: MarketContent["en"]; ko: MarketContent["ko"]; ja: MarketContent["ja"] };
const T = (title: string, left: string, right: string, rule: string, settle: string) => ({ title, left, right, rule, settle });
const today: Q[] = [
  {
    cat: "crypto",
    img: "q1-bitcoin.svg",
    en: T("Will Bitcoin close above $100,000 today?", "No", "Yes", "Binance BTC/USDT daily close, 00:00 UTC", "09:00 tomorrow"),
    ko: T("비트코인, 오늘 10만 달러 위에서 마감할까요?", "아니요", "예", "바이낸스 BTC/USDT 일봉 종가 (오전 9시)", "내일 오전 9시"),
    ja: T("ビットコイン、今日の終値は10万ドルを超える？", "超えない", "超える", "Binance BTC/USDTの日足終値（午前9時）", "明日の午前9時"),
  },
  {
    cat: "markets",
    img: "q2-dollar-won.svg",
    en: T("Will the dollar end today above 1,400 won?", "No", "Yes", "Seoul FX market close, 15:30 KST", "16:00 today"),
    ko: T("오늘 원/달러 환율, 1,400원 위에서 끝날까요?", "아니요", "예", "서울 외환시장 종가 (오후 3시 30분)", "오늘 오후 4시"),
    ja: T("今日のドル/ウォン、終値は1,400ウォンを上回る？", "上回らない", "上回る", "ソウル外国為替市場の終値（15時30分）", "今日の16時"),
  },
  {
    cat: "weather",
    img: "q3-seoul-weather.svg",
    en: T("Will Seoul reach 10°C or higher tomorrow?", "No", "Yes", "KMA Seoul station, daily high", "18:00 tomorrow"),
    ko: T("내일 서울 낮 기온, 10도까지 오를까요?", "아니요", "예", "기상청 서울 관측소 일 최고기온", "내일 오후 6시"),
    ja: T("明日のソウル、最高気温は10℃に届く？", "届かない", "届く", "韓国気象庁ソウル観測所の日最高気温", "明日の18時"),
  },
  {
    cat: "sports",
    img: "q4-football.svg",
    en: T("Tonight's Premier League match: 3 goals or more?", "2 or fewer", "3 or more", "Total goals at full time", "07:00 tomorrow"),
    ko: T("오늘 밤 프리미어리그 경기, 3골 이상 나올까요?", "2골 이하", "3골 이상", "정규 시간 90분 기준 합계 득점", "내일 오전 7시"),
    ja: T("今夜のプレミアリーグ、合計3点以上入る？", "2点以下", "3点以上", "90分終了時の合計得点", "明日の午前7時"),
  },
  {
    cat: "crypto",
    img: "q5-kaia.svg",
    en: T("Will KAIA be higher at 09:00 tomorrow than now?", "Lower", "Higher", "Binance KAIA/USDT price at 09:00 KST", "09:00 tomorrow"),
    ko: T("내일 오전 9시, KAIA는 지금보다 올라 있을까요?", "내린다", "오른다", "바이낸스 KAIA/USDT 오전 9시 가격", "내일 오전 9시"),
    ja: T("明日の朝9時、KAIAは今より上がっている？", "下がる", "上がる", "Binance KAIA/USDTの午前9時の価格", "明日の午前9時"),
  },
];
const P = (title: string, left: string, right: string) => T(title, left, right, "", "");
const yesterday: Q[] = [
  { cat: "crypto", img: "q1-bitcoin.svg", en: P("Will Ethereum close above $3,500 today?", "No", "Yes"), ko: P("이더리움, 오늘 3,500달러 위에서 마감할까요?", "아니요", "예"), ja: P("イーサリアム、今日の終値は3,500ドルを超える？", "超えない", "超える") },
  { cat: "markets", img: "q2-dollar-won.svg", en: P("Will the KOSPI close higher than yesterday?", "No", "Yes"), ko: P("오늘 코스피, 어제보다 높게 마감할까요?", "아니요", "예"), ja: P("今日のKOSPI、終値は前日を上回る？", "上回らない", "上回る") },
  { cat: "weather", img: "q3-seoul-weather.svg", en: P("Will it rain in Tokyo tomorrow?", "No", "Yes"), ko: P("내일 도쿄에 비가 올까요?", "아니요", "예"), ja: P("明日、東京で雨は降る？", "降らない", "降る") },
  { cat: "sports", img: "q4-football.svg", en: P("Will the home team win tonight's V-League match?", "No", "Yes"), ko: P("오늘 밤 V리그, 홈팀이 이길까요?", "아니요", "예"), ja: P("今夜のVリーグ、ホームチームは勝つ？", "勝たない", "勝つ") },
  { cat: "culture", img: "q5-kaia.svg", en: P("Will this week's box office No. 1 change?", "No", "Yes"), ko: P("이번 주 박스오피스 1위, 바뀔까요?", "아니요", "예"), ja: P("今週の映画ランキング、1位は入れ替わる？", "変わらない", "入れ替わる") },
];
for (const q of yesterday) for (const l of ["en", "ko", "ja"] as const) q[l].rule = q[l].rule || "Official source";

const now = Date.now();
const d0 = currentDayId(now);
const d1 = d0 - 1;
const week = weekOf(d0);
const imgBase = "/assets/img/"; // the PWA's own design images when IMAGE_BASE_URL is not used

async function putDay(day: number, qs: Q[], resolved: boolean) {
  await db.deleteFrom("markets").where("day_id", "=", day).execute();
  for (let slot = 0; slot < 5; slot++) {
    const q = qs[slot];
    await db
      .insertInto("markets")
      .values({
        market_id: day * 5 + slot,
        day_id: day,
        slot,
        category: q.cat,
        content: JSON.stringify({ en: q.en, ko: q.ko, ja: q.ja }),
        closes_at: new Date(dayEnd(day) * 1000),
        resolves_at: new Date((dayEnd(day) + 3600 * (slot + 1)) * 1000),
        sources: JSON.stringify([{ name: "Official source", url: "https://www.binance.com/en/trade/BTC_USDT", role: "primary" }]),
        criteria: q.en.rule,
        image_url: `${imgBase}${q.img}`,
        image_state: "generated",
        status: resolved ? "resolved" : "published",
        outcome: resolved ? (slot === 4 ? 3 : (slot % 2) + 1) : null,
        resolved_at: resolved ? new Date(now - 6 * 3600_000) : null,
        settles_at: resolved ? new Date(slot < 3 ? now - 3600_000 : now + 2 * 3600_000) : null,
        create_tx: `0x${"c".repeat(63)}${slot}`,
      })
      .execute();
  }
}
await putDay(d0, today, false);
await putDay(d1, yesterday, true);
await putDay(d0 + 1, today.map((q) => ({ ...q })), false);
await db.updateTable("markets").set({ status: "scheduled", create_tx: null }).where("day_id", "=", d0 + 1).execute();

// Players: the dev player "minji" plus a field for the ranking.
const names = ["minji", "dalgona", "yuki.m", "haneul", "kaia_whale", "noodle", "misaki", "jay.park", "sora", "bongbong", "held_account"];
const ids = names.map((n) => ({ n, ...devIdentity(n) }));
for (const [i, p] of ids.entries()) {
  await db
    .insertInto("users")
    .values({
      privy_user_id: p.privyUserId,
      wallet: p.wallet,
      email_domain: "gmail.com",
      email_hash: emailHash(hashKey, p.email),
      registration: "registered",
      registered_at: new Date(now - (i === 0 ? 3 * 3600_000 : (10 + i) * 86400_000)),
      display_name: i === 0 ? null : p.n,
      onboarded: i !== 0,
      frozen: p.n === "held_account",
      frozen_reason: p.n === "held_account" ? "device cluster" : null,
    })
    .onConflict((oc) => oc.column("privy_user_id").doNothing())
    .execute();
  const code = `DEV${String(i).padStart(2, "2")}AB`.replace(/[01]/g, "Z");
  await db.insertInto("invites").values({ code, wallet: p.wallet }).onConflict((oc) => oc.doNothing()).execute();
}
const me = ids[0].wallet;

// Yesterday: minji answered all five; three markets settled.
await db.deleteFrom("predictions").where("wallet", "=", me).execute();
await db.deleteFrom("points_ledger").where("tx_hash", "like", "0xseed%").execute();
await db.deleteFrom("user_days").where("wallet", "=", me).execute();
const choices = [1, 1, 2, 2, 1];
for (let s = 0; s < 5; s++) {
  await db.insertInto("predictions").values({ wallet: me, market_id: d1 * 5 + s, day_id: d1, choice: choices[s], answered: s + 1, tx_hash: `0xseedp${s}`, block: 100 + s }).execute();
}
await db.insertInto("user_days").values({ wallet: me, day_id: d1, answered: 5, completed: true, completed_at: new Date(now - 20 * 3600_000), settled_mask: 0b111, hits: 2, completion_points: 100, hit_points: 100 }).execute();
await db
  .insertInto("points_ledger")
  .values([
    { wallet: me, kind: "completion", amount: 100, day_id: d1, week_id: weekOf(d1), ranked: true, tx_hash: "0xseed1", log_index: 0 },
    { wallet: me, kind: "hits", amount: 100, day_id: d1, week_id: weekOf(d1), ranked: true, tx_hash: "0xseed2", log_index: 0 },
    { wallet: me, kind: "referral", amount: 15, day_id: d1, week_id: weekOf(d1), ranked: false, source_wallet: ids[1].wallet, tx_hash: "0xseed3", log_index: 0 },
  ])
  .execute();

// Weekly ranking (the held account has the most points and is left out of the prizes).
await db.deleteFrom("week_totals").where("week_id", "=", week).execute();
const pts = [200, 1400, 1350, 1300, 1300, 1250, 1150, 1100, 1100, 1000, 1500];
for (const [i, p] of ids.entries()) {
  await db.insertInto("week_totals").values({ week_id: week, wallet: p.wallet, points: pts[i], last_completion_at: new Date(now - (i + 1) * 3_600_000) }).execute();
}
await db
  .insertInto("weeks")
  .values({ week_id: week, qualified_players: 1284, pool: (1284n * 10n ** 18n).toString(), status: "open" })
  .onConflict((oc) => oc.column("week_id").doUpdateSet({ qualified_players: 1284 }))
  .execute();

// One friend invited by minji, staking positions and wallet history.
await db.insertInto("referrals").values({ invitee: ids[1].wallet, inviter: me, code: "DEV22AB", source: "first_run", bound_at: new Date(now - 2 * 3600_000), bonus_points: 15 }).onConflict((oc) => oc.doNothing()).execute();
await db.deleteFrom("stakes").where("wallet", "=", me).execute();
const CT = 10n ** 18n;
await db
  .insertInto("stakes")
  .values([
    { wallet: me, position_id: 0, principal: (1000n * CT).toString(), lock_index: 1, lock_days: 90, apr_bps: 1300, max_interest: "32054794520547945205", start_at: new Date(now - 21 * 86400_000), end_at: new Date(now + 69 * 86400_000) },
    { wallet: me, position_id: 1, principal: (500n * CT).toString(), lock_index: 0, lock_days: 30, apr_bps: 800, max_interest: "3287671232876712328", start_at: new Date(now - 31 * 86400_000), end_at: new Date(now - 86400_000) },
  ])
  .execute();
await db.deleteFrom("wallet_transfers").where("wallet", "=", me).execute();
await db
  .insertInto("wallet_transfers")
  .values([
    { tx_hash: "0xseedw1", log_index: 0, wallet: me, direction: "in", counterparty: "0x7a3fc2b91e5d4086ab17c93d5e0f6a2948bd1c7e", amount: (2000n * CT).toString(), kind: "transfer", block: 10, block_time: new Date(now - 3 * 86400_000) },
    { tx_hash: "0xseedw2", log_index: 0, wallet: me, direction: "out", counterparty: "0x0000000000000000000000000000000000000000", amount: (1000n * CT).toString(), kind: "stake", block: 11, block_time: new Date(now - 2 * 86400_000) },
  ])
  .execute();

// Admin: dev@cojam.app as owner (use X-Dev-Admin with AUTH_DEV_BYPASS=1), and a review entry.
await db.insertInto("admin_users").values({ privy_user_id: "email:dev@cojam.app", email: "dev@cojam.app", role: "owner", added_by: "dev:seed" }).onConflict((oc) => oc.doNothing()).execute();
await db.deleteFrom("risk_flags").where("details", "@>", sql`'{"seed":true}'::jsonb` as any).execute();
await db.insertInto("risk_flags").values({ wallet: ids[9].wallet, rule: "cluster_device", score: 62, details: JSON.stringify({ seed: true, device: "shared-device", members: 3 }) }).execute();

console.log(`seeded day ${d0} (today), ${d1} (resolved) and ${d0 + 1} (scheduled); week ${week}`);
console.log(`dev player: X-Dev-User: minji  wallet ${me}`);
console.log("dev admin:  X-Dev-Admin: dev@cojam.app");
await db.destroy();
