import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { countUsers, getSession } from "@/lib/auth";
import SetupNotice from "@/components/SetupNotice";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return await SetupNotice();
  }

  let needsSetup = false;
  try {
    if (await getSession()) redirect("/");
    needsSetup = (await countUsers()) === 0;
  } catch (error) {
    // Tables missing → the schema hasn't been pushed yet.
    if (error && typeof error === "object" && "digest" in error) throw error;
    return await SetupNotice();
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <span className="brand-gradient grid size-10 place-items-center rounded-xl text-lg font-black text-white">
              X
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold">Problem-X</p>
              <p className="text-[10px] font-black tracking-[0.22em] text-accent-500">
                SOCIAL
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {needsSetup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-muted mt-1.5 text-sm">
            {needsSetup
              ? "This workspace is empty — the first account becomes the owner."
              : "Sign in to your content workspace."}
          </p>

          <LoginForm needsSetup={needsSetup} />
        </div>
      </section>

      <section className="relative hidden overflow-hidden border-l border-[var(--line)] lg:block">
        <div className="brand-gradient absolute inset-0 opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.28),transparent_58%)]" />
        <div className="relative flex h-full flex-col justify-end gap-6 p-14 text-white">
          <blockquote className="max-w-md text-2xl leading-snug font-semibold">
            Every brand, every sheet, every caption — planned, reviewed and
            shipped from one place.
          </blockquote>
          <ul className="grid gap-2 text-sm text-white/85">
            {[
              "Table, board, calendar and dashboard views",
              "Arabic and RTL captions render correctly everywhere",
              "Export to Excel, CSV, Markdown or a print-ready PDF",
              "Import the tracker you already use",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-white/70" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
