"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Columns3,
  Copy,
  Download,
  LayoutGrid,
  Menu as MenuIcon,
  Plus,
  Repeat,
  Search,
  Table2,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { GROUP_KEYS, type GroupKey, type ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Avatar,
  Button,
  EmptyState,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MiniBar,
  Segmented,
  Spinner,
} from "./ui";
import Sidebar from "./Sidebar";
import Toasts from "./Toasts";
import FilterBar from "./FilterBar";
import PostEditor from "./PostEditor";
import CommandPalette from "./CommandPalette";
import ExportDialog from "./ExportDialog";
import ImportDialog from "./ImportDialog";
import ScheduleDialog from "./ScheduleDialog";
import TableView from "./views/TableView";
import BoardView from "./views/BoardView";
import CalendarView from "./views/CalendarView";
import DashboardView from "./views/DashboardView";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "table", label: "Table", icon: <Table2 className="size-3.5" /> },
  { value: "board", label: "Board", icon: <Columns3 className="size-3.5" /> },
  { value: "calendar", label: "Calendar", icon: <CalendarDays className="size-3.5" /> },
  { value: "dashboard", label: "Insights", icon: <BarChart3 className="size-3.5" /> },
];

const GROUP_LABELS: Record<GroupKey, string> = {
  designStatus: "Design status",
  approval: "Approval",
  published: "Published",
  contentType: "Content type",
};

export default function AppShell() {
  const store = useStore();
  const {
    loading,
    error,
    company,
    board,
    viewMode,
    setViewMode,
    groupKey,
    setGroupKey,
    selected,
    createPost,
    createCompany,
    setFocusedId,
  } = store;

  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Global shortcuts. Ignore them while the user is typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (typing) return;
      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createPost();
        return;
      }
      if (mod && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setExportOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setImportOpen(true);
        return;
      }
      if (mod && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        setViewMode(VIEW_OPTIONS[Number(event.key) - 1].value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createPost, setViewMode]);

  // Close the mobile drawer when the viewport grows.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setNavOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="text-muted flex items-center gap-2 text-sm">
          <Spinner />
          Loading your workspace…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <EmptyState
          icon={<X className="size-5" />}
          title="Couldn't load the workspace"
          message={error}
          action={
            <Button variant="primary" onClick={() => location.reload()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const published = board?.posts.filter((p) => p.published === "Published").length ?? 0;
  const progress = board?.posts.length ? published / board.posts.length : 0;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar — persistent on desktop, drawer on mobile */}
      <aside className="hidden w-[262px] shrink-0 border-r border-[var(--line)] bg-[var(--surface-raised)] lg:block">
        <Sidebar />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          />
          <div className="animate-fade-up absolute inset-y-0 left-0 w-[86vw] max-w-[300px] border-r border-[var(--line)] bg-[var(--surface-raised)] shadow-2xl">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon className="size-4" />
          </Button>

          {company && board ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Avatar name={company.name} color={company.colorHex} size={30} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-dim hidden truncate text-[11px] sm:block">
                  {company.name}
                </p>
                <h1 className="truncate text-sm font-bold sm:text-[15px]">
                  <span className="mr-1">{board.emoji}</span>
                  {board.name}
                </h1>
              </div>
              {board.posts.length > 0 && (
                <div className="ml-2 hidden shrink-0 items-center gap-2 2xl:flex">
                  <MiniBar value={progress} color={company.colorHex} className="w-20" />
                  <span className="text-dim tabular text-[11px]">
                    {Math.round(progress * 100)}% published
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold">Problem-X Social</h1>
            </div>
          )}

          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={VIEW_OPTIONS}
            className="hidden shrink-0 lg:inline-flex"
            labelClassName="hidden 2xl:inline"
          />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPaletteOpen(true)}
              aria-label="Quick actions"
              title="Quick actions (⌘K)"
            >
              <Search className="size-4" />
            </Button>

            <Menu
              align="end"
              trigger={
                <span className="text-muted hover:text-body grid size-8 place-items-center rounded-lg transition-colors">
                  <Wand2 className="size-4" />
                </span>
              }
            >
              <MenuLabel>Bulk</MenuLabel>
              <MenuItem
                icon={<Repeat className="size-3.5" />}
                onClick={() => setScheduleOpen(true)}
              >
                Auto-schedule / repeat…
              </MenuItem>
              <MenuLabel>Data</MenuLabel>
              <MenuItem
                icon={<Upload className="size-3.5" />}
                onClick={() => setImportOpen(true)}
              >
                Import from Excel / CSV…
              </MenuItem>
              <MenuItem
                icon={<Download className="size-3.5" />}
                onClick={() => setExportOpen(true)}
              >
                Export…
              </MenuItem>
              {viewMode === "board" && (
                <>
                  <MenuSeparator />
                  <MenuLabel>Group board by</MenuLabel>
                  {GROUP_KEYS.map((key) => (
                    <MenuItem
                      key={key}
                      selected={groupKey === key}
                      onClick={() => setGroupKey(key)}
                    >
                      {GROUP_LABELS[key]}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>

            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                const id = await createPost();
                if (id) setFocusedId(id);
              }}
              disabled={!board}
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New post</span>
            </Button>
          </div>
        </header>

        {board && <FilterBar />}

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!company ? (
            <EmptyState
              icon={<LayoutGrid className="size-5" />}
              title="No company yet"
              message="Create a company to start planning content — or import the tracker you already use."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => void createCompany()}>
                    <Plus className="size-3.5" />
                    Create a company
                  </Button>
                  <Button onClick={() => setImportOpen(true)}>
                    <Upload className="size-3.5" />
                    Import a tracker
                  </Button>
                </div>
              }
            />
          ) : !board ? (
            <EmptyState
              icon={<Table2 className="size-5" />}
              title="No sheet selected"
              message="Pick a sheet from the sidebar, or create a new one for this company."
              action={
                <Button
                  variant="primary"
                  onClick={() => void store.createBoard(company.id)}
                >
                  <Plus className="size-3.5" />
                  New sheet
                </Button>
              }
            />
          ) : viewMode === "table" ? (
            <TableView />
          ) : viewMode === "board" ? (
            <BoardView />
          ) : viewMode === "calendar" ? (
            <CalendarView />
          ) : (
            <DashboardView />
          )}
        </main>

        {selected.size > 0 && (
          <SelectionBar onSchedule={() => setScheduleOpen(true)} />
        )}

        {/* Mobile view switcher */}
        <nav className="flex items-center justify-around border-t border-[var(--line)] bg-[var(--surface-raised)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setViewMode(option.value)}
              aria-current={viewMode === option.value}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                viewMode === option.value ? "text-brand-400" : "text-dim",
              )}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Editor — inline panel on desktop, drawer on mobile */}
      <PostEditor />

      <Toasts />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />

    </div>
  );
}

