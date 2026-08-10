import { Database, KeyRound, Terminal } from "lucide-react";

const missingDatabase = () => !process.env.DATABASE_URL;
const missingSecret = () => !process.env.AUTH_SECRET;

export default function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <span className="brand-gradient grid size-10 place-items-center rounded-xl text-lg font-black text-white">
          X
        </span>
        <div>
          <h1 className="text-lg font-semibold">Problem-X Social</h1>
          <p className="text-muted text-sm">Two environment variables to go.</p>
        </div>
      </div>

      <div className="card divide-y divide-[var(--line)]">
        <Step
          icon={<Database className="size-4" />}
          done={!missingDatabase()}
          title="DATABASE_URL"
          body="A Postgres connection string. On Vercel, add Neon or Vercel Postgres from the Storage tab and it is injected automatically."
          code={`DATABASE_URL="postgres://user:pass@host/db"`}
        />
        <Step
          icon={<KeyRound className="size-4" />}
          done={!missingSecret()}
          title="AUTH_SECRET"
          body="Signs the session cookie. Any long random string works."
          code="openssl rand -base64 32"
        />
        <Step
          icon={<Terminal className="size-4" />}
          done={false}
          title="Create the tables"
          body="Once the database is connected, push the schema. Then reload this page and create the first account."
          code="npm run db:push"
        />
      </div>

      <p className="text-dim text-xs">
        Optional: set <code className="text-muted">INVITE_CODE</code> to let
        teammates create their own accounts. Leave it unset and only the first
        account can ever be created.
      </p>
    </main>
  );
}

function Step({
  icon,
  title,
  body,
  code,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  code: string;
  done: boolean;
}) {
  return (
    <div className="flex gap-3 p-4">
      <span
        className={
          done
            ? "grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/12 text-emerald-400"
            : "grid size-8 shrink-0 place-items-center rounded-lg bg-brand-500/12 text-brand-400"
        }
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">
          {title}
          {done && <span className="ml-2 text-xs text-emerald-400">set</span>}
        </h2>
        <p className="text-muted mt-0.5 text-xs leading-relaxed">{body}</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11px]">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
