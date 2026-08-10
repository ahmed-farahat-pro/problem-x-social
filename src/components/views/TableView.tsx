"use client";

import { useCallback, useMemo, useRef, type MouseEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CopyPlus,
  Ellipsis,
  ExternalLink,
  Inbox,
  Plus,
  SearchX,
  SquarePen,
  Table2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  ApprovalPill,
  BiText,
  Button,
  Checkbox,
  DesignPill,
  EmptyState,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  PlatformStrip,
  PublishPill,
} from "@/components/ui";
import { CONTENT_TYPES, PLATFORMS, platformColor } from "@/lib/catalog";
import { useStore } from "@/lib/store";
import {
  APPROVAL_STATUSES,
  DESIGN_STATUSES,
  EMPTY_FILTERS,
  PUBLISH_STATUSES,
  filtersActive,
  type Post,
  type SortField,
} from "@/lib/types";
import {
  cn,
  dayLabel,
  dirOf,
  firstLine,
  formatShort,
  isOverdue,
  isWeekend,
} from "@/lib/utils";

// Sticky headers under `border-collapse: collapse` lose their border while
// scrolling, so the rule is painted as an inset shadow instead.
const HEAD_CELL =
  "surface-raised text-dim sticky top-0 z-10 px-3 py-2 text-left text-[10px] font-bold tracking-[0.08em] whitespace-nowrap uppercase shadow-[inset_0_-1px_0_var(--line)]";
const CELL = "px-3 py-1.5 align-middle";
const INLINE_FIELD =
  "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 focus-ring transition-colors hover:border-[var(--line)] focus:border-brand-500/60 focus:bg-[var(--surface-raised)]";

function postLabel(post: Post): string {
  return post.title.trim() || "untitled post";
}

/** Copies the full caption, not the preview line. */
function useCopyCaption() {
  const { notify } = useStore();
  return useCallback(
    async (post: Post) => {
      try {
        await navigator.clipboard.writeText(post.content);
        notify("Caption copied");
      } catch {
        notify("Clipboard is not available here", "error");
      }
    },
    [notify],
  );
}

function OverdueMark() {
  return (
    <span className="inline-flex shrink-0 items-center text-amber-400" title="Overdue">
      <TriangleAlert className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Overdue</span>
    </span>
  );
}

// ------------------------------------------------------------------- headers

function SortHead({
  field,
  label,
  className,
}: {
  field: SortField;
  label: string;
  className?: string;
}) {
  const { sortField, sortAsc, setSort } = useStore();
  const active = sortField === field;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
      className={cn(HEAD_CELL, className)}
    >
      <button
        type="button"
        onClick={() => setSort(field)}
        aria-label={`Sort by ${label}${active ? (sortAsc ? ", ascending" : ", descending") : ""}`}
        className={cn(
          "focus-ring hover:text-body inline-flex items-center gap-1 rounded transition-colors",
          active && "text-brand-300",
        )}
      >
        {label}
        {active &&
          (sortAsc ? (
            <ChevronUp className="size-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3" aria-hidden="true" />
          ))}
      </button>
    </th>
  );
}

function PlainHead({
  label,
  className,
  srOnly,
}: {
  label: string;
  className?: string;
  srOnly?: boolean;
}) {
  return (
    <th scope="col" className={cn(HEAD_CELL, className)}>
      <span className={cn(srOnly && "sr-only")}>{label}</span>
    </th>
  );
}

// -------------------------------------------------------------- inline edits

function TypeMenu({ post, options }: { post: Post; options: string[] }) {
  const { updatePost } = useStore();
  return (
    <Menu
      className="w-full"
      trigger={
        <MenuTrigger muted={!post.contentType}>
          <span className="sr-only">Content type: </span>
          {post.contentType || "Set type"}
        </MenuTrigger>
      }
    >
      <MenuLabel>Content type</MenuLabel>
      {options.map((type) => (
        <MenuItem
          key={type}
          selected={post.contentType === type}
          onClick={() => updatePost(post.id, { contentType: type }, true)}
        >
          {type}
        </MenuItem>
      ))}
    </Menu>
  );
}

