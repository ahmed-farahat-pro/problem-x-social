"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  CalendarDays,
  ChartColumn,
  FunnelX,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  Sheet,
  StickyNote,
  Table2,
} from "lucide-react";
import { BiText, EmptyState } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { EMPTY_FILTERS, type Post, type ViewMode } from "@/lib/types";
import { cn, firstLine, formatShort } from "@/lib/utils";

const POST_RESULT_CAP = 40;

const VIEW_ACTIONS: { mode: ViewMode; label: string; icon: ReactNode }[] = [
  { mode: "table", label: "Table", icon: <Table2 className="size-4" /> },
  { mode: "board", label: "Board", icon: <LayoutGrid className="size-4" /> },
  { mode: "calendar", label: "Calendar", icon: <CalendarDays className="size-4" /> },
  { mode: "dashboard", label: "Dashboard", icon: <ChartColumn className="size-4" /> },
];

type Group = "Actions" | "Sheets" | "Posts";

interface Item {
  id: string;
  group: Group;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  /** Arabic titles need bidi-aware rendering. */
  bidi?: boolean;
  run: () => void;
}

function postLabel(post: Post): string {
  return post.title.trim() || firstLine(post.content) || "Untitled post";
}

function postHaystack(post: Post): string {
  return [
    post.title,
    post.content,
    post.notes,
    post.contentType,
    post.platforms.join(" "),
  ]
    .join("\n")
    .toLowerCase();
}

/** Mounting the panel only while open keeps the query and highlight fresh. */
export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open || typeof document === "undefined") return null;
  return <Palette onClose={onClose} />;
}

function Palette({ onClose }: { onClose: () => void }) {
  const {
    workspace,
    companyId,
    board,
    setCompanyId,
    setBoardId,
    setFocusedId,
    setViewMode,
    setFilters,
    createPost,
    createBoard,
    createCompany,
  } = useStore();

  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }, [router]);

  const actions = useMemo<Item[]>(() => {
    const list: Item[] = [
      {
        id: "action:new-post",
        group: "Actions",
        icon: <Plus className="size-4" />,
        title: "New post",
        subtitle: board?.name,
        run: () => {
          void createPost().then((id) => {
            if (id) setFocusedId(id);
          });
        },
      },
    ];
    if (companyId) {
      list.push({
        id: "action:new-board",
        group: "Actions",
        icon: <Sheet className="size-4" />,
        title: "New sheet",
        run: () => void createBoard(companyId),
      });
    }
    list.push(
      {
        id: "action:new-company",
        group: "Actions",
        icon: <Building2 className="size-4" />,
        title: "New company",
        run: () => void createCompany(),
      },
      ...VIEW_ACTIONS.map<Item>(({ mode, label, icon }) => ({
        id: `action:view-${mode}`,
        group: "Actions",
        icon,
        title: `Switch to ${label} view`,
        run: () => setViewMode(mode),
      })),
      {
        id: "action:clear-filters",
        group: "Actions",
        icon: <FunnelX className="size-4" />,
        title: "Clear filters",
        run: () => setFilters(EMPTY_FILTERS),
      },
      {
        id: "action:sign-out",
        group: "Actions",
        icon: <LogOut className="size-4" />,
        title: "Sign out",
        run: () => void signOut(),
      },
    );
    return list;
  }, [
    board,
    companyId,
    createPost,
    createBoard,
    createCompany,
    setFocusedId,
    setViewMode,
    setFilters,
    signOut,
  ]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? actions.filter((a) => a.title.toLowerCase().includes(q))
      : actions;

    const sheets: Item[] = [];
    for (const c of workspace.companies) {
      for (const b of c.boards) {
        if (q && !`${b.name} ${c.name}`.toLowerCase().includes(q)) continue;
        sheets.push({
          id: `board:${b.id}`,
          group: "Sheets",
          icon: <Sheet className="size-4" />,
          title: `${b.emoji ? `${b.emoji} ` : ""}${b.name}`,
          subtitle: c.name,
          badge: String(b.posts.length),
          run: () => {
            setCompanyId(c.id);
            setBoardId(b.id);
          },
        });
      }
    }

    // Posts are only searched, never listed wholesale — a workspace has thousands.
    const posts: Item[] = [];
    if (q) {
      for (const c of workspace.companies) {
        for (const b of c.boards) {
          for (const p of b.posts) {
            if (!postHaystack(p).includes(q)) continue;
            posts.push({
              id: `post:${p.id}`,
              group: "Posts",
              icon: <StickyNote className="size-4" />,
              title: postLabel(p),
              subtitle: `${c.name} › ${b.name} · ${formatShort(p.date)}`,
              bidi: true,
              run: () => {
                setCompanyId(c.id);
                setBoardId(b.id);
                setFocusedId(p.id);
              },
            });
          }
        }
      }
    }

    return [...matched, ...sheets, ...posts.slice(0, POST_RESULT_CAP)];
  }, [query, actions, workspace, setCompanyId, setBoardId, setFocusedId]);

  // Clamp during render so a shrinking result set never points past the end.
  const index = items.length ? Math.min(active, items.length - 1) : 0;

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index, items]);

  const runItem = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      onClose();
      item.run();
    },
    [onClose],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive(items.length ? (index + 1) % items.length : 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(items.length ? (index - 1 + items.length) % items.length : 0);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(Math.max(0, items.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        runItem(items[index]);
        break;
      default:
        break;
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-center px-3 pt-[13vh]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className={cn(
          "animate-fade-up relative flex max-h-[70vh] w-full max-w-[620px] flex-col overflow-hidden",
          "rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-overlay)] shadow-2xl shadow-black/50",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4">
          <Search className="text-dim size-4 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search posts, sheets and actions…"
            aria-label="Search posts, sheets and actions"
            role="combobox"
            aria-expanded
            aria-controls="command-palette-results"
            aria-activedescendant={items[index] ? `cmd-${items[index].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-dim)]"
          />
        </div>

        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Results"
          className="min-h-0 flex-1 overflow-y-auto p-1.5"
        >
          {items.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="Nothing matches"
              message={`No posts, sheets or actions for “${query.trim()}”. Try a shorter phrase.`}
            />
          ) : (
            items.map((item, i) => {
              const showGroup = i === 0 || items[i - 1].group !== item.group;
              const selected = i === index;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <div className="text-dim px-2.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.08em] uppercase">
                      {item.group}
                    </div>
                  )}
                  <div
                    id={`cmd-${item.id}`}
                    role="option"
                    aria-selected={selected}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => runItem(item)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                      selected ? "bg-brand-500/15" : "hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg",
                        selected
                          ? "bg-brand-500 text-white"
                          : "bg-[var(--surface-hover)] text-muted",
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      {item.bidi ? (
                        <BiText text={item.title} clamp={1} className="text-sm" />
                      ) : (
                        <span className="block truncate text-sm">{item.title}</span>
                      )}
                      {item.subtitle && (
                        <span className="text-dim block truncate text-[11px]">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {item.badge && (
                      <span className="text-dim tabular shrink-0 rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="text-dim flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2 text-[11px]">
          <span>↑↓ navigate · ↩ open · esc close</span>
          <span className="tabular">
            {items.length} result{items.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
