/**
 * Seeds the database from seed-data/mafesh.json.
 *   npm run db:seed                       → content only
 *   npm run db:seed -- --user a@b.com pw  → also creates a login
 * Safe to re-run: it skips companies that already exist by name.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { resolveDatabaseUrl } from "../src/db/url";

interface SeedRow {
  date?: string;
  contentType?: string;
  title?: string;
  content?: string;
  platforms?: string[];
  designStatus?: string;
  driveLink?: string;
  notes?: string;
  approval?: string;
  published?: string;
  ideas?: string;
  tags?: string[];
  owner?: string;
}

/**
 * Seed rows carry full ISO timestamps ("2026-07-04T21:00:00Z" is local midnight
 * on the 5th in +03:00). Slicing the string would silently shift every post a
 * day, so the instant is resolved before the calendar day is read.
 */
function toCalendarDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10) || null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("No Postgres connection string found (DATABASE_URL).");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const args = process.argv.slice(2);
  const userFlag = args.indexOf("--user");
  if (userFlag !== -1) {
    const email = (args[userFlag + 1] ?? "").toLowerCase();
    const password = args[userFlag + 2] ?? "";
    if (!email || password.length < 8) {
      throw new Error("Usage: npm run db:seed -- --user <email> <password 8+>");
    }
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));
    if (existing.length) {
      console.log(`· user ${email} already exists`);
    } else {
      await db.insert(schema.users).values({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name: email.split("@")[0],
      });
      console.log(`✓ user ${email}`);
    }
  }

  const path = resolve(process.cwd(), "seed-data/mafesh.json");
  if (!existsSync(path)) {
    console.log(
      "· no seed-data/mafesh.json — skipping content seed (see seed-data/README.md)",
    );
    await sql.end();
    return;
  }
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    companies: {
      name: string;
      handle?: string;
      colorHex?: string;
      brandNotes?: string;
      boards: { name: string; emoji?: string; rows: SeedRow[] }[];
    }[];
  };

  let position = 0;
  for (const c of data.companies) {
    const existing = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.name, c.name));
    if (existing.length) {
      console.log(`· "${c.name}" already seeded — skipping`);
      position++;
      continue;
    }

    const [company] = await db
      .insert(schema.companies)
      .values({
        name: c.name,
        handle: c.handle ?? "",
        colorHex: c.colorHex ?? "#7C5CFF",
        brandNotes: c.brandNotes ?? "",
        position: position++,
      })
      .returning();

    let boardPosition = 0;
    let total = 0;
    for (const b of c.boards) {
      const [board] = await db
        .insert(schema.boards)
        .values({
          companyId: company.id,
          name: b.name,
          emoji: b.emoji ?? "🗓️",
          position: boardPosition++,
        })
        .returning();

      if (b.rows.length) {
        await db.insert(schema.posts).values(
          b.rows.map((r, i) => ({
            boardId: board.id,
            date: r.date ? toCalendarDate(r.date) : null,
            contentType: r.contentType ?? "",
            title: r.title ?? "",
            content: r.content ?? "",
            platforms: r.platforms ?? [],
            designStatus: r.designStatus ?? "Not Started",
            driveLink: r.driveLink ?? "",
            notes: r.notes ?? "",
            approval: r.approval ?? "Pending",
            published: r.published ?? "Not Yet",
            ideas: r.ideas ?? "",
            tags: r.tags ?? [],
            owner: r.owner ?? "",
            position: i,
          })),
        );
        total += b.rows.length;
      }
    }
    console.log(`✓ ${c.name}: ${c.boards.length} sheet(s), ${total} post(s)`);
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