function PlatformsMenu({ post }: { post: Post }) {
  const { updatePost } = useStore();
  // Keep platforms imported from a client sheet selectable so they can be removed.
  const options = [
    ...PLATFORMS,
    ...post.platforms.filter((p) => !PLATFORMS.includes(p)),
  ];

  const toggle = (platform: string) => {
    const next = post.platforms.includes(platform)
      ? post.platforms.filter((p) => p !== platform)
      : [...post.platforms, platform];
    updatePost(post.id, { platforms: next }, true);
  };

  return (
    <Menu
      className="max-w-full"
      trigger={
        <span className="focus-ring flex min-w-0 items-center gap-1 rounded-lg px-1 py-1 transition-colors hover:bg-[var(--surface-hover)]">
          <span className="sr-only">Platforms: </span>
          <PlatformStrip platforms={post.platforms} max={2} />
        </span>
      }
    >
      <MenuLabel>Platforms</MenuLabel>
      {options.map((platform) => (
        <MenuItem
          key={platform}
          keepOpen
          selected={post.platforms.includes(platform)}
          onClick={() => toggle(platform)}
          icon={
            <span
              className="size-2 rounded-full"
              style={{ background: platformColor(platform) }}
            />
          }
        >
          {platform}
        </MenuItem>
      ))}
    </Menu>
  );
}

function StatusMenu({
  label,
  current,
  children,
  options,
}: {
  label: string;
  current: string;
  children: ReactNode;
  options: { value: string; onSelect: () => void }[];
}) {
  return (
    <Menu
      className="max-w-full"
      trigger={
        <span className="focus-ring flex min-w-0 items-center rounded-full">
          <span className="sr-only">{label}: </span>
          {children}
        </span>
      }
    >
      <MenuLabel>{label}</MenuLabel>
      {options.map((option) => (
        <MenuItem
          key={option.value}
          selected={current === option.value}
          onClick={option.onSelect}
        >
          {option.value}
        </MenuItem>
      ))}
    </Menu>
  );
}

function DesignMenu({ post }: { post: Post }) {
  const { updatePost } = useStore();
  return (
    <StatusMenu
      label="Design"
      current={post.designStatus}
      options={DESIGN_STATUSES.map((value) => ({
        value,
        onSelect: () => updatePost(post.id, { designStatus: value }, true),
      }))}
    >
      <DesignPill value={post.designStatus} />
    </StatusMenu>
  );
}

function ApprovalMenu({ post }: { post: Post }) {
  const { updatePost } = useStore();
  return (
    <StatusMenu
      label="Approval"
      current={post.approval}
      options={APPROVAL_STATUSES.map((value) => ({
        value,
        onSelect: () => updatePost(post.id, { approval: value }, true),
      }))}
    >
      <ApprovalPill value={post.approval} />
    </StatusMenu>
  );
}

function PublishMenu({ post }: { post: Post }) {
  const { updatePost } = useStore();
  return (
    <StatusMenu
      label="Published"
      current={post.published}
      options={PUBLISH_STATUSES.map((value) => ({
        value,
        onSelect: () => updatePost(post.id, { published: value }, true),
      }))}
    >
      <PublishPill value={post.published} />
    </StatusMenu>
  );
}

function TitleField({ post }: { post: Post }) {
  const { updatePost } = useStore();
  const dir = dirOf(post.title);
  return (
    <input
      value={post.title}
      dir={dir}
      placeholder="Untitled"
      aria-label={`Title — ${formatShort(post.date)}`}
      onChange={(e) => updatePost(post.id, { title: e.target.value }, false)}
      className={cn(
        INLINE_FIELD,
        "text-sm font-medium placeholder:text-[var(--text-dim)]",
        dir === "rtl" && "rtl-text text-right",
      )}
    />
  );
}