function SelectionBar({ onSchedule }: { onSchedule: () => void }) {
  const {
    selected,
    setSelected,
    deletePosts,
    duplicatePosts,
    bulkUpdate,
    movePosts,
    workspace,
    boardId,
    notify,
    board,
  } = useStore();
  const ids = [...selected];

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 sm:px-4">
      <span className="text-brand-400 text-xs font-semibold">
        {ids.length} selected
      </span>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          const rows = (board?.posts ?? []).filter((p) => selected.has(p.id));
          const text = rows
            .map((p) =>
              [
                p.date ?? "",
                p.contentType,
                p.title,
                p.content.replace(/\n/g, "\\n"),
                p.platforms.join(", "),
                p.designStatus,
                p.approval,
                p.published,
              ].join("\t"),
            )
            .join("\n");
          void navigator.clipboard.writeText(text);
          notify(`Copied ${rows.length} row${rows.length === 1 ? "" : "s"}`);
        }}
      >
        <Copy className="size-3.5" />
        <span className="hidden sm:inline">Copy</span>
      </Button>

      <Button size="sm" variant="ghost" onClick={() => void duplicatePosts(ids)}>
        <Copy className="size-3.5" />
        <span className="hidden sm:inline">Duplicate</span>
      </Button>

      <Button size="sm" variant="ghost" onClick={onSchedule}>
        <CalendarDays className="size-3.5" />
        <span className="hidden sm:inline">Schedule</span>
      </Button>

      <Menu
        trigger={
          <span className="text-muted hover:text-body inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium">
            Set status
          </span>
        }
      >
        <MenuLabel>Design</MenuLabel>
        {(["Not Started", "In Progress", "Design Ready", "Uploaded to Drive"] as const).map(
          (value) => (
            <MenuItem key={value} onClick={() => void bulkUpdate(ids, { designStatus: value })}>
              {value}
            </MenuItem>
          ),
        )}
        <MenuLabel>Approval</MenuLabel>
        {(["Pending", "Approved", "Needs Revision"] as const).map((value) => (
          <MenuItem key={value} onClick={() => void bulkUpdate(ids, { approval: value })}>
            {value}
          </MenuItem>
        ))}
        <MenuLabel>Published</MenuLabel>
        {(["Not Yet", "Scheduled", "Published"] as const).map((value) => (
          <MenuItem key={value} onClick={() => void bulkUpdate(ids, { published: value })}>
            {value}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        trigger={
          <span className="text-muted hover:text-body inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium">
            Move to
          </span>
        }
      >
        {workspace.companies.map((c) => (
          <div key={c.id}>
            <MenuLabel>{c.name}</MenuLabel>
            {c.boards.map((b) => (
              <MenuItem
                key={b.id}
                disabled={b.id === boardId}
                onClick={() => void movePosts(ids, b.id)}
              >
                {b.emoji} {b.name}
              </MenuItem>
            ))}
          </div>
        ))}
      </Menu>

      <div className="flex-1" />

      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          if (confirm(`Delete ${ids.length} post(s)?`)) void deletePosts(ids);
        }}
      >
        <Trash2 className="size-3.5" />
        <span className="hidden sm:inline">Delete</span>
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
