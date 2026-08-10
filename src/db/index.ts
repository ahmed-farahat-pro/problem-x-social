import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Add a Postgres connection string to your environment.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// Serverless functions get recycled constantly, so the client is cached on
// globalThis to avoid opening a new pool per invocation in dev/HMR.
const globalForDb = globalThis as unknown as {
  __pxClient?: postgres.Sql;
};

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  if (!globalForDb.__pxClient) {
    globalForDb.__pxClient = postgres(url, {
      max: 1,
      // Transaction poolers (Neon/Supabase pgbouncer) reject prepared statements.
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return globalForDb.__pxClient;
}

/**
 * Lazy proxy so importing this module never throws — the setup screen has to
 * be able to render on a deploy that has no database attached yet.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = drizzle(client(), { schema });
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
