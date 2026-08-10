import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";
import { isRole } from "@/lib/permissions";
import { fail, handle, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const { email = "", password = "" } = await readJson<{
      email?: string;
      password?: string;
    }>(request);

    const user = await findUserByEmail(email);
    // Same message either way so the form can't be used to enumerate accounts.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return fail("Email or password is incorrect.", 401);
    }

    const role = isRole(user.role) ? user.role : "content_creator";
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role,
    });
    return ok({
      user: { id: user.id, email: user.email, name: user.name, role },
    });
  });
}
