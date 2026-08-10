import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { isRole, ROLES } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Strip the password hash before sending a user to the client. */
function publicUser(row: typeof schema.users.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const rows = await db
      .select()
      .from(schema.users)
      .orderBy(asc(schema.users.createdAt));
    return ok({ users: rows.map(publicUser) });
  });
}

interface CreateBody {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
}

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await readJson<CreateBody>(request);
    const email = (body.email ?? "").toLowerCase().trim();
    const password = body.password ?? "";
    const name = (body.name ?? "").trim();
    const role = isRole(body.role) ? body.role : "content_creator";

    if (!email.includes("@")) return fail("Enter a valid email address.");
    if (password.length < 8)
      return fail("Password must be at least 8 characters.");
    if (!ROLES.includes(role)) return fail("Unknown role.");

    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing) return fail("An account with that email already exists.");

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        passwordHash: await hashPassword(password),
        name: name || email.split("@")[0],
        role,
      })
      .returning();

    return ok({ user: publicUser(user) });
  });
}
