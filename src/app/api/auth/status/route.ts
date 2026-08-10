import { isDatabaseConfigured } from "@/db";
import { countUsers, getSession } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    if (!isDatabaseConfigured()) {
      return ok({ configured: false, needsSetup: false, user: null });
    }
    if (!process.env.AUTH_SECRET) {
      return ok({
        configured: false,
        needsSetup: false,
        user: null,
        reason: "AUTH_SECRET is not set.",
      });
    }
    try {
      const [user, users] = await Promise.all([getSession(), countUsers()]);
      return ok({ configured: true, needsSetup: users === 0, user });
    } catch (error) {
      // Tables missing => migrations haven't run yet.
      return ok({
        configured: false,
        needsSetup: false,
        user: null,
        reason:
          error instanceof Error && /relation .* does not exist/i.test(error.message)
            ? "Database tables are missing. Run `npm run db:push`."
            : (error as Error).message,
      });
    }
  });
}
