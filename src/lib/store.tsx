"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_FILTERS,
  type Board,
  type Company,
  type Filters,
  type GroupKey,
  type Post,
  type PostInput,
  type SessionUser,
  type SortField,
  type ViewMode,
  type Workspace,
} from "./types";
import { writePrefs, type Prefs } from "./prefs";
import { todayISO, weekStart } from "./utils";

// ------------------------------------------------------------------ requests

async function api<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(url, {
    ...rest,
    headers: json
      ? { "Content-Type": "application/json", ...(rest.headers ?? {}) }
      : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

// -------------------------------------------------------------------- stats

export interface Stats {
  total: number;
  published: number;
  scheduled: number;
  notYet: number;
  approved: number;
  pending: number;
  needsRevision: number;
  designDone: number;
  byType: { name: string; value: number }[];
  byPlatform: { name: string; value: number }[];
  byWeek: { week: string; value: number }[];
  upcoming: Post[];
  overdue: Post[];
}

export function computeStats(posts: Post[]): Stats {
  const types = new Map<string, number>();
  const platforms = new Map<string, number>();
  const weeks = new Map<string, number>();

  for (const p of posts) {
    if (p.contentType) types.set(p.contentType, (types.get(p.contentType) ?? 0) + 1);
    for (const plat of p.platforms) {
      platforms.set(plat, (platforms.get(plat) ?? 0) + 1);
    }
    if (p.date) {
      const w = weekStart(p.date);
      weeks.set(w, (weeks.get(w) ?? 0) + 1);
    }
  }

  const today = todayISO();
  return {
    total: posts.length,
    published: posts.filter((p) => p.published === "Published").length,
    scheduled: posts.filter((p) => p.published === "Scheduled").length,
    notYet: posts.filter((p) => p.published === "Not Yet").length,
    approved: posts.filter((p) => p.approval === "Approved").length,
    pending: posts.filter((p) => p.approval === "Pending").length,
    needsRevision: posts.filter((p) => p.approval === "Needs Revision").length,
    designDone: posts.filter((p) => p.designStatus === "Uploaded to Drive").length,
    byType: [...types.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    byPlatform: [...platforms.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    byWeek: [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, value]) => ({ week, value })),
    upcoming: posts
      .filter((p) => p.date && p.date >= today && p.published !== "Published")
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    overdue: posts
      .filter((p) => p.date && p.date < today && p.published !== "Published")
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
  };
}

// ------------------------------------------------------------------- filters

function matchesSearch(post: Post, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    post.title, post.content, post.notes, post.ideas, post.contentType,
    post.driveLink, post.owner, post.platforms.join(" "), post.tags.join(" "),
    post.designStatus, post.approval, post.published,
  ]
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function applyFilters(posts: Post[], filters: Filters): Post[] {
  return posts.filter((p) => {
    if (!matchesSearch(p, filters.search)) return false;
    if (filters.types.length && !filters.types.includes(p.contentType)) return false;
    if (
      filters.platforms.length &&
      !p.platforms.some((x) => filters.platforms.includes(x))
    )
      return false;
    if (filters.design.length && !filters.design.includes(p.designStatus)) return false;
    if (filters.approval.length && !filters.approval.includes(p.approval)) return false;
    if (filters.published.length && !filters.published.includes(p.published)) return false;
    return true;
  });
}

const TYPE_ORDER = ["Static Post", "Carousel Post", "Reel", "Story", "Video"];
const DESIGN_ORDER = ["Not Started", "In Progress", "Design Ready", "Uploaded to Drive"];
const APPROVAL_ORDER = ["Pending", "Approved", "Needs Revision"];
const PUBLISH_ORDER = ["Not Yet", "Scheduled", "Published"];

export function sortPosts(posts: Post[], field: SortField, asc: boolean): Post[] {
  const dir = asc ? 1 : -1;
  const rank = (list: string[], value: string) => {
    const i = list.indexOf(value);
    return i === -1 ? list.length : i;
  };

  const sorted = [...posts];
  if (field === "date") {
    // Undated posts stay parked at the bottom in both directions.
    const dated = sorted.filter((p) => p.date);
    const undated = sorted.filter((p) => !p.date);
    dated.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") * dir);
    return [...dated, ...undated];
  }

  sorted.sort((a, b) => {
    switch (field) {
      case "title":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) * dir;
      case "contentType":
        return (rank(TYPE_ORDER, a.contentType) - rank(TYPE_ORDER, b.contentType)) * dir;
      case "designStatus":
        return (rank(DESIGN_ORDER, a.designStatus) - rank(DESIGN_ORDER, b.designStatus)) * dir;
      case "approval":
        return (rank(APPROVAL_ORDER, a.approval) - rank(APPROVAL_ORDER, b.approval)) * dir;
      case "published":
        return (rank(PUBLISH_ORDER, a.published) - rank(PUBLISH_ORDER, b.published)) * dir;
      case "updatedAt":
        return a.updatedAt.localeCompare(b.updatedAt) * dir;
      default:
        return 0;
    }
  });
  return sorted;
}

// -------------------------------------------------------------------- store

export interface Toast {
  id: string;
  message: string;
  tone: "ok" | "error";
}

interface StoreValue {
  user: SessionUser | null;
  workspace: Workspace;
  loading: boolean;
  error: string | null;

  companyId: string | null;
  boardId: string | null;
  company: Company | null;
  board: Board | null;

  selected: Set<string>;
  focusedId: string | null;
  focusedPost: Post | null;

  viewMode: ViewMode;
  groupKey: GroupKey;
  filters: Filters;
  sortField: SortField;
  sortAsc: boolean;

  visiblePosts: Post[];
  stats: Stats;
  toasts: Toast[];

  setCompanyId: (id: string | null) => void;
  setBoardId: (id: string | null) => void;
  setSelected: (ids: Set<string>) => void;
  toggleSelected: (id: string, additive?: boolean) => void;
  setFocusedId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setGroupKey: (key: GroupKey) => void;
  setFilters: (update: Filters | ((prev: Filters) => Filters)) => void;
  setSort: (field: SortField) => void;

  refresh: () => Promise<void>;
  notify: (message: string, tone?: "ok" | "error") => void;

  createCompany: (name?: string) => Promise<string | null>;
  updateCompany: (id: string, patch: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;

  createBoard: (companyId: string, name?: string, duplicateOf?: string) => Promise<string | null>;
  updateBoard: (id: string, patch: Partial<Board>) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;

  createPost: (input?: PostInput) => Promise<string | null>;
  updatePost: (id: string, patch: PostInput, immediate?: boolean) => void;
  deletePosts: (ids: string[]) => Promise<void>;
  duplicatePosts: (ids: string[], offsetDays?: number) => Promise<void>;
  bulkUpdate: (ids: string[], patch: PostInput) => Promise<void>;
  movePosts: (ids: string[], boardId: string) => Promise<void>;
  reschedule: (
    ids: string[],
    start: string,
    step: number,
    skipWeekends: boolean,
  ) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <WorkspaceProvider>");
  return value;
}

export function WorkspaceProvider({
  user,
  initialWorkspace,
  prefs = {},
  children,
}: {
  user: SessionUser | null;
  /** Rendered on the server, so the first paint already has real data. */
  initialWorkspace: Workspace;
  /** Read from the prefs cookie on the server — keeps hydration in sync. */
  prefs?: Prefs;
  children: ReactNode;
}) {
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyIdPref, setCompanyId] = useState<string | null>(
    prefs.companyId ?? null,
  );
  const [boardIdPref, setBoardId] = useState<string | null>(prefs.boardId ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(prefs.viewMode ?? "table");
  const [groupKey, setGroupKey] = useState<GroupKey>(
    prefs.groupKey ?? "designStatus",
  );
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc, setSortAsc] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ------------------------------------------------------------ loading

  const refresh = useCallback(async () => {
    try {
      const data = await api<Workspace>("/api/workspace");
      setWorkspace(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ------------------------------------------------------------ derived
  // Selection resolves during render rather than being repaired in an effect,
  // so a stored id that no longer exists just falls back to the first entry.

  const company = useMemo(
    () =>
      workspace.companies.find((c) => c.id === companyIdPref) ??
      workspace.companies[0] ??
      null,
    [workspace, companyIdPref],
  );
  const board = useMemo(
    () =>
      company?.boards.find((b) => b.id === boardIdPref) ??
      company?.boards[0] ??
      null,
    [company, boardIdPref],
  );
  const companyId = company?.id ?? null;
  const boardId = board?.id ?? null;

  useEffect(() => {
    writePrefs({ companyId: companyId ?? undefined, boardId: boardId ?? undefined, viewMode, groupKey });
  }, [companyId, boardId, viewMode, groupKey]);

  const visiblePosts = useMemo(
    () => sortPosts(applyFilters(board?.posts ?? [], filters), sortField, sortAsc),
    [board, filters, sortField, sortAsc],
  );
  const stats = useMemo(() => computeStats(visiblePosts), [visiblePosts]);
  const focusedPost = useMemo(
    () => board?.posts.find((p) => p.id === focusedId) ?? null,
    [board, focusedId],
  );

  // ------------------------------------------------------- local mutation

  const patchLocal = useCallback(
    (fn: (draft: Workspace) => Workspace) => setWorkspace((ws) => fn(ws)),
    [],
  );

  const upsertPosts = useCallback(
    (targetBoardId: string, posts: Post[]) =>
      patchLocal((ws) => ({
        companies: ws.companies.map((c) => ({
          ...c,
          boards: c.boards.map((b) =>
            b.id === targetBoardId
              ? {
                  ...b,
                  posts: [
                    ...b.posts.filter((p) => !posts.some((n) => n.id === p.id)),
                    ...posts,
                  ],
                }
              : b,
          ),
        })),
      })),
    [patchLocal],
  );

  // ------------------------------------------------------------ actions

  const createCompany = useCallback(
    async (name = "New Company") => {
      try {
        const { company: created, board: createdBoard } = await api<{
          company: Omit<Company, "boards">;
          board: Omit<Board, "posts"> | null;
        }>("/api/companies", { method: "POST", json: { name } });
        await refresh();
        setCompanyId(created.id);
        setBoardId(createdBoard?.id ?? null);
        notify(`Added “${created.name}”`);
        return created.id;
      } catch (e) {
        notify((e as Error).message, "error");
        return null;
      }
    },
    [refresh, notify],
  );

  const updateCompany = useCallback(
    async (id: string, patch: Partial<Company>) => {
      patchLocal((ws) => ({
        companies: ws.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
      try {
        await api(`/api/companies/${id}`, { method: "PATCH", json: patch });
      } catch (e) {
        notify((e as Error).message, "error");
        void refresh();
      }
    },
    [patchLocal, notify, refresh],
  );

  const deleteCompany = useCallback(
    async (id: string) => {
      const previous = workspace;
      patchLocal((ws) => ({ companies: ws.companies.filter((c) => c.id !== id) }));
      if (companyId === id) {
        const next = previous.companies.find((c) => c.id !== id) ?? null;
        setCompanyId(next?.id ?? null);
        setBoardId(next?.boards[0]?.id ?? null);
      }
      try {
        await api(`/api/companies/${id}`, { method: "DELETE" });
        notify("Company deleted");
      } catch (e) {
        setWorkspace(previous);
        notify((e as Error).message, "error");
      }
    },
    [workspace, companyId, patchLocal, notify],
  );

  const createBoard = useCallback(
    async (targetCompanyId: string, name = "New Sheet", duplicateOf?: string) => {
      try {
        const { board: created } = await api<{ board: Omit<Board, "posts"> }>(
          "/api/boards",
          { method: "POST", json: { companyId: targetCompanyId, name, duplicateOf } },
        );
        await refresh();
        setCompanyId(targetCompanyId);
        setBoardId(created.id);
        notify(`Added “${created.name}”`);
        return created.id;
      } catch (e) {
        notify((e as Error).message, "error");
        return null;
      }
    },
    [refresh, notify],
  );

  const updateBoard = useCallback(
    async (id: string, patch: Partial<Board>) => {
      patchLocal((ws) => ({
        companies: ws.companies.map((c) => ({
          ...c,
          boards: c.boards.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      }));
      try {
        await api(`/api/boards/${id}`, { method: "PATCH", json: patch });
      } catch (e) {
        notify((e as Error).message, "error");
        void refresh();
      }
    },
    [patchLocal, notify, refresh],
  );

  const deleteBoard = useCallback(
    async (id: string) => {
      const previous = workspace;
      patchLocal((ws) => ({
        companies: ws.companies.map((c) => ({
          ...c,
          boards: c.boards.filter((b) => b.id !== id),
        })),
      }));
      if (boardId === id) {
        const nextBoard = previous.companies
          .find((c) => c.id === companyId)
          ?.boards.find((b) => b.id !== id);
        setBoardId(nextBoard?.id ?? null);
      }
      try {
        await api(`/api/boards/${id}`, { method: "DELETE" });
        notify("Sheet deleted");
      } catch (e) {
        setWorkspace(previous);
        notify((e as Error).message, "error");
      }
    },
    [workspace, boardId, companyId, patchLocal, notify],
  );

  const createPost = useCallback(
    async (input: PostInput = {}) => {
      if (!boardId) return null;
      // Continue the cadence: the day after the latest planned date.
      const dates = (board?.posts ?? []).map((p) => p.date).filter(Boolean) as string[];
      const latest = dates.sort().at(-1);
      const fallbackDate = latest
        ? (() => {
            const [y, m, d] = latest.split("-").map(Number);
            const next = new Date(y, m - 1, d + 1);
            return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
          })()
        : todayISO();

      try {
        const { post } = await api<{ post: Post }>("/api/posts", {
          method: "POST",
          json: { boardId, date: fallbackDate, ...input },
        });
        upsertPosts(boardId, [post]);
        setFocusedId(post.id);
        setSelected(new Set([post.id]));
        return post.id;
      } catch (e) {
        notify((e as Error).message, "error");
        return null;
      }
    },
    [boardId, board, upsertPosts, notify],
  );

  // Field edits fire constantly while typing, so writes are debounced per post
  // and coalesced into a single PATCH.
  const pending = useRef(new Map<string, { patch: PostInput; timer: number }>());

  const flushPost = useCallback(
    async (id: string) => {
      const entry = pending.current.get(id);
      if (!entry) return;
      pending.current.delete(id);
      try {
        await api(`/api/posts/${id}`, { method: "PATCH", json: entry.patch });
      } catch (e) {
        notify((e as Error).message, "error");
        void refresh();
      }
    },
    [notify, refresh],
  );

  const updatePost = useCallback(
    (id: string, patch: PostInput, immediate = false) => {
      patchLocal((ws) => ({
        companies: ws.companies.map((c) => ({
          ...c,
          boards: c.boards.map((b) => ({
            ...b,
            posts: b.posts.map((p) =>
              p.id === id
                ? { ...p, ...patch, updatedAt: new Date().toISOString() }
                : p,
            ),
          })),
        })),
      }));

      const existing = pending.current.get(id);
      if (existing) window.clearTimeout(existing.timer);
      const merged = { ...(existing?.patch ?? {}), ...patch };
      const timer = window.setTimeout(() => void flushPost(id), immediate ? 0 : 550);
      pending.current.set(id, { patch: merged, timer });
    },
    [patchLocal, flushPost],
  );

  // Don't lose the last keystroke when the tab goes away.
  useEffect(() => {
    const flushAll = () => {
      for (const [id, entry] of pending.current) {
        window.clearTimeout(entry.timer);
        navigator.sendBeacon?.(
          `/api/posts/${id}`,
          new Blob([JSON.stringify(entry.patch)], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("pagehide", flushAll);
    return () => window.removeEventListener("pagehide", flushAll);
  }, []);

  const deletePosts = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      const previous = workspace;
      patchLocal((ws) => ({
        companies: ws.companies.map((c) => ({
          ...c,
          boards: c.boards.map((b) => ({
            ...b,
            posts: b.posts.filter((p) => !ids.includes(p.id)),
          })),
        })),
      }));
      setSelected(new Set());
      if (focusedId && ids.includes(focusedId)) setFocusedId(null);
      try {
        await api("/api/posts/bulk", {
          method: "POST",
          json: { action: "delete", ids },
        });
        notify(`Deleted ${ids.length} post${ids.length === 1 ? "" : "s"}`);
      } catch (e) {
        setWorkspace(previous);
        notify((e as Error).message, "error");
      }
    },
    [workspace, focusedId, patchLocal, notify],
  );

  const bulkUpdate = useCallback(
    async (ids: string[], patch: PostInput) => {
      if (!ids.length) return;
      patchLocal((ws) => ({
        companies: ws.companies.map((c) => ({
          ...c,
          boards: c.boards.map((b) => ({
            ...b,
            posts: b.posts.map((p) => (ids.includes(p.id) ? { ...p, ...patch } : p)),
          })),
        })),
      }));
      try {
        await api("/api/posts/bulk", {
          method: "POST",
          json: { action: "update", ids, patch },
        });
      } catch (e) {
        notify((e as Error).message, "error");
        void refresh();
      }
    },
    [patchLocal, notify, refresh],
  );

  const duplicatePosts = useCallback(
    async (ids: string[], offsetDays = 0) => {
      if (!ids.length || !boardId) return;
      try {
        const { posts } = await api<{ posts: Post[] }>("/api/posts/bulk", {
          method: "POST",
          json: { action: "duplicate", ids, offsetDays },
        });
        upsertPosts(boardId, posts);
        notify(
          offsetDays
            ? `Repeated ${posts.length} post${posts.length === 1 ? "" : "s"} (+${offsetDays}d)`
            : `Duplicated ${posts.length} post${posts.length === 1 ? "" : "s"}`,
        );
      } catch (e) {
        notify((e as Error).message, "error");
      }
    },
    [boardId, upsertPosts, notify],
  );

  const movePosts = useCallback(
    async (ids: string[], targetBoardId: string) => {
      if (!ids.length) return;
      try {
        await api("/api/posts/bulk", {
          method: "POST",
          json: { action: "move", ids, boardId: targetBoardId },
        });
        await refresh();
        setSelected(new Set());
        notify(`Moved ${ids.length} post${ids.length === 1 ? "" : "s"}`);
      } catch (e) {
        notify((e as Error).message, "error");
      }
    },
    [refresh, notify],
  );

  const reschedule = useCallback(
    async (ids: string[], start: string, step: number, skipWeekends: boolean) => {
      if (!ids.length) return;
      try {
        const { posts } = await api<{ posts: Post[] }>("/api/posts/bulk", {
          method: "POST",
          json: { action: "reschedule", ids, start, step, skipWeekends },
        });
        if (boardId) upsertPosts(boardId, posts);
        notify(`Scheduled ${posts.length} post${posts.length === 1 ? "" : "s"}`);
      } catch (e) {
        notify((e as Error).message, "error");
      }
    },
    [boardId, upsertPosts, notify],
  );

  const toggleSelected = useCallback((id: string, additive = false) => {
    setSelected((prev) => {
      if (!additive) return prev.has(id) && prev.size === 1 ? new Set() : new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setSort = useCallback((field: SortField) => {
    setSortField((current) => {
      if (current === field) {
        setSortAsc((a) => !a);
        return current;
      }
      setSortAsc(true);
      return field;
    });
  }, []);

  const value: StoreValue = {
    user,
    workspace,
    loading,
    error,
    companyId,
    boardId,
    company,
    board,
    selected,
    focusedId,
    focusedPost,
    viewMode,
    groupKey,
    filters,
    sortField,
    sortAsc,
    visiblePosts,
    stats,
    toasts,
    setCompanyId,
    setBoardId,
    setSelected,
    toggleSelected,
    setFocusedId,
    setViewMode,
    setGroupKey,
    setFilters,
    setSort,
    refresh,
    notify,
    createCompany,
    updateCompany,
    deleteCompany,
    createBoard,
    updateBoard,
    deleteBoard,
    createPost,
    updatePost,
    deletePosts,
    duplicatePosts,
    bulkUpdate,
    movePosts,
    reschedule,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
