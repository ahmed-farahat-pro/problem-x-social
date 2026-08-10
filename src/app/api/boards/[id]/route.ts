import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const body = await readJson<
      Partial<{ name: string; emoji: string; position: number; companyId: string }>
    >(request);

    const patch: Record<string, unknown> = {};
    for (const key of ["name", "emoji", "position", "companyId"] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) return fail("Nothing to update.");

    const [board] = await db
      .update(schema.boards)
      .set(patch)
      .where(eq(schema.boards.id, id))
      .returning();
    if (!board) return fail("Sheet not found.", 404);
    return ok({ board });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    await db.delete(schema.boards).where(eq(schema.boards.id, id));
    return ok({ ok: true });
  });
}
