import { redirect } from "next/navigation";
import { asc, sql } from "drizzle-orm";
import { isDatabaseConfigured } from "@/db";
import { db, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { getInviteCode, getSignupsOpen } from "@/lib/settings";
import { ROLES, isRole } from "@/lib/permissions";
import SetupNotice from "@/components/SetupNotice";
import { ToastProvider } from "@/components/ToastProvider";
import AdminPanel from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return await SetupNotice();
  }

  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const [userRows, [users], [companies], [boards], [posts], inviteCode, signupsOpen] =
    await Promise.all([
      db.select().from(schema.users).orderBy(asc(schema.users.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.companies),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.boards),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.posts),
      getInviteCode(),
      getSignupsOpen(),
    ]);

  const byRole = await db
    .select({ role: schema.users.role, count: sql<number>`count(*)::int` })
    .from(schema.users)
    .groupBy(schema.users.role);
  const roleCounts: Record<string, number> = {};
  for (const r of byRole) roleCounts[r.role] = r.count;

  const initialUsers = userRows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: (isRole(u.role) ? u.role : "content_creator") as (typeof ROLES)[number],
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <ToastProvider>
      <AdminPanel
        currentUser={{ id: user.id, email: user.email, name: user.name, role: user.role }}
        initialUsers={initialUsers}
        initialStats={{
          totals: {
            users: users?.count ?? 0,
            companies: companies?.count ?? 0,
            boards: boards?.count ?? 0,
            posts: posts?.count ?? 0,
          },
          byRole: Object.fromEntries(ROLES.map((r) => [r, roleCounts[r] ?? 0])),
        }}
        initialSettings={{
          inviteCode: inviteCode ?? "",
          signupsOpen,
        }}
      />
    </ToastProvider>
  );
}
