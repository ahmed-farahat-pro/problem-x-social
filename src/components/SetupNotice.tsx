import { CheckCircle2, Circle, Database, KeyRound, Table2, XCircle } from "lucide-react";
import postgres from "postgres";
import { databaseUrlSource, resolveDatabaseUrl } from "@/db/url";

type State = "ok" | "missing" | "error";

interface Check {
  state: State;
  detail?: string;
}

/**
 * Probes the database instead of guessing, so a stuck deploy says exactly
 * which of the three things is missing.
 */
async function probe(): Promise<{ connection: Check; tables: Check }> {
  const url = resolveDatabaseUrl();
  if (!url) {
    return {
      connection: { state: "missing" },
      tables: { state: "missing" },
    };
  }

  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 2,
  });
  try {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('users', 'companies', 'boards', 'posts')
    `;
    const found = rows.length;
    return {
      connection: { state: "ok", detail: `via ${databaseUrlSource()}` },
      tables:
        found === 4
          ? { state: "ok", detail: "users · companies · boards · posts" }
          : {
              state: "missing",
              detail:
                found === 0
                  ? "No tables yet."
                  : `Only ${found} of 4 tables exist.`,
            },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      connection: { state: "error", detail: message },
      tables: { state: "error", detail: "Couldn't check — no connection." },
    };
  } finally {
    await sql.end({ timeout: 3 }).catch(() => {});
  }
}

export default async function SetupNotice() {
  const { connection, tables } = await probe();
  const secret: Check = process.env.AUTH_SECRET
    ? process.env.AUTH_SECRET.length >= 16
      ? { state: "ok" }
      : { state: "error", detail: "Too short — use 32+ characters." }
    : { state: "missing" };

  const allGood =
    connection.state === "ok" && tables.state === "ok" && secret.state === "ok";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <span className="brand-gradient grid size-10 place-items-center rounded-xl text-lg font-black text-white">
          X
        </span>
        <div>
          <h1 className="text-lg font-semibold">Problem-X Social</h1>
          <p className="text-muted text-sm">
            {allGood
              ? "Everything checks out — reload this page."
              : "Almost there. Here's what's still missing."}
          </p>
        </div>
      </div>

      <div className="card divide-y divide-[var(--line)]">
        <Step
          icon={<Database className="size-4" />}
          check={connection}
          title="Database connection"
          okBody="Connected."
          body="On Vercel: Storage → Create Database → Neon Postgres, then connect it to this project. Any of DATABASE_URL, POSTGRES_URL or DATABASE_URL_UNPOOLED works."
          code={`DATABASE_URL="postgres://user:pass@host/db"`}
        />
        <Step
          icon={<KeyRound className="size-4" />}
          check={secret}
          title="AUTH_SECRET"
          okBody="Set."
          body="Signs the session cookie. Add it under Settings → Environment Variables, then redeploy."
          code="openssl rand -base64 32"
        />
        <Step
          icon={<Table2 className="size-4" />}
          check={tables}
          title="Tables"
          okBody="All four tables exist."
          body="Migrations run automatically on every build. If the database was connected after the last deploy, redeploy once — or apply them from your machine."
          code={`DATABASE_URL="<your-url>" npm run db:migrate`}
        />
      </div>

      {!allGood && (
        <p className="text-dim text-xs leading-relaxed">
          After changing environment variables on Vercel you must{" "}
          <strong className="text-muted">redeploy</strong> — existing instances
          keep the old values. Deployments → ⋯ → Redeploy.
        </p>
      )}
    </main>
  );
}

function Step({
  icon,
  title,
  body,
  okBody,
  code,
  check,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  okBody: string;
  code: string;
  check: Check;
}) {
  const tone =
    check.state === "ok"
      ? "bg-emerald-500/12 text-emerald-400"
      : check.state === "error"
        ? "bg-rose-500/12 text-rose-400"
        : "bg-brand-500/12 text-brand-400";

  return (
    <div className="flex gap-3 p-4">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          {title}
          {check.state === "ok" ? (
            <CheckCircle2 className="size-3.5 text-emerald-400" />
          ) : check.state === "error" ? (
            <XCircle className="size-3.5 text-rose-400" />
          ) : (
            <Circle className="text-dim size-3.5" />
          )}
        </h2>

        <p className="text-muted mt-0.5 text-xs leading-relaxed">
          {check.state === "ok" ? okBody : body}
        </p>

        {check.detail && (
          <p
            className={`mt-1 text-[11px] break-words ${
              check.state === "error" ? "text-rose-400" : "text-dim"
            }`}
          >
            {check.detail}
          </p>
        )}

        {check.state !== "ok" && (
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11px]">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
