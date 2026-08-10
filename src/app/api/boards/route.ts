import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCan } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { toPost } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    await requireCan("create", "boards");
    const body = await readJson<{
      companyId?: string;
      name?: string;
      emoji?: string;
      /** When set, copies that board's posts into the new one. */
      duplicateOf?: string;
    }>(request);

    if (!body.companyId) return fail("companyId is required.");

    const existing = await db
      .select({ position: schema.boards.position })
      .from(schema.boards)
      .where(eq(schema.boards.companyId, body.companyId))
      .orderBy(desc(schema.boards.position))
      .limit(1);

    const [board] = await db
      .insert(schema.boards)
      .values({
        companyId: body.companyId,
        name: (body.name ?? "").trim() || "New Sheet",
        emoji: body.emoji ?? "📄",
        position: (existing[0]?.position ?? -1) + 1,
      })
      .returning();

    let posts: ReturnType<typeof toPost>[] = [];
    if (body.duplicateOf) {
      const source = await db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.boardId, body.duplicateOf));
      if (source.length) {
        const inserted = await db
          .insert(schema.posts)
          .values(
            source.map((p) => ({
              boardId: board.id,
              date: p.date,
              contentType: p.contentType,
              title: p.title,
              content: p.content,
              platforms: p.platforms,
              designStatus: p.designStatus,
              driveLink: p.driveLink,
              notes: p.notes,
              approval: p.approval,
              published: p.published,
              ideas: p.ideas,
              tags: p.tags,
              owner: p.owner,
              position: p.position,
            })),
          )
          .returning();
        posts = inserted.map(toPost);
      }
    }

    return ok({ board, posts });
  });
}
