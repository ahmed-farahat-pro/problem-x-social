import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { isRole } from "@/lib/permissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

interface PatchBody {
  role?: string;
  password?: string;
  name?: string;
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const me = await requireAdmin();
    const { id } = await params;
    const body = await readJson<PatchBody>(request);

    const patch: Record<string, unknown> = {};

    if (body.role !== undefined) {
      if (!isRole(body.role)) return fail("Unknown role.");
      patch.role = body.role;
    }
    if (typeof body.name === "string") {
      patch.name = body.name.trim();
    }
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 8) return fail("Password must be at least 8 characters.");
      patch.passwordHash = await hashPassword(body.password);
    }

    // An admin can't lock themselves out: the last admin can't be demoted or
    // removed, and you can't demote your own admin account.
    if (patch.role !== undefined && patch.role !== "admin") {
      if (id === me.id) return fail("You can't demote your own admin account.");
      const [target] = await db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1);
      if (target?.role === "admin") {
        const admins = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.role, "admin"));
        if (admins.length <= 1) {
          return fail("At least one admin must remain.", 409);
        }
      }
    }

    const [row] = await db
      .update(schema.users)
      .set(patch)
      .where(eq(schema.users.id, id))
      .returning();
    if (!row) return fail("User not found.", 404);

    return ok({
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
      },
    });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const me = await requireAdmin();
    const { id } = await params;

    if (id === me.id) return fail("You can't delete your own account.", 409);

    // Preserve the last admin.
    const [target] = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (target?.role === "admin") {
      const admins = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.role, "admin"));
      if (admins.length <= 1) {
        return fail("At least one admin must remain.", 409);
      }
    }

    await db.delete(schema.users).where(eq(schema.users.id, id));
    return ok({ ok: true });
  });
}
