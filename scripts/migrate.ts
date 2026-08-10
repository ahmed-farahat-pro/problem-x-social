/**
 * Applies pending SQL migrations from ./drizzle, then ensures the admin owner
 * account exists.
 *
 * Runs as part of `npm run build`, which is what makes a Vercel deploy
 * self-sufficient: connect a database, push, and the tables — plus the admin
 * account — exist. Both steps are idempotent; Drizzle records which migrations
 * have run, and the admin is only created when its email isn't taken.
 *
 * When no database is configured the build must still succeed, otherwise the
 * very first deploy (before the database is attached) can never finish.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { resolveDatabaseUrl, sslModeFor } from "../src/db/url";
import * as schema from "../src/db/schema";

/**
 * bcrypt hash of the default admin password. Only the hash lives in source —
 * the plaintext is never committed. Override either credential with
 * ADMIN_EMAIL / ADMIN_PASSWORD_HASH at deploy time.
 */
const DEFAULT_ADMIN_EMAIL = "admin@admin.com";
const DEFAULT_ADMIN_PASSWORD_HASH =
  "$2b$10$inOh/RO/bQD5FaOGAf4YYeNJBBC/uGF9atcH8914chWb/Z/0SVkPK";

async function ensureAdmin(
  db: ReturnType<typeof drizzle<typeof schema>>,
) {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL)
    .toLowerCase()
    .trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? DEFAULT_ADMIN_PASSWORD_HASH;

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing) return;

  await db.insert(schema.users).values({
    email,
    passwordHash,
    name: "Administrator",
    role: "admin",
  });
  console.log(`✓ ensured admin account (${email})`);
}

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
    const driz = drizzle(sql, { schema });
    await migrate(driz, { migrationsFolder: "./drizzle" });
    console.log("✓ database migrations applied");

    // Seeding must not fail the build on a transient error — the running app
    // reports the real state on its setup screen. It retries next deploy.
    try {
      await ensureAdmin(driz);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`· admin seed skipped: ${message}`);
    }
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
