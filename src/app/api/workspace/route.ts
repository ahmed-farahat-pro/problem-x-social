import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { loadWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser();
    return ok(await loadWorkspace());
  });
}