function DateField({ post }: { post: Post }) {
  const { updatePost } = useStore();
  return (
    <input
      type="date"
      value={post.date ?? ""}
      aria-label={`Date for ${postLabel(post)}`}
      onChange={(e) => updatePost(post.id, { date: e.target.value || null }, true)}
      className={cn(INLINE_FIELD, "tabular w-[9.5rem] text-xs")}
    />
  );
}

function RowActions({ post }: { post: Post }) {
  const { setFocusedId, duplicatePosts, deletePosts } = useStore();
  const copyCaption = useCopyCaption();
  return (
    <Menu
      align="end"
      trigger={
        <span className="text-muted hover:text-body focus-ring grid size-7 place-items-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]">
          <span className="sr-only">Actions for {postLabel(post)}</span>
          <Ellipsis className="size-4" aria-hidden="true" />
        </span>
      }
    >
      <MenuItem
        icon={<SquarePen className="size-3.5" />}
        onClick={() => setFocusedId(post.id)}
      >
        Open editor
      </MenuItem>
      <MenuItem
        icon={<Copy className="size-3.5" />}
        disabled={!post.content}
        onClick={() => void copyCaption(post)}
      >
        Copy caption
      </MenuItem>
      <MenuItem
        icon={<CopyPlus className="size-3.5" />}
        onClick={() => void duplicatePosts([post.id])}
      >
        Duplicate
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        danger
        icon={<Trash2 className="size-3.5" />}
        onClick={() => void deletePosts([post.id])}
      >
        Delete
      </MenuItem>
    </Menu>
  );
}

