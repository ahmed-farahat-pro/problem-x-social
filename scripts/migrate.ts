/**
 * Applies pending SQL migrations from ./drizzle.
 *
 * Runs as part of `npm run build`, which is what makes a Vercel deploy
 * self-sufficient: connect a database, push, and the tables exist. It is
 * idempotent — Drizzle records which migrations have run.
 *
 * When no database is configured the build must still succeed, otherwise the
 * very first deploy (before the database is attached) can never finish.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolveDatabaseUrl, sslModeFor } from "../src/db/url";

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.log(
      "· no database configured — skipping migrations (the app will show its setup screen)",
    );
    return;
  }

  // A dedicated single-use connection: migrations run DDL, which transaction
  // poolers handle badly, and we don't want to reuse the app's cached client.
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 30,
    ssl: sslModeFor(url),
  });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("✓ database migrations applied");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Don't fail the build on a transient connection problem — the running app
    // reports the real state on its setup screen.
    console.error(`✗ migrations failed: ${message}`);
    if (process.env.STRICT_MIGRATIONS === "1") process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();
