"use client";

import { useState } from "react";
import {
  ChevronRight,
  Copy,
  FilePlus2,
  LogOut,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useConfirm } from "./ConfirmProvider";
import { COMPANY_PALETTE } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { Board, Company } from "@/lib/types";
import {
  Avatar,
  Button,
  Input,
  Label,
  Menu,
  MenuItem,
  MenuSeparator,
  MiniBar,
  Modal,
  Textarea,
} from "./ui";

const EMOJI_CHOICES = ["🗓️", "📄", "🚀", "🎯", "✨", "🔥", "📣", "🎬", "📸", "💡", "🧪", "🏆"];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const store = useStore();
  const confirm = useConfirm();
  const {
    workspace,
    companyId,
    boardId,
    setCompanyId,
    setBoardId,
    createCompany,
    createBoard,
    deleteCompany,
    deleteBoard,
  } = store;

  // Tri-state: undefined means "follow the active company", so selecting a
  // company opens it without an effect repairing state after the fact.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<
    { kind: "company"; company: Company } | { kind: "board"; board: Board } | null
  >(null);
  const [branding, setBranding] = useState<Company | null>(null);

  const totals = workspace.companies.reduce(
    (acc, c) => {
      acc.sheets += c.boards.length;
      acc.posts += c.boards.reduce((n, b) => n + b.posts.length, 0);
      return acc;
    },
    { sheets: 0, posts: 0 },
  );

  const isOpen = (id: string) => override[id] ?? id === companyId;

  function toggle(id: string) {
    setOverride((prev) => ({ ...prev, [id]: !isOpen(id) }));
  }

  function selectBoard(company: Company, board: Board) {
    setCompanyId(company.id);
    setBoardId(board.id);
    onNavigate?.();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-3.5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="brand-gradient grid size-8 place-items-center rounded-[10px] text-base font-black text-white">
            X
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold">Problem-X</p>
            <p className="text-[9px] font-black tracking-[0.22em] text-accent-500">
              SOCIAL
            </p>
          </div>
        </div>
        <div className="text-dim mt-3 flex items-center gap-3 text-[11px]">
          <Stat value={workspace.companies.length} label="brands" />
          <Stat value={totals.sheets} label="sheets" />
          <Stat value={totals.posts} label="posts" />
        </div>
      </header>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {workspace.companies.length === 0 && (
          <p className="text-dim px-2 py-6 text-center text-xs">
            No companies yet.
          </p>
        )}

        {workspace.companies.map((company) => {
          const open = isOpen(company.id);
          const posts = company.boards.reduce((n, b) => n + b.posts.length, 0);
          return (
            <div key={company.id}>
              <div
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors",
                  companyId === company.id
                    ? "bg-[var(--surface-hover)]"
                    : "hover:bg-[var(--surface-hover)]",
                )}
              >
                <button
                  onClick={() => toggle(company.id)}
                  aria-label={open ? "Collapse" : "Expand"}
                  aria-expanded={open}
                  className="text-dim hover:text-body grid size-4 shrink-0 place-items-center rounded focus-ring"
                >
                  <ChevronRight
                    className={cn("size-3.5 transition-transform", open && "rotate-90")}
                  />
                </button>

                <button
                  onClick={() => {
                    setCompanyId(company.id);
                    if (!company.boards.some((b) => b.id === boardId)) {
                      setBoardId(company.boards[0]?.id ?? null);
                    }
                    toggle(company.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-ring rounded"
                >
                  <Avatar name={company.name} color={company.colorHex} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {company.name}
                    </span>
                    {company.handle && (
                      <span className="text-dim block truncate text-[10px]">
                        {company.handle}
                      </span>
                    )}
                  </span>
                </button>

                <span
                  className="tabular text-dim rounded-full px-1.5 py-px text-[10px] font-semibold"
                  style={{ background: `${company.colorHex}22` }}
                >
                  {posts}
                </span>

                <Menu
                  align="end"
                  trigger={
                    <span className="text-dim hover:text-body grid size-6 place-items-center rounded-md opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <MoreHorizontal className="size-3.5" />
                    </span>
                  }
                >
                  <MenuItem icon={<Pencil className="size-3.5" />} onClick={() => setRenaming({ kind: "company", company })}>
                    Rename
                  </MenuItem>
                  <MenuItem icon={<Palette className="size-3.5" />} onClick={() => setBranding(company)}>
                    Brand settings
                  </MenuItem>
                  <MenuItem
                    icon={<FilePlus2 className="size-3.5" />}
                    onClick={() => void createBoard(company.id)}
                  >
                    New sheet
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    danger
                    icon={<Trash2 className="size-3.5" />}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete “${company.name}”?`,
                        message: `${company.boards.length} sheet${company.boards.length === 1 ? "" : "s"} and ${posts} post${posts === 1 ? "" : "s"} will be removed permanently.`,
                        confirmLabel: "Delete company",
                      });
                      if (ok) void deleteCompany(company.id);
                    }}
                  >
                    Delete company
                  </MenuItem>
                </Menu>
              </div>

              {open && (
                <div className="mt-0.5 ml-4 space-y-0.5 border-l border-[var(--line)] pl-2">
                  {company.boards.map((board) => {
                    const active = board.id === boardId && company.id === companyId;
                    const done = board.posts.filter(
                      (p) => p.published === "Published",
                    ).length;
                    return (
                      <div
                        key={board.id}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors",
                          active
                            ? "bg-brand-500/12"
                            : "hover:bg-[var(--surface-hover)]",
                        )}
                      >
                        <button
                          onClick={() => selectBoard(company, board)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-ring rounded"
                        >
                          <span className="shrink-0 text-xs">{board.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-xs",
                                active ? "font-semibold text-brand-300" : "font-medium",
                              )}
                            >
                              {board.name}
                            </span>
                            {board.posts.length > 0 && (
                              <MiniBar
                                value={done / board.posts.length}
                                color={company.colorHex}
                                className="mt-1 h-1 w-16"
                              />
                            )}
                          </span>
                        </button>
                        <span className="tabular text-dim text-[10px]">
                          {board.posts.length}
                        </span>
                        <Menu
                          align="end"
                          trigger={
                            <span className="text-dim hover:text-body grid size-5 place-items-center rounded opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                              <MoreHorizontal className="size-3" />
                            </span>
                          }
                        >
                          <MenuItem
                            icon={<Pencil className="size-3.5" />}
                            onClick={() => setRenaming({ kind: "board", board })}
                          >
                            Rename
                          </MenuItem>
                          <MenuItem
                            icon={<Copy className="size-3.5" />}
                            onClick={() =>
                              void createBoard(company.id, `${board.name} copy`, board.id)
                            }
                          >
                            Duplicate sheet
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            danger
                            icon={<Trash2 className="size-3.5" />}
                            onClick={async () => {
                              if (board.posts.length === 0) {
                                void deleteBoard(board.id);
                                return;
                              }
                              const ok = await confirm({
                                title: `Delete “${board.name}”?`,
                                message: `${board.posts.length} post${board.posts.length === 1 ? "" : "s"} will be removed permanently.`,
                                confirmLabel: "Delete sheet",
                              });
                              if (ok) void deleteBoard(board.id);
                            }}
                          >
                            Delete sheet
                          </MenuItem>
                        </Menu>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => void createBoard(company.id)}
                    className="text-dim hover:text-body flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] transition-colors hover:bg-[var(--surface-hover)] focus-ring"
                  >
                    <Plus className="size-3" />
                    New sheet
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <footer className="flex items-center gap-2 border-t border-[var(--line)] px-3 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start text-brand-400"
          onClick={() => void createCompany()}
        >
          <Plus className="size-3.5" />
          Company
        </Button>
        <Menu
          align="end"
          trigger={
            <span className="text-dim hover:text-body grid size-8 place-items-center rounded-lg">
              <MoreHorizontal className="size-4" />
            </span>
          }
        >
          <div className="text-dim px-2.5 py-1.5 text-[11px]">
            {store.user?.email}
          </div>
          <MenuSeparator />
          <MenuItem
            icon={<LogOut className="size-3.5" />}
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              // Full document load: the session cookie just changed, and a soft
              // navigation can replay a cached RSC payload from the signed-in
              // state. See LoginForm for the same reasoning.
              window.location.replace("/login");
            }}
          >
            Sign out
          </MenuItem>
        </Menu>
      </footer>

      {renaming && <RenameModal target={renaming} onClose={() => setRenaming(null)} />}
      {branding && (
        <BrandModal company={branding} onClose={() => setBranding(null)} />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="leading-tight">
      <span className="tabular text-body block text-[13px] font-bold">{value}</span>
      <span className="block text-[9px] font-semibold">{label}</span>
    </span>
  );
}

function RenameModal({
  target,
  onClose,
}: {
  target: { kind: "company"; company: Company } | { kind: "board"; board: Board };
  onClose: () => void;
}) {
  const { updateCompany, updateBoard } = useStore();
  const isCompany = target.kind === "company";
  const [name, setName] = useState(
    isCompany ? target.company.name : target.board.name,
  );
  const [emoji, setEmoji] = useState(isCompany ? "🗓️" : target.board.emoji);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return onClose();
    if (isCompany) void updateCompany(target.company.id, { name: trimmed });
    else void updateBoard(target.board.id, { name: trimmed, emoji });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={isCompany ? "Rename company" : "Rename sheet"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <Label>Name</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </label>
        {!isCompany && (
          <div className="grid gap-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  aria-label={`Icon ${e}`}
                  className={cn(
                    "grid size-9 place-items-center rounded-lg text-base transition-colors focus-ring",
                    emoji === e
                      ? "bg-brand-500/20 ring-1 ring-brand-500/50"
                      : "hover:bg-[var(--surface-hover)]",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function BrandModal({
  company,
  onClose,
}: {
  company: Company;
  onClose: () => void;
}) {
  const { updateCompany } = useStore();
  const [name, setName] = useState(company.name);
  const [handle, setHandle] = useState(company.handle);
  const [colorHex, setColorHex] = useState(company.colorHex);
  const [brandNotes, setBrandNotes] = useState(company.brandNotes);

  return (
    <Modal
      open
      onClose={onClose}
      title="Brand settings"
      description={company.name}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              void updateCompany(company.id, {
                name: name.trim() || company.name,
                handle,
                colorHex,
                brandNotes,
              });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <Label>Company name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <Label>Handle</Label>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@brand"
          />
        </label>
        <div className="grid gap-1.5">
          <Label>Accent colour</Label>
          <div className="flex flex-wrap gap-2">
            {COMPANY_PALETTE.map((hex) => (
              <button
                key={hex}
                onClick={() => setColorHex(hex)}
                aria-label={`Colour ${hex}`}
                className={cn(
                  "size-7 rounded-full transition focus-ring",
                  colorHex === hex && "ring-2 ring-white/70 ring-offset-2 ring-offset-[var(--surface-overlay)]",
                )}
                style={{ background: hex }}
              />
            ))}
          </div>
        </div>
        <label className="grid gap-1.5">
          <Label>Brand notes / tone of voice</Label>
          <Textarea
            rows={4}
            value={brandNotes}
            onChange={(e) => setBrandNotes(e.target.value)}
            placeholder="Voice, do's and don'ts, recurring hashtags…"
          />
        </label>
      </div>
    </Modal>
  );
}