function CopyCaptionButton({ post }: { post: Post }) {
  const copyCaption = useCopyCaption();
  if (!post.content) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 opacity-55 hover:opacity-100 focus-visible:opacity-100"
      aria-label={`Copy caption for ${postLabel(post)}`}
      onClick={() => void copyCaption(post)}
    >
      <Copy className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

// ------------------------------------------------------------------ desktop

interface RowProps {
  post: Post;
  index: number;
  typeOptions: string[];
  onCheck: (index: number, next: boolean, shift: boolean) => void;
}

function PostRow({ post, index, typeOptions, onCheck }: RowProps) {
  const { selected, focusedId, setFocusedId } = useStore();
  const shift = useRef(false);
  const focused = focusedId === post.id;
  const preview = firstLine(post.content);
  const overdue = isOverdue(post.date, post.published);

  // Clicks that land on a control edit in place; anything else opens the editor.
  const onRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input, label, select, textarea"))
      return;
    setFocusedId(post.id);
  };

  return (
    <tr
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.key !== "Enter") return;
        e.preventDefault();
        setFocusedId(post.id);
      }}
      className={cn(
        "focus-ring border-b border-[var(--line)] transition-colors",
        focused
          ? "bg-brand-500/10"
          : selected.has(post.id)
            ? "bg-brand-500/5"
            : "hover:bg-[var(--surface-hover)]",
      )}
    >
      <td
        className={cn(CELL, "w-10")}
        onClick={(e) => e.stopPropagation()}
        onMouseDownCapture={(e) => {
          shift.current = e.shiftKey;
        }}
        onKeyDownCapture={(e) => {
          shift.current = e.shiftKey;
        }}
      >
        <Checkbox
          checked={selected.has(post.id)}
          onChange={(next) => onCheck(index, next, shift.current)}
          label={<span className="sr-only">Select {postLabel(post)}</span>}
        />
      </td>

      <td className={cn(CELL, "w-[11rem]")}>
        <span className="flex items-center gap-1">
          {overdue && <OverdueMark />}
          <DateField post={post} />
        </span>
      </td>

      <td className={cn(CELL, "w-16")}>
        <span
          className={cn(
            "text-xs",
            isWeekend(post.date) ? "text-accent-400 font-medium" : "text-muted",
          )}
        >
          {dayLabel(post.date) || "—"}
        </span>
      </td>

      <td className={cn(CELL, "w-[9.5rem]")}>
        <TypeMenu post={post} options={typeOptions} />
      </td>

      <td className={cn(CELL, "min-w-[13rem]")}>
        <TitleField post={post} />
      </td>

      <td className={cn(CELL, "min-w-[16rem]")}>
        <span className="flex items-center gap-1">
          <span className="min-w-0 flex-1">
            {preview ? (
              <BiText text={preview} clamp={1} className="text-muted text-xs" />
            ) : (
              <span className="text-dim text-xs">No caption yet</span>
            )}
          </span>
          <CopyCaptionButton post={post} />
        </span>
      </td>

      <td className={cn(CELL, "w-[10rem]")}>
        <PlatformsMenu post={post} />
      </td>

      <td className={cn(CELL, "w-[10rem]")}>
        <DesignMenu post={post} />
      </td>

      <td className={cn(CELL, "w-[9rem]")}>
        <ApprovalMenu post={post} />
      </td>

      <td className={cn(CELL, "w-[8.5rem]")}>
        <PublishMenu post={post} />
      </td>

      <td className={cn(CELL, "min-w-[11rem]")}>
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1">
            {post.notes ? (
              <BiText
                text={firstLine(post.notes)}
                clamp={1}
                className="text-muted text-xs"
              />
            ) : (
              <span className="text-dim text-xs">—</span>
            )}
          </span>
          {post.driveLink && (
            <a
              href={post.driveLink}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open drive link for ${postLabel(post)}`}
              className="text-dim hover:text-brand-300 focus-ring grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </span>
      </td>

      <td className={cn(CELL, "w-11 pr-2 pl-0")}>
        <RowActions post={post} />
      </td>
    </tr>
  );
}

// ------------------------------------------------------------------- mobile

function PostCard({ post, index, onCheck }: Omit<RowProps, "typeOptions">) {
  const { selected, focusedId, setFocusedId } = useStore();
  const shift = useRef(false);
  const focused = focusedId === post.id;
  const overdue = isOverdue(post.date, post.published);

  return (
    <li
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, label")) return;
        setFocusedId(post.id);
      }}
      className={cn(
        "card p-3 transition-colors",
        focused && "border-brand-500/60 bg-brand-500/10",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="pt-0.5"
          onClick={(e) => e.stopPropagation()}
          onMouseDownCapture={(e) => {
            shift.current = e.shiftKey;
          }}
          onKeyDownCapture={(e) => {
            shift.current = e.shiftKey;
          }}
        >
          <Checkbox
            checked={selected.has(post.id)}
            onChange={(next) => onCheck(index, next, shift.current)}
            label={<span className="sr-only">Select {postLabel(post)}</span>}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="tabular text-muted">{formatShort(post.date)}</span>
            <span
              className={cn(
                isWeekend(post.date) ? "text-accent-400 font-medium" : "text-dim",
              )}
            >
              {dayLabel(post.date)}
            </span>
            {post.contentType && (
              <span className="text-dim truncate">· {post.contentType}</span>
            )}
            {overdue && <OverdueMark />}
          </div>

          <button
            type="button"
            onClick={() => setFocusedId(post.id)}
            className="focus-ring mt-1 block w-full rounded text-left"
          >
            <BiText
              text={post.title.trim() || "Untitled post"}
              clamp={2}
              className={cn(
                "text-sm font-semibold",
                !post.title.trim() && "text-dim font-normal",
              )}
            />
          </button>

          {post.content.trim() && (
            <BiText
              text={post.content}
              clamp={2}
              className="text-muted mt-1 text-xs leading-relaxed"
            />
          )}

          {post.platforms.length > 0 && (
            <div className="mt-2">
              <PlatformStrip platforms={post.platforms} max={4} />
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DesignPill value={post.designStatus} />
            <ApprovalPill value={post.approval} />
            <PublishPill value={post.published} />
          </div>
        </div>

        <RowActions post={post} />
      </div>
    </li>
  );
}

// -------------------------------------------------------------------- view

export default function TableView() {
  const {
    board,
    visiblePosts,
    selected,
    setSelected,
    toggleSelected,
    filters,
    setFilters,
    createPost,
  } = useStore();

  const typeOptions = useMemo(() => {
    const used = (board?.posts ?? []).map((p) => p.contentType).filter(Boolean);
    return [...new Set([...CONTENT_TYPES, ...used])];
  }, [board]);

  // Anchor for shift-click ranges.
  const anchor = useRef<number | null>(null);

  const onCheck = useCallback(
    (index: number, next: boolean, shift: boolean) => {
      const post = visiblePosts[index];
      if (!post) return;
      if (shift && anchor.current !== null) {
        const from = Math.min(anchor.current, index);
        const to = Math.max(anchor.current, index);
        const range = new Set(selected);
        for (const p of visiblePosts.slice(from, to + 1)) {
          if (next) range.add(p.id);
          else range.delete(p.id);
        }
        setSelected(range);
      } else {
        toggleSelected(post.id, true);
      }
      anchor.current = index;
    },
    [visiblePosts, selected, setSelected, toggleSelected],
  );

  const allSelected =
    visiblePosts.length > 0 && visiblePosts.every((p) => selected.has(p.id));
  const someSelected = visiblePosts.some((p) => selected.has(p.id));

  const toggleAll = (next: boolean) =>
    setSelected(next ? new Set(visiblePosts.map((p) => p.id)) : new Set());

  if (!board) {
    return (
      <EmptyState
        icon={<Table2 className="size-5" />}
        title="No sheet selected"
        message="Pick a sheet from the sidebar — or create one — to start planning content."
      />
    );
  }

  if (!visiblePosts.length) {
    return filtersActive(filters) ? (
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="No posts match your filters"
        message={`${board.posts.length} post${board.posts.length === 1 ? "" : "s"} on this sheet are hidden by the current filters.`}
        action={
          <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<Inbox className="size-5" />}
        title="No posts yet"
        message="This sheet is empty. Add the first post and start filling in the plan."
        action={
          <Button variant="primary" onClick={() => void createPost()}>
            <Plus className="size-4" aria-hidden="true" />
            New post
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Phone / tablet: stacked cards, never a horizontal scroller. */}
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto p-3 lg:hidden">
        {visiblePosts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} onCheck={onCheck} />
        ))}
      </ul>

      {/* Laptop and up: the real spreadsheet. */}
      <div className="hidden min-h-0 flex-1 overflow-auto lg:block">
        <table className="w-full min-w-[76rem] text-left">
          <caption className="sr-only">
            Content plan for {board.name} — {visiblePosts.length} posts
          </caption>
          <thead>
            <tr>
              <th scope="col" className={cn(HEAD_CELL, "w-10")}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  label={
                    <span className="sr-only">
                      {allSelected ? "Clear selection" : "Select all posts"}
                    </span>
                  }
                />
              </th>
              <SortHead field="date" label="Date" />
              <PlainHead label="Day" />
              <SortHead field="contentType" label="Type" />
              <SortHead field="title" label="Title / Topic" />
              <PlainHead label="Content" />
              <PlainHead label="Platforms" />
              <SortHead field="designStatus" label="Design" />
              <SortHead field="approval" label="Approval" />
              <SortHead field="published" label="Published" />
              <PlainHead label="Notes" />
              <PlainHead label="Row actions" srOnly />
            </tr>
          </thead>
          <tbody>
            {visiblePosts.map((post, index) => (
              <PostRow
                key={post.id}
                post={post}
                index={index}
                typeOptions={typeOptions}
                onCheck={onCheck}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
