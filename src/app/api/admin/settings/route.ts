import { requireAdmin } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import {
  getInviteCode,
  getSignupsOpen,
  setInviteCode,
  setSignupsOpen,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const [inviteCode, signupsOpen] = await Promise.all([
      getInviteCode(),
      getSignupsOpen(),
    ]);
    return ok({ inviteCode: inviteCode ?? "", signupsOpen });
  });
}

interface PatchBody {
  inviteCode?: string | null;
  signupsOpen?: boolean;
}

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await readJson<PatchBody>(request);

    if (body.signupsOpen !== undefined) {
      if (typeof body.signupsOpen !== "boolean")
        return fail("signupsOpen must be a boolean.");
      await setSignupsOpen(body.signupsOpen);
    }

    if (body.inviteCode !== undefined) {
      const value =
        typeof body.inviteCode === "string" ? body.inviteCode.trim() : null;
      if (value !== null && value.length > 0 && value.length < 3) {
        return fail("Invite code is too short.");
      }
      await setInviteCode(value);
    }

    const [inviteCode, signupsOpen] = await Promise.all([
      getInviteCode(),
      getSignupsOpen(),
    ]);
    return ok({ inviteCode: inviteCode ?? "", signupsOpen });
  });
}
