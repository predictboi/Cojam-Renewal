// npm run dev:seed: fills a local database with a plausible day for PWA and admin work against a local API.
// Today's 5 questions, yesterday's set (resolved where its outcome time has passed) and the set before, with the
// dev player's picks (question texts: platform/shared/src/devQuestions.ts, they follow the timing rule), a weekly ranking, invites, staking positions and wallet history. Idempotent: rerun at will.
// Use with AUTH_DEV_BYPASS=1 (X-Dev-User: minji, X-Dev-Admin: dev@cojam.app) and DEV_CHAIN=stub for an offline chain.
// Refuses to run when NODE_ENV=production.
import { createDb, createPool, sql } from "./index.ts";
import { migrate } from "./migrate.ts";
import { devIdentity } from "../auth/privy.ts";
import { emailHash } from "../server/hash.ts";
import { currentDayId, dayEnd, weekOf } from "../../../shared/src/time.ts";
import { devSet } from "../../../shared/src/devQuestions.ts";

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

// Question sets that follow the timing rule (outcome known only after the day ends): platform/shared/src/devQuestions.ts.
const now = Date.now();
const d0 = currentDayId(now);
const d1 = d0 - 1;
const d2 = d0 - 2;
const week = weekOf(d0);
const imgBase = "/assets/img/"; // the PWA's own design images when IMAGE_BASE_URL is not used
const SOURCES: Record<string, { name: string; url: string }> = {
  crypto: { name: "Binance", url: "https://www.binance.com/en/markets/overview" },
  markets: { name: "KRX", url: "https://data.krx.co.kr/" },
  weather: { name: "KMA / JMA", url: "https://www.weather.go.kr/" },
  sports: { name: "Match centre", url: "https://www.premierleague.com/matches" },
  culture: { name: "KOBIS", url: "https://www.kobis.or.kr/" },
};
/** Outcomes the seed decides for the resolved sets (3 = void). */
const OUTCOMES: Record<number, number[]> = { [d1]: [1, 2, 2, 2, 1], [d2]: [2, 2, 1, 1, 3] };

/** Puts a day on the index. A market counts as resolved 5 minutes after its resolve time when that is in the past. */
async function putDay(day: number, which: "today" | "yesterday" | "earlier", status: "published" | "scheduled" | "auto") {
  await db.deleteFrom("evidence").where("resolution_id", "in", db.selectFrom("resolutions").select("id").where("market_id", ">=", day * 5).where("market_id", "<", day * 5 + 5)).execute();
  await db.deleteFrom("resolutions").where("market_id", ">=", day * 5).where("market_id", "<", day * 5 + 5).execute();
  await db.deleteFrom("markets").where("day_id", "=", day).execute();
  const qs = devSet(which, day);
  for (let slot = 0; slot < 5; slot++) {
    const q = qs[slot];
    const resolvesAt = (dayEnd(day) + q.resolveAfterMin * 60) * 1000;
    const resolved = status === "auto" && resolvesAt + 5 * 60_000 < now;
    const resolvedAt = resolved ? new Date(resolvesAt + 5 * 60_000) : null;
    const outcome = resolved ? (OUTCOMES[day]?.[slot] ?? 1) : null;
    const src = SOURCES[q.category];
    await db
      .insertInto("markets")
      .values({
        market_id: day * 5 + slot,
        day_id: day,
        slot,
        category: q.category,
        content: JSON.stringify(q.text),
        closes_at: new Date(dayEnd(day) * 1000),
        resolves_at: new Date(resolvesAt),
        sources: JSON.stringify([{ ...src, role: "primary" }]),
        criteria: q.text.en.rule,
        image_url: q.img ? `${imgBase}${q.img}` : null,
        image_state: q.img ? "generated" : "fallback",
        status: status === "scheduled" ? "scheduled" : status === "published" ? "published" : resolved ? (outcome === 3 ? "voided" : "resolved") : "closed",
        outcome,
        resolved_at: resolvedAt,
        settles_at: resolvedAt ? new Date(resolvedAt.getTime() + 6 * 3600_000) : null,
        create_tx: status === "scheduled" ? null : `0x${"c".repeat(62)}${String(slot).padStart(2, "0")}`,
      })
      .execute();
    if (resolved && outcome !== null) {
      const r = await db
        .insertInto("resolutions")
        .values({ market_id: day * 5 + slot, run: "1", outcome: outcome === 1 ? "A" : outcome === 2 ? "B" : "void", confidence: "0.97", reasoning: `Seeded answer from ${src.name}.` })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db.insertInto("evidence").values({ resolution_id: r.id, url: src.url, quote: "seeded evidence", observed_at: resolvedAt }).execute();
    }
  }
}
await putDay(d0, "today", "published");
await putDay(d1, "yesterday", "auto");
await putDay(d2, "earlier", "auto");
await putDay(d0 + 1, "today", "scheduled");

