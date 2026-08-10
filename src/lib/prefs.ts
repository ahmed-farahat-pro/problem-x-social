import { GROUP_KEYS, VIEW_MODES, type GroupKey, type ViewMode } from "./types";

export const PREFS_COOKIE = "px_prefs";

export interface Prefs {
  companyId?: string;
  boardId?: string;
  viewMode?: ViewMode;
  groupKey?: GroupKey;
}

/**
 * UI preferences live in a plain cookie rather than localStorage so the server
 * render and the hydration render agree — otherwise the first paint shows the
 * default view and then snaps to the stored one.
 */
export function parsePrefs(raw: string | undefined): Prefs {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Prefs;
    return {
      companyId: typeof parsed.companyId === "string" ? parsed.companyId : undefined,
      boardId: typeof parsed.boardId === "string" ? parsed.boardId : undefined,
      viewMode: VIEW_MODES.includes(parsed.viewMode as ViewMode)
        ? parsed.viewMode
        : undefined,
      groupKey: GROUP_KEYS.includes(parsed.groupKey as GroupKey)
        ? parsed.groupKey
        : undefined,
    };
  } catch {
    return {};
  }
}

export function writePrefs(prefs: Prefs) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${PREFS_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}
