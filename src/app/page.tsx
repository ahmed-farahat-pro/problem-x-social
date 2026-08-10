import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { getSession } from "@/lib/auth";
import { loadWorkspace } from "@/lib/workspace";
import { PREFS_COOKIE, parsePrefs } from "@/lib/prefs";
import { WorkspaceProvider } from "@/lib/store";
import AppShell from "@/components/AppShell";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import SetupNotice from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isDatabaseConfigured() || !process.env.AUTH_SECRET) {
    return await SetupNotice();
  }

  let user;
  try {
    user = await getSession();
  } catch {
    return await SetupNotice();
  }
  if (!user) redirect("/login");

  // Workspace and UI prefs both resolve on the server, so the first paint is
  // the real app in the view the user left it in — and hydration matches.
  let workspace;
  try {
    workspace = await loadWorkspace();
  } catch {
    return await SetupNotice();
  }

  const store = await cookies();
  const prefs = parsePrefs(store.get(PREFS_COOKIE)?.value);

  return (
    <WorkspaceProvider user={user} initialWorkspace={workspace} prefs={prefs}>
      <ConfirmProvider>
        <AppShell />
      </ConfirmProvider>
    </WorkspaceProvider>
  );
}
