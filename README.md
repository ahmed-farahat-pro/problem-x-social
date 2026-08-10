# Problem-X Social

A content-planning workspace for agencies running social media across **multiple companies**, each with **multiple sheets**. Full-stack Next.js, responsive from a 360px phone to a wide desktop, built to deploy on Vercel.

Companies → Sheets → Posts. Every post carries a date, format, title, caption, platforms, design status, asset link, revision notes, approval and publish state — plus tags and an owner.

Captions are often Egyptian Arabic mixed with Latin product names, so **right-to-left text is handled per field** — in the table, the board, the editor, the Excel export and the print report.

---

## Run it locally

You need Node 20+ and a Postgres database.

```bash
npm install
cp .env.example .env.local        # then fill in the two values
npm run db:migrate                # create the tables
npm run dev                       # http://localhost:3000
```

The first account you create becomes the owner — open the app and it will offer to create it.

Need a throwaway Postgres? This is the quickest:

```bash
docker run -d --name px-pg -e POSTGRES_PASSWORD=problemx -e POSTGRES_DB=problemx -p 55432:5432 postgres:17-alpine
```

Then set `DATABASE_URL="postgres://postgres:problemx@localhost:55432/problemx"`.

### Environment

| Variable | Required | What it's for |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Use the **pooled** URL on serverless. `POSTGRES_URL`, `DATABASE_URL_UNPOOLED` and `POSTGRES_URL_NON_POOLING` are also accepted, so either Vercel database integration works untouched. |
| `AUTH_SECRET` | yes | Signs the session cookie. `openssl rand -base64 32` |
| `INVITE_CODE` | no | Set it and teammates can self-register with it. Leave it unset and only the first account can ever be created. |

If either required variable is missing the app renders a setup screen instead of crashing.

---

## Deploy to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new). Framework detection and build settings need no changes.
2. **Get a Postgres database.** Vercel's Storage tab is a paid marketplace, but the app only needs a connection string — it does not care who hosts it. Free options that work as-is:

   | Provider | Notes |
   |---|---|
   | **Supabase** | Free Postgres. Use the **Transaction pooler** string (port `6543`) from Project Settings → Database. Pauses after long inactivity; resumes on the next request. |
   | **Neon (direct)** | Sign up at neon.tech rather than through Vercel's marketplace — the direct free tier is separate from the paid integration. |
   | **Aiven / Railway / Render** | All hand you a standard Postgres URL. Check the current free-tier terms before relying on one. |
   | **Your own server** | Any reachable Postgres 14+ works. |

3. **Settings → Environment Variables**: add `DATABASE_URL` (paste the string from step 2) and `AUTH_SECRET`. Add `INVITE_CODE` too if you want teammates to join.
4. **Redeploy.** Migrations run as part of the build, so the tables are created for you. (Vercel only injects new environment variables into *new* deployments — an existing one keeps the old values, which is why this step matters.)
5. Open the site and create the first account.

If anything is still missing the app shows a setup screen that probes your database and tells you exactly which of the three pieces is absent, rather than a generic checklist.

SSL is enabled automatically for any non-local host, so a hosted connection string works even when it omits `sslmode=require`. Pass `?sslmode=disable` if you ever need plaintext.

### Region

`vercel.json` pins functions to `fra1` (Frankfurt). Vercel's default is `iad1`
(Washington DC), which for a team in the Middle East or Europe means every
request — and every database query — crosses the Atlantic.

**Set this to whichever region your database lives in.** That single hop
dominates latency; being close to your users matters less than being close to
your data. `arn1` Stockholm, `lhr1` London, `cdg1` Paris and `dub1` Dublin are
the other European options.

Everything runs on the Node runtime with `force-dynamic` on the authenticated routes, so there's no stale-cache surprise. Serverless-safe details are already handled: a single pooled connection cached on `globalThis`, and `prepare: false` so transaction poolers (Neon, Supabase) don't reject prepared statements.

---

## What's in it

