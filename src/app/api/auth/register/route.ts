import { db, schema } from "@/db";
import {
  countUsers,
  createSession,
  findUserByEmail,
  hashPassword,
} from "@/lib/auth";
import { isRole } from "@/lib/permissions";
import { getInviteCode, getSignupsOpen } from "@/lib/settings";
import { fail, handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";

interface Body {
  email?: string;
  password?: string;
  name?: string;
  inviteCode?: string;
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<Body>(request);
    const email = (body.email ?? "").toLowerCase().trim();
    const password = body.password ?? "";
    const name = (body.name ?? "").trim();

    if (!email.includes("@")) return fail("Enter a valid email address.");
    if (password.length < 8)
      return fail("Password must be at least 8 characters.");

    const existingUsers = await countUsers();

    // The first account is open so the owner can claim a fresh deploy.
    // Every later signup needs the invite code and open signups.
    if (existingUsers > 0) {
      const signupsOpen = await getSignupsOpen();
      if (!signupsOpen) {
        return fail("Sign-ups are closed. Ask an admin for an account.", 403);
      }
      const expected = await getInviteCode();
      if (!expected) {
        return fail(
          "Sign-ups are closed. Ask an admin to set an invite code.",
          403,
        );
      }
      if (body.inviteCode !== expected) {
        return fail("That invite code isn't right.", 403);
      }
    }

    if (await findUserByEmail(email)) {
      return fail("An account with that email already exists.");
    }

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        passwordHash: await hashPassword(password),
        name: name || email.split("@")[0],
        // The very first account claims the workspace as its owner.
        role: existingUsers === 0 ? "owner" : "content_creator",
      })
      .returning();

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: isRole(user.role) ? user.role : "content_creator",
    });
    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: isRole(user.role) ? user.role : "content_creator",
      },
    });
  });
}
