import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCan } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { filterPostPatch } from "@/lib/permissions";
import { toPost } from "@/lib/workspace";
import { pickPostFields } from "../route";
import type { PostInput } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireCan("update", "posts");
    const { id } = await params;
    const body = await readJson<PostInput & { boardId?: string }>(request);

    const filtered = filterPostPatch(user.role, pickPostFields(body));
    const patch: Record<string, unknown> = { ...filtered };
    if (body.boardId !== undefined && (user.role === "admin" || user.role === "owner")) {
      patch.boardId = body.boardId;
    }
    if (Object.keys(patch).length === 0) return fail("Nothing to update.");
    patch.updatedAt = new Date();

    const [row] = await db
      .update(schema.posts)
      .set(patch)
      .where(eq(schema.posts.id, id))
      .returning();
    if (!row) return fail("Post not found.", 404);
    return ok({ post: toPost(row) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireCan("delete", "posts");
    const { id } = await params;
    await db.delete(schema.posts).where(eq(schema.posts.id, id));
    return ok({ ok: true });
  });
}
