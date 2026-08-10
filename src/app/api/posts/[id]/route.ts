import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { toPost } from "@/lib/workspace";
import { pickPostFields } from "../route";
import type { PostInput } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const body = await readJson<PostInput & { boardId?: string }>(request);

    const patch = pickPostFields(body);
    if (body.boardId !== undefined) patch.boardId = body.boardId;
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
    await requireUser();
    const { id } = await params;
    await db.delete(schema.posts).where(eq(schema.posts.id, id));
    return ok({ ok: true });
  });
}
