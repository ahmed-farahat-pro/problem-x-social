/**
 * Resolves the Postgres URL from whichever variable the host injected.
 * Vercel's integrations don't agree on a name: the Neon integration sets
 * DATABASE_URL, Vercel Postgres sets POSTGRES_URL, and both add non-pooled
 * variants. Checking all of them means "connect the database" is the only
 * step a deploy actually needs.
 */
const CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_NO_SSL",
] as const;

export function resolveDatabaseUrl(): string | undefined {
  for (const key of CANDIDATES) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

/** Which variable supplied the URL — surfaced on the setup screen. */
export function databaseUrlSource(): string | undefined {
  for (const key of CANDIDATES) {
    if (process.env[key]?.trim()) return key;
  }
  return undefined;
}

export const DATABASE_URL_CANDIDATES = CANDIDATES;

/**
 * Hosted Postgres (Supabase, Neon, Aiven, Render…) refuses plaintext, but many
 * of their copy-paste strings omit `sslmode`. Default to SSL for anything that
 * isn't local so a correct URL doesn't fail with an opaque connection error.
 */
export function sslModeFor(url: string): "require" | undefined {
  try {
    const { hostname, searchParams } = new URL(url);
    const explicit = searchParams.get("sslmode");
    if (explicit) return explicit === "disable" ? undefined : "require";
    const local =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal");
    return local ? undefined : "require";
  } catch {
    return undefined;
  }
}