### Four views over the same sheet

| View | Shortcut | |
|---|---|---|
| **Table** | ⌘1 | Spreadsheet layout with inline editing and sortable columns. Becomes a card list on phones. |
| **Board** | ⌘2 | Kanban. Drag cards between columns to change status — works with touch. Group by design, approval, publish state or format. |
| **Calendar** | ⌘3 | Month grid; drag a post onto a day to reschedule. Switches to a day-by-day agenda on phones. |
| **Insights** | ⌘4 | Production funnel, content mix, platform reach, weekly cadence, what's overdue. |

### Export

One dialog (⌘E), scoped to the sheet, your selection, a whole company or the entire workspace.

- **Excel (.xlsx)** — a real styled workbook: frozen header in the company's brand colour, sized columns, wrapped text, autofilter and **live dropdown validations**, so the file stays a working sheet. One worksheet per board when you export a company.
- **CSV** — UTF-8 with a BOM so Excel reads Arabic correctly on the first open.
- **Markdown** — for Notion, docs or chat.
- **JSON** — a structured backup you can re-import.
- **PDF** — opens a print-ready report; choose *Save as PDF*. The browser's own print engine is what shapes Arabic correctly, which is why this route exists instead of server-side PDF generation.

### Import

⌘I takes `.xlsx`, `.csv`, `.tsv` or a JSON backup. It finds the header row wherever it sits, maps columns by meaning (`Caption` / `Content` / `Copy` all land in the same field), converts Excel serial dates, normalises `Caroucel Post` → `Carousel Post`, splits `Instagram, Facebook` into real platform chips, and drops repeated header rows and blank padding. Each worksheet becomes its own sheet. You preview and choose the destination before anything is written.

### Everything else

- **⌘K** searches every post across every company and runs any command.
- **Live caption counters** with per-platform limits (Instagram 2200, X 280 …), amber near the cap, red over it.
- **Auto-schedule** — spread selected posts across a cadence, optionally skipping weekends.
- **Repeat forward** — copy this week's plan to next week with statuses reset.
- **Bulk edit** — select rows, set status, move between sheets, duplicate, delete.
- **Optimistic editing** — typing writes to local state instantly and PATCHes debounced; the last keystroke is flushed on `pagehide` so nothing is lost when a tab closes.

---

## Layout

```
src/
├── app/
│   ├── page.tsx              server-renders the workspace + UI prefs
│   ├── login/                sign in / first-run account creation
│   ├── print/[boardId]/      print-optimised PDF report
│   └── api/                  auth · workspace · companies · boards · posts · import · export
├── components/
│   ├── AppShell.tsx          layout, shortcuts, bulk-selection bar
│   ├── Sidebar.tsx           companies → sheets, brand settings
│   ├── PostEditor.tsx        side panel on desktop, drawer on mobile
│   ├── ui.tsx                shared primitives (Button, Menu, Modal, pills…)
│   └── views/                TableView · BoardView · CalendarView · DashboardView
├── db/                       Drizzle schema + pooled client
└── lib/
    ├── store.tsx             client store: optimistic mutations, filters, sorting
    ├── sheets.ts             xlsx/csv read + write, column mapping
    ├── auth.ts               bcrypt + JWT session cookie
    └── catalog.ts            statuses, platforms, caption limits, palettes
```

`npm run db:studio` opens Drizzle Studio against your database.

---

## Notes

**Auth** is email + password with bcrypt hashes and a signed, httpOnly, `SameSite=Lax` session cookie (30 days). All authenticated users share one workspace, which is what an agency team wants — there is no per-user row filtering.

**Dates** are stored as bare `yyyy-mm-dd` text, never timestamps. A post planned for the 5th must read as the 5th in every timezone, and a `timestamptz` would shift it. Import paths read Excel's UTC-midnight dates with UTC getters for the same reason.

**Seed data** lives in `seed-data/` and is git-ignored — it holds real client captions, revision notes and Drive links. See `seed-data/README.md`.
