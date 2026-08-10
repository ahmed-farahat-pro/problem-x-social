import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCan } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { filterPostPatch } from "@/lib/permissions";
import { toPost } from "@/lib/workspace";
import type { PostInput } from "@/lib/types";

export const runtime = "nodejs";

const FIELDS = [
  "date",
  "contentType",
  "title",
  "content",
  "platforms",
  "designStatus",
  "driveLink",
  "notes",
  "approval",
  "published",
  "ideas",
  "tags",
  "owner",
  "position",
] as const;

export function pickPostFields(input: PostInput) {
  const patch: Record<string, unknown> = {};
  for (const key of FIELDS) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  return patch;
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireCan("create", "posts");
    const body = await readJson<PostInput & { boardId?: string }>(request);
    if (!body.boardId) return fail("boardId is required.");

    const last = await db
      .select({ position: schema.posts.position })
      .from(schema.posts)
      .where(eq(schema.posts.boardId, body.boardId))
      .orderBy(desc(schema.posts.position))
      .limit(1);

    const [row] = await db
      .insert(schema.posts)
      .values({
        boardId: body.boardId,
        position: body.position ?? (last[0]?.position ?? -1) + 1,
        ...filterPostPatch(user.role, pickPostFields(body)),
      })
      .returning();

    return ok({ post: toPost(row) });
  });
}
