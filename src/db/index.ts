import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { resolveDatabaseUrl, sslModeFor } from "./url";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "No Postgres connection string found. Set DATABASE_URL (or connect a database on Vercel).",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured() {
  return Boolean(resolveDatabaseUrl());
}

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __pxClient?: postgres.Sql;
  __pxDb?: Database;
  __pxTouchedAt?: number;
};

/**
 * A socket cached across serverless invocations dies while the instance is
 * frozen, and the driver can't tell — it queues the next query on a dead
 * connection and waits forever, which is why requests intermittently hung.
 *
 * So the connection is reused only while it's demonstrably hot. If more than
 * STALE_AFTER_MS has passed since the last query, the instance was probably
 * frozen (or simply idle long enough for the server to drop us), and we build
 * a fresh one. Back-to-back requests still share a connection; a thawed
 * instance never inherits a corpse.
 */
const STALE_AFTER_MS = 15_000;

function connection(): Database {
  const url = resolveDatabaseUrl();
  if (!url) throw new DatabaseNotConfiguredError();

  const now = Date.now();
  const age = now - (globalForDb.__pxTouchedAt ?? 0);

  if (globalForDb.__pxDb && globalForDb.__pxClient && age < STALE_AFTER_MS) {
    globalForDb.__pxTouchedAt = now;
    return globalForDb.__pxDb;
  }

  // Retire the previous socket without blocking this request on it.
  const previous = globalForDb.__pxClient;
  if (previous) {
    void previous.end({ timeout: 0 }).catch(() => {});
  }

  const client = postgres(url, {
    max: 1,
    ssl: sslModeFor(url),
    // Transaction poolers (Neon/Supabase pgbouncer) reject prepared statements.
    prepare: false,
    // Fail fast and surface a real error rather than hanging a page render.
    connect_timeout: 10,
    idle_timeout: 15,
    max_lifetime: 60,
    onnotice: () => {},
  });

  globalForDb.__pxClient = client;
  globalForDb.__pxDb = drizzle(client, { schema });
  globalForDb.__pxTouchedAt = now;
  return globalForDb.__pxDb;
}

/**
 * Lazy proxy so importing this module never throws — the setup screen has to
 * render on a deploy that has no database attached yet.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = connection();
    const value = instance[prop as keyof Database];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
