import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCan } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireCan("update", "companies");
    const { id } = await params;
    const body = await readJson<
      Partial<{
        name: string;
        handle: string;
        colorHex: string;
        brandNotes: string;
        position: number;
      }>
    >(request);

    const patch: Record<string, unknown> = {};
    for (const key of [
      "name",
      "handle",
      "colorHex",
      "brandNotes",
      "position",
    ] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) return fail("Nothing to update.");

    const [company] = await db
      .update(schema.companies)
      .set(patch)
      .where(eq(schema.companies.id, id))
      .returning();
    if (!company) return fail("Company not found.", 404);
    return ok({ company });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireCan("delete", "companies");
    const { id } = await params;
    // Boards and posts cascade from the FK definitions.
    await db.delete(schema.companies).where(eq(schema.companies.id, id));
    return ok({ ok: true });
  });
}
