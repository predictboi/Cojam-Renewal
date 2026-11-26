// Prepares a migrated template database once per test run. Each test file then clones it (test/api/helpers.ts
// createTestDb), so files run in parallel without sharing state.
// Needs a Postgres 16 the tests can create databases on: TEST_PG_URL (default postgres://cojam:cojam@localhost:5432/postgres).
import pg from "pg";
import { migrate } from "../src/db/migrate.ts";

export const TEMPLATE = "cojam_test_template";

export default async function setup() {
  const adminUrl = process.env.TEST_PG_URL ?? "postgres://cojam:cojam@localhost:5432/postgres";
  const admin = new pg.Client({ connectionString: adminUrl });
  try {
    await admin.connect();
  } catch (e) {
    process.env.COJAM_TEST_PG_UNAVAILABLE = (e as Error).message;
    console.warn(`[test] Postgres unavailable at ${adminUrl}: database tests will fail (${(e as Error).message})`);
    return;
  }
  // Drop leftovers of earlier runs, then build a fresh template.
  const old = await admin.query<{ datname: string }>("SELECT datname FROM pg_database WHERE datname LIKE 'cojam_t_%' OR datname = $1", [TEMPLATE]);
  for (const r of old.rows) {
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [r.datname]);
    await admin.query(`DROP DATABASE IF EXISTS "${r.datname}"`);
  }
  await admin.query(`CREATE DATABASE "${TEMPLATE}"`);
  const url = new URL(adminUrl);
  url.pathname = `/${TEMPLATE}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
  await migrate(pool);
  await pool.end();
  await admin.end();
}
