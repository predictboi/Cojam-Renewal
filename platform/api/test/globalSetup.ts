// Prepares a migrated template database once per test run. Each test file then clones it (test/api/helpers.ts
// createTestDb), so files run in parallel without sharing state. The template name is unique per run, so two
// runs at the same time (for example the API and the worker suites) never touch each other's databases.
// Needs a Postgres 16 the tests can create databases on: TEST_PG_URL (default postgres://cojam:cojam@localhost:5432/postgres).
import pg from "pg";
import { randomBytes } from "node:crypto";
import { migrate } from "../src/db/migrate.ts";

export default async function setup() {
  const adminUrl = process.env.TEST_PG_URL ?? "postgres://cojam:cojam@localhost:5432/postgres";
  const template = `cojam_tpl_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  try {
    await admin.connect();
  } catch (e) {
    process.env.COJAM_TEST_PG_UNAVAILABLE = (e as Error).message;
    console.warn(`[test] Postgres unavailable at ${adminUrl}: database tests will fail (${(e as Error).message})`);
    return;
  }
  await admin.query(`CREATE DATABASE "${template}"`);
  const url = new URL(adminUrl);
  url.pathname = `/${template}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
  await migrate(pool);
  await pool.end();
  await admin.end();
  process.env.COJAM_TEST_TEMPLATE = template;

  return async () => {
    const a = new pg.Client({ connectionString: adminUrl });
    await a.connect();
    await a.query(`DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`);
    await a.end();
  };
}
