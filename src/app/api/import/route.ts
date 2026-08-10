import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCan, requireUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";
import { parseDelimited, readWorkbook, rowsToPosts } from "@/lib/sheets";
import { toPost } from "@/lib/workspace";
import { COMPANY_PALETTE } from "@/lib/catalog";
import type { PostInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Step 1: parse an uploaded file and return a preview — nothing is written. */
export async function PUT(request: Request) {
  return handle(async () => {
    await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No file uploaded.");

    const name = file.name.toLowerCase();
    let sheets: { name: string; posts: PostInput[] }[] = [];

    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      sheets = await readWorkbook(await file.arrayBuffer());
    } else if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
      const text = await file.text();
      const posts = rowsToPosts(parseDelimited(text));
      if (posts.length) {
        sheets = [{ name: file.name.replace(/\.[^.]+$/, ""), posts }];
      }
    } else if (name.endsWith(".json")) {
      const parsed = JSON.parse(await file.text());
      if (Array.isArray(parsed?.companies)) {
        sheets = parsed.companies.flatMap(
          (c: { name: string; boards?: { name: string; posts?: PostInput[] }[] }) =>
            (c.boards ?? []).map((b) => ({
              name: `${c.name} › ${b.name}`,
              posts: b.posts ?? [],
            })),
        );
      } else if (Array.isArray(parsed?.posts)) {
        sheets = [{ name: file.name.replace(/\.[^.]+$/, ""), posts: parsed.posts }];
      }
    } else {
      return fail(`Unsupported file type. Use .xlsx, .csv or .json.`);
    }

    sheets = sheets.filter((s) => s.posts.length > 0);
    if (!sheets.length) return fail("No content rows found in that file.");

    return ok({ fileName: file.name, sheets });
  });
}

interface CommitBody {
  destination: "newCompany" | "existingCompany" | "currentBoard";
  companyName?: string;
  companyId?: string;
  boardId?: string;
  sheets: { name: string; posts: PostInput[] }[];
}

/** Step 2: commit the previewed rows to the chosen destination. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as CommitBody;
    const sheets = (body.sheets ?? []).filter((s) => s.posts?.length);
    if (!sheets.length) return fail("Nothing to import.");

    // Importing into the current sheet only adds posts; any other destination
    // creates companies and/or boards, which needs structural rights.
    if (body.destination === "currentBoard") {
      await requireCan("create", "posts");
    } else {
      await requireCan("create", "companies");
    }

    if (body.destination === "currentBoard") {
      if (!body.boardId) return fail("boardId is required.");
      const last = await db
        .select({ position: schema.posts.position })
        .from(schema.posts)
        .where(eq(schema.posts.boardId, body.boardId))
        .orderBy(desc(schema.posts.position))
        .limit(1);
      let position = (last[0]?.position ?? -1) + 1;

      const rows = await db
        .insert(schema.posts)
        .values(
          sheets.flatMap((s) =>
            s.posts.map((p) => ({
              boardId: body.boardId!,
              position: position++,
              ...normalise(p),
            })),
          ),
        )
        .returning();
      return ok({ posts: rows.map(toPost), boardId: body.boardId });
    }

    let companyId = body.companyId;
    if (body.destination === "newCompany") {
      const existing = await db
        .select({ position: schema.companies.position })
        .from(schema.companies)
        .orderBy(desc(schema.companies.position))
        .limit(1);
      const position = (existing[0]?.position ?? -1) + 1;
      const [company] = await db
        .insert(schema.companies)
        .values({
          name: (body.companyName ?? "").trim() || "Imported",
          colorHex: COMPANY_PALETTE[position % COMPANY_PALETTE.length],
          position,
        })
        .returning();
      companyId = company.id;
    }
    if (!companyId) return fail("companyId is required.");

    const existingBoards = await db
      .select({ position: schema.boards.position })
      .from(schema.boards)
      .where(eq(schema.boards.companyId, companyId))
      .orderBy(desc(schema.boards.position))
      .limit(1);
    let boardPosition = (existingBoards[0]?.position ?? -1) + 1;

    for (const sheet of sheets) {
      const [board] = await db
        .insert(schema.boards)
        .values({
          companyId,
          name: sheet.name.slice(0, 80) || "Imported",
          emoji: "🗓️",
          position: boardPosition++,
        })
        .returning();

      let position = 0;
      await db.insert(schema.posts).values(
        sheet.posts.map((p) => ({
          boardId: board.id,
          position: position++,
          ...normalise(p),
        })),
      );
    }

    return ok({ companyId });
  });
}

function normalise(p: PostInput) {
  return {
    date: p.date ?? null,
    contentType: p.contentType ?? "",
    title: p.title ?? "",
    content: p.content ?? "",
    platforms: p.platforms ?? [],
    designStatus: p.designStatus ?? "Not Started",
    driveLink: p.driveLink ?? "",
    notes: p.notes ?? "",
    approval: p.approval ?? "Pending",
    published: p.published ?? "Not Yet",
    ideas: p.ideas ?? "",
    tags: p.tags ?? [],
    owner: p.owner ?? "",
  };
}
