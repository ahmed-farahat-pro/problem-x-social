import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { ROLES } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();

    const [[users], [companies], [boards], [posts]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.companies),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.boards),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.posts),
    ]);

    const byRole = await db
      .select({
        role: schema.users.role,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.users)
      .groupBy(schema.users.role);

    const roleCounts: Record<string, number> = {};
    for (const r of byRole) roleCounts[r.role] = r.count;

    return ok({
      totals: {
        users: users?.count ?? 0,
        companies: companies?.count ?? 0,
        boards: boards?.count ?? 0,
        posts: posts?.count ?? 0,
      },
      byRole: Object.fromEntries(ROLES.map((r) => [r, roleCounts[r] ?? 0])),
    });
  });
}