// Players: the dev player "minji" plus a field for the ranking. A rerun resets minji (name, language, hold,
// inviter, play key, sponsored transactions) so a walk through the PWA can start over.
const names = ["minji", "dalgona", "yuki.m", "haneul", "kaia_whale", "noodle", "misaki", "jay.park", "sora", "bongbong", "held_account"];
const ids = names.map((n) => ({ n, ...devIdentity(n) }));
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWX";
await db.deleteFrom("invites").where("wallet", "in", ids.map((p) => p.wallet)).execute();
for (const [i, p] of ids.entries()) {
  const row = {
    wallet: p.wallet,
    email_domain: "gmail.com",
    email_hash: emailHash(hashKey, p.email),
    registration: "registered" as const,
    registered_at: new Date(now - (i === 0 ? 3 * 3600_000 : (10 + i) * 86400_000)),
    display_name: i === 0 ? null : p.n,
    onboarded: i !== 0,
    language: "en" as const,
    frozen: p.n === "held_account",
    frozen_reason: p.n === "held_account" ? "device cluster" : null,
  };
  await db
    .insertInto("users")
    .values({ privy_user_id: p.privyUserId, ...row })
    .onConflict((oc) => oc.column("privy_user_id").doUpdateSet(row))
    .execute();
  // DEVA2AB, DEVB2AB, ... (letters and 2 to 9 only, the invite alphabet)
  await db.insertInto("invites").values({ code: `DEV${CODE_LETTERS[i]}2AB`, wallet: p.wallet }).execute();
}
const me = ids[0].wallet;
const meUser = await db.selectFrom("users").select("id").where("wallet", "=", me).executeTakeFirstOrThrow();
await db.deleteFrom("user_marks").where("user_id", "=", meUser.id).execute();
await db.deleteFrom("play_keys").where("wallet", "=", me).execute();
await db.deleteFrom("sponsored_txs").where("wallet", "=", me).execute();
await db.deleteFrom("registration_requests").where("wallet", "=", me).execute();
await db.deleteFrom("freezes").where("wallet", "=", me).execute();
await db.deleteFrom("referrals").where((eb) => eb.or([eb("invitee", "=", me), eb("inviter", "=", me)])).execute();
await db.deleteFrom("conversions").where("wallet", "=", me).execute();
// Sponsorship counters of the dev player and of local networks (dev database only), so a walk can run again today.
await db
  .deleteFrom("usage_daily")
  .where((eb) => eb.or([eb("key", "like", `%${me}%`), eb("key", "like", `%${ids[0].privyUserId}%`), eb("key", "like", "ip:%")]))
  .execute();

// Yesterday and the day before: minji answered all five. Hits pay 6 hours after the answer is set (settle delay).
await db.deleteFrom("predictions").where("wallet", "=", me).execute();
await db.deleteFrom("points_ledger").where("wallet", "=", me).execute();
await db.deleteFrom("user_days").where("wallet", "=", me).execute();
const picks: Record<number, number[]> = { [d1]: [1, 1, 2, 2, 1], [d2]: [2, 1, 1, 2, 2] };
for (const day of [d2, d1]) {
  const ms = await db.selectFrom("markets").select(["slot", "outcome", "settles_at"]).where("day_id", "=", day).orderBy("slot").execute();
  let mask = 0;
  let hits = 0;
  for (let s = 0; s < 5; s++) {
    await db.insertInto("predictions").values({ wallet: me, market_id: day * 5 + s, day_id: day, choice: picks[day][s], answered: s + 1, tx_hash: `0xseedp${day}${s}`, block: 100 + s }).execute();
    const m = ms[s];
    if (m.settles_at && m.settles_at.getTime() < now) {
      mask |= 1 << s;
      if (m.outcome === picks[day][s]) hits++;
    }
  }
  const completedAt = new Date((dayEnd(day) - 20 * 3600) * 1000);
  await db.insertInto("user_days").values({ wallet: me, day_id: day, answered: 5, completed: true, completed_at: completedAt, settled_mask: mask, hits, completion_points: 100, hit_points: hits * 50 }).execute();
  const rows: any[] = [{ wallet: me, kind: "completion", amount: 100, day_id: day, week_id: weekOf(day), ranked: true, tx_hash: `0xseedc${day}`, log_index: 0, block_time: completedAt }];
  if (hits) rows.push({ wallet: me, kind: "hits", amount: hits * 50, day_id: day, week_id: weekOf(day), ranked: true, tx_hash: `0xseedh${day}`, log_index: 0 });
  rows.push({ wallet: me, kind: "referral", amount: day === d1 ? 15 : 10, day_id: day, week_id: weekOf(day), ranked: false, source_wallet: ids[1].wallet, tx_hash: `0xseedr${day}`, log_index: 0 });
  await db.insertInto("points_ledger").values(rows).execute();
}
const minjiWeek = await db
  .selectFrom("points_ledger")
  .select(sql<number>`coalesce(sum(amount), 0)::int`.as("s"))
  .where("wallet", "=", me)
  .where("week_id", "=", week)
  .where("ranked", "=", true)
  .executeTakeFirst();

// Weekly ranking (the held account has the most points and is left out of the prizes).
await db.deleteFrom("week_totals").where("week_id", "=", week).execute();
const pts = [minjiWeek?.s ?? 0, 1400, 1350, 1300, 1300, 1250, 1150, 1100, 1100, 1000, 1500];
for (const [i, p] of ids.entries()) {
  await db.insertInto("week_totals").values({ week_id: week, wallet: p.wallet, points: pts[i], last_completion_at: new Date(now - (i + 1) * 3_600_000) }).execute();
}
await db
  .insertInto("weeks")
  .values({ week_id: week, qualified_players: 1284, pool: (1284n * 10n ** 18n).toString(), status: "open" })
  .onConflict((oc) => oc.column("week_id").doUpdateSet({ qualified_players: 1284 }))
  .execute();

// One friend invited by minji, staking positions and wallet history.
await db.insertInto("referrals").values({ invitee: ids[1].wallet, inviter: me, code: "DEVA2AB", source: "first_run", bound_at: new Date(now - 2 * 3600_000), first_day_at: new Date(now - 3600_000), bonus_points: 25 }).execute();
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

console.log(`seeded day ${d0} (today), ${d1} and ${d2} (answered, resolved where due) and ${d0 + 1} (scheduled); week ${week}`);
console.log(`dev player: X-Dev-User: minji  wallet ${me}`);
console.log("dev admin:  X-Dev-Admin: dev@cojam.app");
await db.destroy();
