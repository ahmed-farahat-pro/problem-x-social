"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { APPROVAL_TONE, PUBLISH_TONE } from "@/lib/catalog";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import {
  addDays,
  cn,
  dayLabel,
  firstLine,
  formatCompact,
  formatShort,
  isWeekend,
  parseISODate,
  toISODate,
  todayISO,
} from "@/lib/utils";
import { BiText, Button, PlatformStrip, Pill } from "@/components/ui";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Chips shown per day before the "+N more" affordance. */
const MAX_CHIPS = 3;

const dayDropId = (iso: string) => `day:${iso}`;

/**
 * SSR-safe media query. Renders as "no match" on the server and during
 * hydration, then corrects on mount so the markup never diverges.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

// ---------------------------------------------------------------------- chip

function chipDot(post: Post): string {
  return post.approval === "Needs Revision"
    ? APPROVAL_TONE["Needs Revision"].dot
    : PUBLISH_TONE[post.published].dot;
}

function chipLabel(post: Post): string {
  return post.title.trim() || firstLine(post.content) || "Untitled post";
}

function ChipBody({
  post,
  detailed,
  className,
}: {
  post: Post;
  detailed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 rounded-md px-1.5 py-1 text-left",
        "bg-[var(--surface-raised)] border border-[var(--line)]",
        className,
      )}
    >
      <span
        className="mt-1 size-1.5 shrink-0 rounded-full"
        style={{ background: chipDot(post) }}
      />
      <div className="min-w-0 flex-1">
        <BiText
          text={chipLabel(post)}
          clamp={detailed ? 2 : 1}
          className="text-[11px] leading-4 font-medium"
        />
        {detailed && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {post.contentType && (
              <span className="text-dim text-[10px]">{post.contentType}</span>
            )}
            <PlatformStrip platforms={post.platforms} max={2} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A pointer drag still emits a trailing `click`, which would otherwise open the
 * editor for the chip that was just moved. Arm on drag, disarm on the next press.
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

function CalendarChip({
  post,
  detailed,
  focused,
  onOpen,
}: {
  post: Post;
  detailed?: boolean;
  focused: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  const tap = useTapGuard(isDragging);

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
        "cursor-pointer touch-manipulation rounded-md focus-ring",
        focused && "ring-2 ring-brand-500/70",
        isDragging && "opacity-35",
      )}
    >
      <ChipBody
        post={post}
        detailed={detailed}
        className="transition-colors hover:border-[var(--line-strong)]"
      />
    </div>
  );
}

// ------------------------------------------------------------------ day cell

interface DayProps {
  iso: string;
  posts: Post[];
  isToday: boolean;
  focusedId: string | null;
  onOpen: (id: string) => void;
  onAdd: (iso: string) => void;
}

function DayCell({
  iso,
  posts,
  isToday,
  inMonth,
  expanded,
  onToggleExpand,
  focusedId,
  onOpen,
  onAdd,
}: DayProps & {
  inMonth: boolean;
  expanded: boolean;
  onToggleExpand: (iso: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(iso) });
  const shown = expanded ? posts : posts.slice(0, MAX_CHIPS);
  const hidden = posts.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-line flex flex-col gap-1 border-r border-b p-1 transition-colors",
        isWeekend(iso) && "bg-[var(--surface-hover)]/35",
        !inMonth && "opacity-45",
        isOver && "bg-brand-500/10 ring-1 ring-brand-500/50 ring-inset",
      )}
    >
      <div className="flex items-center gap-1">
        {isToday ? (
          <span className="tabular grid size-5 place-items-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
            {parseISODate(iso).getDate()}
          </span>
        ) : (
          <span className="tabular text-dim px-1 text-[11px] font-semibold">
            {parseISODate(iso).getDate()}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          aria-label={`Add a post on ${formatShort(iso)}`}
          onClick={() => onAdd(iso)}
          className="text-dim hover:text-body focus-ring grid size-5 shrink-0 place-items-center rounded-md transition-colors hover:bg-[var(--surface-hover)]"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {shown.map((post) => (
          <CalendarChip
            key={post.id}
            post={post}
            focused={focusedId === post.id}
            onOpen={onOpen}
          />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => onToggleExpand(iso)}
            className="text-dim hover:text-body focus-ring rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold"
          >
            +{hidden} more
          </button>
        )}
        {expanded && posts.length > MAX_CHIPS && (
          <button
            type="button"
            onClick={() => onToggleExpand(iso)}
            className="text-dim hover:text-body focus-ring rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

function AgendaDay({ iso, posts, isToday, focusedId, onOpen, onAdd }: DayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(iso) });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "border-line border-b px-3 py-2 transition-colors",
        isWeekend(iso) && "bg-[var(--surface-hover)]/35",
        isOver && "bg-brand-500/10 ring-1 ring-brand-500/50 ring-inset",
      )}
    >
      <div className="flex items-center gap-2">
        {isToday ? (
          <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
            {parseISODate(iso).getDate()}
          </span>
        ) : (
          <span className="tabular text-dim w-6 shrink-0 text-center text-xs font-semibold">
            {parseISODate(iso).getDate()}
          </span>
        )}
        <span className="text-xs font-semibold">{dayLabel(iso)}</span>
        <span className="text-dim text-[11px]">{formatCompact(iso)}</span>
        {posts.length > 0 && (
          <span className="tabular text-muted rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold">
            {posts.length}
          </span>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Add a post on ${formatShort(iso)}`}
          onClick={() => onAdd(iso)}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {posts.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1 pl-8">
          {posts.map((post) => (
            <CalendarChip
              key={post.id}
              post={post}
              detailed
              focused={focusedId === post.id}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------- view

export default function CalendarView() {
  const { visiblePosts, focusedId, setFocusedId, createPost, updatePost, notify } =
    useStore();

  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const now = parseISODate(today);
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const compact = useMediaQuery("(max-width: 639px)");

  const postsByDate = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of visiblePosts) {
      if (!post.date) continue;
      const bucket = map.get(post.date);
      if (bucket) bucket.push(post);
      else map.set(post.date, [post]);
    }
    return map;
  }, [visiblePosts]);

  const { monthDays, gridDays } = useMemo(() => {
    const { year, month } = cursor;
    const first = new Date(year, month, 1);
    const firstISO = toISODate(first);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = first.getDay(); // Sunday-first
    const gridStart = addDays(firstISO, -leading);
    const cells = Math.ceil((leading + daysInMonth) / 7) * 7;
    return {
      monthDays: Array.from({ length: daysInMonth }, (_, i) => addDays(firstISO, i)),
      gridDays: Array.from({ length: cells }, (_, i) => addDays(gridStart, i)),
    };
  }, [cursor]);

  const legend = useMemo(() => {
    const posts = monthDays.flatMap((iso) => postsByDate.get(iso) ?? []);
    return {
      total: posts.length,
      published: posts.filter((p) => p.published === "Published").length,
      revision: posts.filter((p) => p.approval === "Needs Revision").length,
    };
  }, [monthDays, postsByDate]);

  const draggingPost = useMemo(
    () => visiblePosts.find((p) => p.id === draggingId) ?? null,
    [visiblePosts, draggingId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const withinPointer = pointerWithin(args);
    return withinPointer.length > 0 ? withinPointer : rectIntersection(args);
  }, []);

  const shiftMonth = useCallback((delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
    setExpanded(new Set());
  }, []);

  const goToday = useCallback(() => {
    const now = parseISODate(todayISO());
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setExpanded(new Set());
  }, []);

  const toggleExpand = useCallback((iso: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }, []);

  const handleAdd = useCallback(
    async (iso: string) => {
      const id = await createPost({ date: iso });
      if (id) setFocusedId(id);
    },
    [createPost, setFocusedId],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);
      const overId = event.over ? String(event.over.id) : "";
      if (!overId.startsWith("day:")) return;
      const iso = overId.slice("day:".length);
      const postId = String(event.active.id);
      const post = visiblePosts.find((p) => p.id === postId);
      if (!post || post.date === iso) return;
      updatePost(postId, { date: iso }, true);
      notify(`Moved to ${formatShort(iso)}`);
    },
    [visiblePosts, updatePost, notify],
  );

  const dayProps = (iso: string) => ({
    iso,
    posts: postsByDate.get(iso) ?? [],
    isToday: iso === today,
    focusedId,
    onOpen: setFocusedId,
    onAdd: (value: string) => void handleAdd(value),
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-line flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="min-w-[8.5rem] text-center text-sm font-semibold">
              {MONTH_NAMES[cursor.month]} {cursor.year}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button size="sm" onClick={goToday}>
            <CalendarDays className="size-3.5" />
            Today
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Pill>{legend.total} total</Pill>
            <Pill tone={PUBLISH_TONE.Published} dot={PUBLISH_TONE.Published.dot}>
              {legend.published} published
            </Pill>
            <Pill
              tone={APPROVAL_TONE["Needs Revision"]}
              dot={APPROVAL_TONE["Needs Revision"].dot}
            >
              {legend.revision} needs revision
            </Pill>
          </div>
        </header>

        {compact ? (
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {monthDays.map((iso) => (
              <AgendaDay key={iso} {...dayProps(iso)} />
            ))}
          </ul>
        ) : (
          <>
            <div className="border-line text-dim grid shrink-0 grid-cols-7 border-b text-[10px] font-bold tracking-[0.08em] uppercase">
              {WEEKDAYS.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    "py-1.5 text-center",
                    (index === 0 || index === 6) && "text-brand-300/70",
                  )}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="border-line grid min-h-full auto-rows-[minmax(7rem,auto)] grid-cols-7 border-t border-l">
                {gridDays.map((iso) => (
                  <DayCell
                    key={iso}
                    {...dayProps(iso)}
                    inMonth={parseISODate(iso).getMonth() === cursor.month}
                    expanded={expanded.has(iso)}
                    onToggleExpand={toggleExpand}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingPost && (
          <ChipBody
            post={draggingPost}
            className="w-[190px] rotate-1 border-brand-500/60 shadow-2xl shadow-black/45"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
