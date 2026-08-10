"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Copy,
  Ellipsis,
  LayoutGrid,
  Link2,
  Plus,
  SquarePen,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  APPROVAL_TONE,
  COMPANY_PALETTE,
  DESIGN_TONE,
  PUBLISH_TONE,
} from "@/lib/catalog";
import { useStore } from "@/lib/store";
import {
  APPROVAL_STATUSES,
  DESIGN_STATUSES,
  PUBLISH_STATUSES,
  type GroupKey,
  type Post,
  type PostInput,
} from "@/lib/types";
import {
  cn,
  dayLabel,
  firstLine,
  formatCompact,
  isOverdue,
  todayISO,
} from "@/lib/utils";
import {
  BiText,
  Button,
  EmptyState,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  PlatformStrip,
} from "@/components/ui";

// ------------------------------------------------------------------- columns

interface BoardColumn {
  /** Stable key + droppable id suffix. */
  id: string;
  label: string;
  dot: string;
  /** Patch applied when a card lands here (or a card is created here). */
  patch: PostInput;
  holds: (post: Post) => boolean;
}

const NO_TYPE = "__no_type__";

function paletteColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COMPANY_PALETTE[hash % COMPANY_PALETTE.length];
}

function buildColumns(groupKey: GroupKey, posts: Post[]): BoardColumn[] {
  switch (groupKey) {
    case "designStatus":
      return DESIGN_STATUSES.map((value) => ({
        id: value,
        label: value,
        dot: DESIGN_TONE[value].dot,
        patch: { designStatus: value },
        holds: (post) => post.designStatus === value,
      }));
    case "approval":
      return APPROVAL_STATUSES.map((value) => ({
        id: value,
        label: value,
        dot: APPROVAL_TONE[value].dot,
        patch: { approval: value },
        holds: (post) => post.approval === value,
      }));
    case "published":
      return PUBLISH_STATUSES.map((value) => ({
        id: value,
        label: value,
        dot: PUBLISH_TONE[value].dot,
        patch: { published: value },
        holds: (post) => post.published === value,
      }));
    case "contentType": {
      const present = [...new Set(posts.map((p) => p.contentType).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      );
      const columns: BoardColumn[] = present.map((value) => ({
        id: value,
        label: value,
        dot: paletteColor(value),
        patch: { contentType: value },
        holds: (post) => post.contentType === value,
      }));
      if (posts.some((p) => !p.contentType)) {
        columns.push({
          id: NO_TYPE,
          label: "No type",
          dot: "#8A94A6",
          patch: { contentType: "" },
          holds: (post) => !post.contentType,
        });
      }
      return columns;
    }
  }
}

const dropId = (column: BoardColumn) => `col:${column.id}`;

// ---------------------------------------------------------------------- card

function splitContent(post: Post): { heading: string; preview: string } {
  const title = post.title.trim();
  const content = post.content.trim();
  if (title) return { heading: title, preview: content };
  const first = firstLine(content);
  if (!first) return { heading: "", preview: "" };
  return {
    heading: first,
    preview: content.slice(content.indexOf(first) + first.length).trim(),
  };
}

function CardBody({
  post,
  menu,
  className,
}: {
  post: Post;
  menu?: ReactNode;
  className?: string;
}) {
  const { heading, preview } = splitContent(post);
  const overdue = isOverdue(post.date, post.published);
  const dueToday = post.date === todayISO() && post.published !== "Published";

  return (
    <div className={cn("card p-2.5 shadow-sm shadow-black/10", className)}>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4">
            <span
              className={cn(
                "tabular font-semibold",
                overdue ? "text-rose-400" : dueToday ? "text-amber-400" : "text-muted",
              )}
            >
              {formatCompact(post.date)}
            </span>
            {post.date && <span className="text-dim">{dayLabel(post.date)}</span>}
            {post.contentType && (
              <>
                <span className="text-dim">·</span>
                <span className="text-dim truncate">{post.contentType}</span>
              </>
            )}
          </div>
          <BiText
            text={heading || "Untitled post"}
            clamp={2}
            className={cn(
              "mt-1 text-[13px] leading-snug font-medium",
              !heading && "text-dim italic",
            )}
          />
        </div>
        {menu}
      </div>

      {preview && (
        <BiText
          text={preview}
          clamp={2}
          className="text-muted mt-1.5 text-[11.5px] leading-relaxed"
        />
      )}

      <div className="mt-2 flex items-center gap-2">
        <PlatformStrip platforms={post.platforms} max={3} />
        <span className="flex-1" />
        {post.notes.trim() && (
          <StickyNote
            className="text-dim size-3.5 shrink-0"
            role="img"
            aria-label="Has notes"
          />
        )}
        {post.driveLink.trim() && (
          <Link2
            className="text-dim size-3.5 shrink-0"
            role="img"
            aria-label="Has a drive link"
          />
        )}
      </div>
    </div>
  );
}

const stopEvent = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * A pointer drag still emits a trailing `click`, which would otherwise open the
 * editor for the card that was just moved. Arm on drag, disarm on the next press.
 */
function useTapGuard(isDragging: boolean) {
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

  return {
    disarm: () => {
      dragged.current = false;
    },
    consumed: () => {
      if (!dragged.current) return false;
      dragged.current = false;
      return true;
    },
  };
}

function BoardCard({
  post,
  columns,
  focused,
  onOpen,
}: {
  post: Post;
  columns: BoardColumn[];
  focused: boolean;
  onOpen: (id: string) => void;
}) {
  const { bulkUpdate, duplicatePosts, deletePosts } = useStore();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  const tap = useTapGuard(isDragging);

  const menu = (
    // Swallow pointer/touch so the menu never arms a drag or focuses the card.
    <div
      onPointerDown={stopEvent}
      onTouchStart={stopEvent}
      onClick={stopEvent}
      onKeyDown={stopEvent}
    >
      <Menu
        align="end"
        trigger={
          <span className="text-dim hover:text-body grid size-6 place-items-center rounded-md transition-colors hover:bg-[var(--surface-hover)]">
            <Ellipsis className="size-4" role="img" aria-label={`Actions for ${post.title || "post"}`} />
          </span>
        }
      >
        <MenuItem icon={<SquarePen className="size-3.5" />} onClick={() => onOpen(post.id)}>
          Open editor
        </MenuItem>
        <MenuItem
          icon={<Copy className="size-3.5" />}
          onClick={() => void duplicatePosts([post.id])}
        >
          Duplicate
        </MenuItem>
        <MenuSeparator />
        {/* Keyboard-reachable equivalent of dragging the card across columns. */}
        <MenuLabel>Move to</MenuLabel>
        {columns.map((column) => (
          <MenuItem
            key={column.id}
            selected={column.holds(post)}
            disabled={column.holds(post)}
            onClick={() => void bulkUpdate([post.id], column.patch)}
          >
            {column.label}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          danger
          icon={<Trash2 className="size-3.5" />}
          onClick={() => void deletePosts([post.id])}
        >
          Delete
        </MenuItem>
      </Menu>
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onPointerDownCapture={tap.disarm}
      onTouchStartCapture={tap.disarm}
      onClick={() => {
        if (!tap.consumed()) onOpen(post.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(post.id);
        }
      }}
      className={cn(
        "cursor-pointer touch-manipulation rounded-xl2 transition-shadow focus-ring",
        focused && "ring-2 ring-brand-500/70",
        isDragging && "opacity-35",
      )}
    >
      <CardBody post={post} menu={menu} />
    </div>
  );
}

// -------------------------------------------------------------------- column

function Column({
  column,
  posts,
  focusedId,
  onOpen,
  onAdd,
  columns,
  activeOver,
}: {
  column: BoardColumn;
  posts: Post[];
  focusedId: string | null;
  onOpen: (id: string) => void;
  onAdd: (column: BoardColumn) => void;
  columns: BoardColumn[];
  activeOver: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(column) });
  const highlight = isOver || activeOver;

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label}, ${posts.length} posts`}
      className={cn(
        "flex h-full w-[260px] max-w-[85vw] shrink-0 snap-start flex-col",
        "rounded-xl2 border transition-colors",
        highlight
          ? "border-brand-500/70 bg-brand-500/[0.07]"
          : "border-line bg-[var(--surface-raised)]/60",
      )}
    >
      <header className="border-line flex shrink-0 items-center gap-2 border-b px-2.5 py-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: column.dot }}
        />
        <h3 className="truncate text-xs font-semibold">{column.label}</h3>
        <span className="tabular text-muted shrink-0 rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold">
          {posts.length}
        </span>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Add a post to ${column.label}`}
          onClick={() => onAdd(column)}
        >
          <Plus className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
        {posts.map((post) => (
          <BoardCard
            key={post.id}
            post={post}
            columns={columns}
            focused={focusedId === post.id}
            onOpen={onOpen}
          />
        ))}
        {posts.length === 0 && (
          <div
            className={cn(
              "border-line text-dim grid h-24 place-items-center rounded-xl2 border border-dashed text-[11px]",
              highlight && "border-brand-500/60 text-brand-300",
            )}
          >
            Drop posts here
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------- view

export default function BoardView() {
  const {
    groupKey,
    visiblePosts,
    focusedId,
    setFocusedId,
    createPost,
    bulkUpdate,
  } = useStore();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const columns = useMemo(
    () => buildColumns(groupKey, visiblePosts),
    [groupKey, visiblePosts],
  );

  const columnByDropId = useMemo(
    () => new Map(columns.map((column) => [dropId(column), column])),
    [columns],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>(columns.map((column) => [column.id, []]));
    for (const post of visiblePosts) {
      const column = columns.find((c) => c.holds(post));
      if (column) map.get(column.id)?.push(post);
    }
    return map;
  }, [columns, visiblePosts]);

  const draggingPost = useMemo(
    () => visiblePosts.find((p) => p.id === draggingId) ?? null,
    [visiblePosts, draggingId],
  );

  // A press-and-hold arms the drag; a quick tap still opens the card, and a
  // swipe within the tolerance scrolls the board instead of dragging.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const withinPointer = pointerWithin(args);
    return withinPointer.length > 0 ? withinPointer : rectIntersection(args);
  }, []);

  const handleAdd = useCallback(
    (column: BoardColumn) => void createPost(column.patch),
    [createPost],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const reset = useCallback(() => {
    setDraggingId(null);
    setOverId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      reset();
      if (!event.over) return;
      const target = columnByDropId.get(String(event.over.id));
      const postId = String(event.active.id);
      const post = visiblePosts.find((p) => p.id === postId);
      if (!target || !post || target.holds(post)) return;
      void bulkUpdate([postId], target.patch);
    },
    [reset, columnByDropId, visiblePosts, bulkUpdate],
  );

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid className="size-5" />}
        title="Nothing to group yet"
        message="No posts match the current filters, so there are no content-type columns to show. Clear a filter or add a post to get started."
        action={
          <Button variant="primary" size="sm" onClick={() => void createPost()}>
            <Plus className="size-4" />
            New post
          </Button>
        }
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-3 pb-3 sm:snap-none">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            columns={columns}
            posts={grouped.get(column.id) ?? []}
            focusedId={focusedId}
            onOpen={setFocusedId}
            onAdd={handleAdd}
            activeOver={overId === dropId(column)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingPost && (
          <CardBody
            post={draggingPost}
            className="w-[240px] rotate-1 border-brand-500/60 shadow-2xl shadow-black/45"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
