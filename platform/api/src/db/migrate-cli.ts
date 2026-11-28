// npm run db:migrate  (reads DATABASE_URL)
import { createPool } from "./index.ts";
import { migrate } from "./migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const pool = createPool(url, 1);
try {
  const applied = await migrate(pool, (m) => console.log(m));
  console.log(applied.length ? `${applied.length} migration(s) applied` : "database is up to date");
} finally {
  await pool.end();
}
