"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarOff,
  CalendarPlus,
  CheckCheck,
  Copy,
  CopyPlus,
  Ellipsis,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  ApprovalPill,
  Button,
  DesignPill,
  EmptyState,
  Input,
  Label,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Modal,
  Pill,
  PublishPill,
  SectionLabel,
  Textarea,
} from "@/components/ui";
import { CAPTION_LIMITS, CONTENT_TYPES, PLATFORMS, platformColor } from "@/lib/catalog";
import { useStore } from "@/lib/store";
import {
  APPROVAL_STATUSES,
  DESIGN_STATUSES,
  PUBLISH_STATUSES,
  type Post,
} from "@/lib/types";
import {
  cn,
  dayLabel,
  dirOf,
  formatShort,
  isOverdue,
  isRTL,
  todayISO,
  wordCount,
} from "@/lib/utils";

// --------------------------------------------------------------------- hooks

/**
 * SSR-safe media query. `fallback` is what both the server and the hydration
 * pass see, so the first client render always matches the server markup and
 * the real value lands in the commit right after.
 */
function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

// --------------------------------------------------------------------- pieces

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <SectionLabel hint={hint}>{label}</SectionLabel>
      {children}
    </section>
  );
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const OVER_TONE = {
  fg: "text-rose-400",
  bg: "bg-rose-500/12",
  border: "border-rose-500/25",
};
const NEAR_TONE = {
  fg: "text-amber-400",
  bg: "bg-amber-500/12",
  border: "border-amber-500/25",
};
const RTL_TONE = {
  fg: "text-brand-300",
  bg: "bg-brand-500/12",
  border: "border-brand-500/30",
};

