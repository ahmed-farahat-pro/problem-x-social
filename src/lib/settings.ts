import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Runtime-configurable workspace settings. The admin panel writes these to the
 * `settings` table; anything unset falls back to its environment variable so a
 * deploy keeps working without touching the DB.
 */

export const SETTING_KEYS = {
  inviteCode: "invite_code",
  signupsOpen: "signups_open",
} as const;

async function readRaw(key: string): Promise<string | undefined> {
  try {
    const [row] = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .limit(1);
    return row?.value;
  } catch {
    return undefined;
  }
}

async function writeRaw(key: string, value: string): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value, updatedAt: new Date() },
    });
}

/** Invite code teammates need to self-register. Env INVITE_CODE is the fallback. */
export async function getInviteCode(): Promise<string | undefined> {
  return (await readRaw(SETTING_KEYS.inviteCode)) ?? process.env.INVITE_CODE;
}

/** Master switch for self-registration. Defaults to open when unset. */
export async function getSignupsOpen(): Promise<boolean> {
  const raw = await readRaw(SETTING_KEYS.signupsOpen);
  if (raw === undefined) return true;
  return raw === "1" || raw.toLowerCase() === "true";
}

export async function setInviteCode(value: string | null): Promise<void> {
  if (!value) {
    await db
      .delete(schema.settings)
      .where(eq(schema.settings.key, SETTING_KEYS.inviteCode));
    return;
  }
  await writeRaw(SETTING_KEYS.inviteCode, value);
}

export async function setSignupsOpen(open: boolean): Promise<void> {
  await writeRaw(SETTING_KEYS.signupsOpen, open ? "1" : "0");
}