/** Only http(s) links are openable; anything else is treated as not-a-link. */
function openableUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function CaptionMeters({ post }: { post: Post }) {
  const chars = post.content.length;
  const hashtags = (post.content.match(/#/g) ?? []).length;

  // Platforms carrying a documented caption limit, in the order they were picked.
  const limited = post.platforms
    .map((name) => ({ name, limit: CAPTION_LIMITS[name] }))
    .filter((entry): entry is { name: string; limit: number } => entry.limit !== undefined);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill className="tabular">{chars} chars</Pill>
      <Pill className="tabular">{wordCount(post.content)} words</Pill>
      <Pill className="tabular">{hashtags} hashtags</Pill>
      {isRTL(post.content) && <Pill tone={RTL_TONE}>RTL</Pill>}
      {limited.map(({ name, limit }) => {
        const over = chars > limit;
        const tone = over ? OVER_TONE : chars > limit * 0.9 ? NEAR_TONE : undefined;
        return (
          <Pill key={name} tone={tone} className="tabular" dot={platformColor(name)}>
            {name} {chars}/{limit}
          </Pill>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------- editor

export default function PostEditor() {
  const {
    focusedPost,
    setFocusedId,
    updatePost,
    deletePosts,
    duplicatePosts,
    notify,
    permissions,
  } = useStore();
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  const locked = (field: Parameters<typeof permissions.canEditField>[0]) =>
    !permissions.canEditField(field);

  const [tagDraft, setTagDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragFrom = useRef<number | null>(null);
  const dragDistance = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const post = focusedPost;
  const postId = post?.id ?? null;
  const close = useCallback(() => setFocusedId(null), [setFocusedId]);

  // Reset per-post scratch state when the focus moves, without an extra pass.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes
  const [editedId, setEditedId] = useState(postId);
  if (editedId !== postId) {
    setEditedId(postId);
    setTagDraft("");
    setConfirmDelete(false);
    setDragY(0);
  }

  useEffect(() => {
    if (isDesktop || !postId || confirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDesktop, postId, confirmDelete, close]);

  // Lock the page behind the drawer. `confirmDelete` is a dependency because
  // Modal releases body scroll when it unmounts, so we re-apply the lock.
  useEffect(() => {
    if (isDesktop || !postId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isDesktop, postId, confirmDelete]);

  useEffect(() => {
    if (isDesktop || !postId) return;
    panelRef.current?.focus();
  }, [isDesktop, postId]);

  const copyCaption = useCallback(async () => {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(post.content);
      notify("Caption copied");
    } catch {
      notify("Clipboard is unavailable in this browser", "error");
    }
  }, [post, notify]);

  if (!post) {
    if (!isDesktop) return null;
    return (
      <aside className="surface-raised hidden h-full w-[400px] shrink-0 flex-col border-l border-line lg:flex">
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No post selected"
          message="Pick a post from the table, board or calendar and its caption, schedule and statuses land here."
        />
      </aside>
    );
  }

  const set = (patch: Parameters<typeof updatePost>[1], immediate = false) =>
    updatePost(post.id, patch, immediate);

  const togglePlatform = (name: string) =>
    set(
      {
        platforms: post.platforms.includes(name)
          ? post.platforms.filter((p) => p !== name)
          : [...post.platforms, name],
      },
      true,
    );

  const addTag = () => {
    const value = tagDraft.trim();
    if (!value) return;
    if (post.tags.includes(value)) {
      notify(`“${value}” is already tagged`, "error");
      return;
    }
    set({ tags: [...post.tags, value] }, true);
    setTagDraft("");
  };

  const markPublished = () => {
    set(
      {
        designStatus: "Uploaded to Drive",
        approval: "Approved",
        published: "Published",
      },
      true,
    );
    notify("Marked as fully published");
  };

  // Platforms outside the catalog can arrive via import — keep them visible.
  const platformOptions = [
    ...PLATFORMS,
    ...post.platforms.filter((p) => !PLATFORMS.includes(p)),
  ];
  const driveUrl = openableUrl(post.driveLink);
  const overdue = isOverdue(post.date, post.published);
  const fullyPublished =
    post.designStatus === "Uploaded to Drive" &&
    post.approval === "Approved" &&
    post.published === "Published";

  // ------------------------------------------------------------------ drag

  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragFrom.current = e.clientY;
    dragDistance.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragFrom.current === null) return;
    const delta = Math.max(0, e.clientY - dragFrom.current);
    dragDistance.current = delta;
    setDragY(delta);
  };
  const onHandleUp = () => {
    if (dragFrom.current === null) return;
    dragFrom.current = null;
    setDragY(0);
    if (dragDistance.current > 110) close();
  };

  // ---------------------------------------------------------------- header

  const header = (
    <header className="flex items-center gap-1 border-b border-line px-3 py-2.5 sm:px-4">
      <h2 id={headingId} className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
        Post editor
      </h2>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Duplicate post"
        disabled={!permissions.canCreatePost}
        onClick={() => void duplicatePosts([post.id])}
      >
        <CopyPlus className="size-4" />
      </Button>
      <Menu
        align="end"
        trigger={
          <span className="text-muted grid size-8 place-items-center rounded-lg transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
            <Ellipsis className="size-4" />
            <span className="sr-only">More post actions</span>
          </span>
        }
      >
        <MenuItem icon={<Copy className="size-3.5" />} onClick={() => void copyCaption()}>
          Copy caption
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          danger
          icon={<Trash2 className="size-3.5" />}
          disabled={!permissions.canDeletePost}
          onClick={() => setConfirmDelete(true)}
        >
          Delete post
        </MenuItem>
      </Menu>
      {!isDesktop && (
        <Button variant="ghost" size="icon" aria-label="Close editor" onClick={close}>
          <X className="size-4" />
        </Button>
      )}
    </header>
  );

  // ------------------------------------------------------------------ body

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-8 sm:px-4">
      <div className="space-y-5">
        <Textarea
          autoGrow
          rows={1}
          value={post.title}
          readOnly={locked("title")}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => {
            // Titles stay one logical line; the box still wraps visually.
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Untitled post"
          aria-label="Post title"
          className="resize-none rounded-none border-0 bg-transparent p-0 text-lg leading-snug font-semibold focus:border-0 read-only:cursor-not-allowed"
        />

        <Field label="Date" hint={post.date ? dayLabel(post.date) : "Unscheduled"}>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={post.date ?? ""}
              disabled={locked("date")}
              onChange={(e) => set({ date: e.target.value || null }, true)}
              aria-label="Planned date"
              className="tabular min-w-0 flex-1"
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-9 shrink-0"
              disabled={locked("date")}
              onClick={() => set({ date: post.date ? null : todayISO() }, true)}
              aria-label={post.date ? "Clear the planned date" : "Schedule for today"}
            >
              {post.date ? (
                <>
                  <CalendarOff className="size-3.5" /> Clear
                </>
              ) : (
                <>
                  <CalendarPlus className="size-3.5" /> No date
                </>
              )}
            </Button>
          </div>
          {overdue && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
              <TriangleAlert className="size-3.5 shrink-0" />
              {formatShort(post.date)} has passed and this is not published yet.
            </p>
          )}
        </Field>

        <Field label="Content type">
          {locked("contentType") ? (
            <MenuTrigger className="h-9 opacity-60" muted={!post.contentType}>
              {post.contentType || "Pick a type"}
            </MenuTrigger>
          ) : (
            <Menu
              className="w-full"
              trigger={
                <MenuTrigger className="h-9" muted={!post.contentType}>
                  {post.contentType || "Pick a type"}
                </MenuTrigger>
              }
            >
              {CONTENT_TYPES.map((type) => (
                <MenuItem
                  key={type}
                  selected={type === post.contentType}
                  onClick={() => set({ contentType: type }, true)}
                >
                  {type}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem disabled={!post.contentType} onClick={() => set({ contentType: "" }, true)}>
                Clear
              </MenuItem>
            </Menu>
          )}
        </Field>

        <Field
          label="Platforms"
          hint={post.platforms.length ? `${post.platforms.length} selected` : "None"}
        >
          <div className="flex flex-wrap gap-1.5">
            {platformOptions.map((name) => {
              const active = post.platforms.includes(name);
              const color = platformColor(name);
              return (
                <button
                  key={name}
                  type="button"
                  disabled={locked("platforms")}
                  aria-pressed={active}
                  onClick={() => togglePlatform(name)}
                  style={
                    active
                      ? { background: color, borderColor: color }
                      : { color, borderColor: `${color}59` }
                  }
                  className={cn(
                    "focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                    "text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    active ? "text-white" : "hover:bg-[var(--surface-hover)]",
                  )}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: active ? "#fff" : color }}
                  />
                  {name}
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          label="Caption"
          hint={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copyCaption()}
              disabled={!post.content.trim()}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
          }
        >
          <Textarea
            value={post.content}
            readOnly={locked("content")}
            onChange={(e) => set({ content: e.target.value })}
            placeholder="اكتب الكابشن هنا… / Write the caption here…"
            aria-label="Caption"
            className="min-h-[200px] read-only:cursor-not-allowed"
          />
          <CaptionMeters post={post} />
        </Field>

        <Field label="Status">
          <div className="card space-y-2.5 p-3">
            <StatusRow label="Design">
              {locked("designStatus") ? (
                <DesignPill value={post.designStatus} />
              ) : (
                <Menu align="end" trigger={<DesignPill value={post.designStatus} />}>
                  {DESIGN_STATUSES.map((status) => (
                    <MenuItem
                      key={status}
                      selected={status === post.designStatus}
                      onClick={() => set({ designStatus: status }, true)}
                    >
                      {status}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </StatusRow>
            <StatusRow label="Approval">
              {locked("approval") ? (
                <ApprovalPill value={post.approval} />
              ) : (
                <Menu align="end" trigger={<ApprovalPill value={post.approval} />}>
                  {APPROVAL_STATUSES.map((status) => (
                    <MenuItem
                      key={status}
                      selected={status === post.approval}
                      onClick={() => set({ approval: status }, true)}
                    >
                      {status}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </StatusRow>
            <StatusRow label="Published">
              {locked("published") ? (
                <PublishPill value={post.published} />
              ) : (
                <Menu align="end" trigger={<PublishPill value={post.published} />}>
                  {PUBLISH_STATUSES.map((status) => (
                    <MenuItem
                      key={status}
                      selected={status === post.published}
                      onClick={() => set({ published: status }, true)}
                    >
                      {status}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </StatusRow>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={markPublished}
              disabled={
                fullyPublished ||
                locked("designStatus") ||
                locked("approval") ||
                locked("published")
              }
            >
              <CheckCheck className="size-3.5" />
              {fullyPublished ? "Fully published" : "Mark fully published"}
            </Button>
          </div>
        </Field>

        <Field label="Drive link">
          <div className="flex items-center gap-2">
            <Input
              type="url"
              inputMode="url"
              dir="ltr"
              value={post.driveLink}
              readOnly={locked("driveLink")}
              onChange={(e) => set({ driveLink: e.target.value })}
              placeholder="https://drive.google.com/…"
              aria-label="Drive link"
              className="min-w-0 flex-1 read-only:cursor-not-allowed"
            />
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Open drive link in a new tab"
              disabled={!driveUrl}
              onClick={() => {
                if (driveUrl) window.open(driveUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="size-4" />
            </Button>
          </div>
          {post.driveLink.trim() !== "" && !driveUrl && (
            <p className="text-[11px] text-amber-400">
              Add the full address, starting with https://, to open it.
            </p>
          )}
        </Field>

        <Field label="Tags" hint={post.tags.length ? `${post.tags.length}` : undefined}>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  dir={dirOf(tag)}
                  className="text-muted inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-hover)] py-0.5 ps-2.5 pe-1 text-[11px] font-medium"
                >
                  <span className="truncate">{tag}</span>
                  <button
                    type="button"
                    disabled={locked("tags")}
                    onClick={() => set({ tags: post.tags.filter((t) => t !== tag) }, true)}
                    aria-label={`Remove tag ${tag}`}
                    className="focus-ring text-dim grid size-4 shrink-0 place-items-center rounded-full transition-colors hover:bg-rose-500/15 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={tagDraft}
              dir={dirOf(tagDraft)}
              disabled={locked("tags")}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag"
              aria-label="New tag"
              className="min-w-0 flex-1"
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-9 shrink-0"
              onClick={addTag}
              disabled={!tagDraft.trim() || locked("tags")}
            >
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        </Field>

        <Field label="Owner">
          <Input
            value={post.owner}
            dir={dirOf(post.owner)}
            readOnly={locked("owner")}
            onChange={(e) => set({ owner: e.target.value })}
            placeholder="Who is on it?"
            aria-label="Owner"
            className="read-only:cursor-not-allowed"
          />
        </Field>

        <Field label="Revision notes">
          <Textarea
            value={post.notes}
            readOnly={locked("notes")}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="ملاحظات المراجعة… / Client feedback…"
            aria-label="Revision notes"
            className="min-h-[80px] read-only:cursor-not-allowed"
          />
        </Field>

        <Field label="Ideas out of the box">
          <Textarea
            value={post.ideas}
            readOnly={locked("ideas")}
            onChange={(e) => set({ ideas: e.target.value })}
            placeholder="Wild ideas, hooks, references…"
            aria-label="Ideas out of the box"
            className="min-h-[60px] read-only:cursor-not-allowed"
          />
        </Field>

        <footer className="text-dim flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px]">
          <span>Created {formatShort(post.createdAt.slice(0, 10))}</span>
          <span>Edited {formatShort(post.updatedAt.slice(0, 10))}</span>
        </footer>
      </div>
    </div>
  );

  const deleteModal = (
    <Modal
      open={confirmDelete}
      onClose={() => setConfirmDelete(false)}
      title="Delete this post?"
      description="It disappears from every view. This cannot be undone."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmDelete(false);
              void deletePosts([post.id]);
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </>
      }
    >
      <p className="text-muted text-sm">
        {post.title.trim() ? `“${post.title.trim()}”` : "This untitled post"} will be
        removed from the sheet.
      </p>
    </Modal>
  );

  // ----------------------------------------------------------------- shells

  if (isDesktop) {
    return (
      <>
        <aside
          aria-labelledby={headingId}
          className="surface-raised hidden h-full max-h-dvh w-[400px] shrink-0 flex-col border-l border-line lg:flex"
        >
          {header}
          {body}
        </aside>
        {deleteModal}
      </>
    );
  }

  if (typeof document === "undefined") return null;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            tabIndex={-1}
            style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
            className={cn(
              "surface-raised animate-fade-up relative flex max-h-[94dvh] min-h-[70dvh] flex-col",
              "overflow-hidden rounded-t-2xl border border-[var(--line-strong)] shadow-2xl outline-none",
              dragY === 0 && "transition-transform duration-200",
            )}
          >
            <button
              type="button"
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              onClick={() => {
                if (dragDistance.current <= 6) close();
              }}
              aria-label="Close editor"
              className="focus-ring grid w-full shrink-0 touch-none place-items-center pt-2.5 pb-1.5"
            >
              <span className="h-1 w-10 rounded-full bg-[var(--line-strong)]" />
            </button>
            {header}
            {body}
          </div>
        </div>,
        document.body,
      )}
      {deleteModal}
    </>
  );
}
