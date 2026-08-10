"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import {
  CalendarClock,
  ChevronRight,
  CircleCheckBig,
  LayoutGrid,
  PartyPopper,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { APPROVAL_TONE, platformColor } from "@/lib/catalog";
import { useStore } from "@/lib/store";
import { filtersActive, type Post } from "@/lib/types";
import {
  cn,
  dayLabel,
  firstLine,
  formatCompact,
  formatShort,
  isOverdue,
} from "@/lib/utils";
import {
  ApprovalPill,
  BiText,
  EmptyState,
  Label,
  MiniBar,
  Pill,
  SectionLabel,
} from "@/components/ui";

// ------------------------------------------------------------------- palette

/**
 * Every chart on this view plots exactly one series, so identity never rests on
 * colour and no legend box is needed — the card title names what is plotted.
 * This is categorical slot 1 (brand-500), reused rather than cycled.
 */
const SERIES_HUE = "#7c5cff";

/**
 * The pipeline is ordinal — swapping the stages would change the meaning — so it
 * takes a one-hue ramp with monotone lightness (deep → bright as a post advances)
 * instead of four categorical hues. Validated on both surfaces: monotone L,
 * adjacent ΔL ≥ 0.06, hue spread 8°, dim end 2.46:1 on dark / 2.57:1 on light.
 */
const PIPELINE_RAMP = ["#5734c9", "#6a45f0", "#8f6dff", "#ab90ff"];

// --------------------------------------------------------------- chart theme

interface ChartTheme {
  tick: string;
  grid: string;
  cursor: string;
  surface: string;
}

const FALLBACK_THEME: ChartTheme = {
  tick: "#6b7387",
  grid: "#2f3444",
  cursor: "#191c26",
  surface: "#0f1117",
};

/**
 * Recharts emits colours as SVG presentation attributes, where `var(--token)` is
 * not reliably resolved, so the tokens are read off `:root` instead and refreshed
 * whenever the theme attribute flips. Staying `null` until the effect runs also
 * keeps the server render and the first client render identical, which is what
 * ResponsiveContainer (a measuring component) needs.
 */
function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const styles = getComputedStyle(root);
      const token = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;
      setTheme({
        tick: token("--text-dim", FALLBACK_THEME.tick),
        grid: token("--line-strong", FALLBACK_THEME.grid),
        cursor: token("--surface-hover", FALLBACK_THEME.cursor),
        surface: token("--surface-raised", FALLBACK_THEME.surface),
      });
    };

    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

// ------------------------------------------------------------------- tooltip

type SeriesTooltipProps = TooltipContentProps & {
  /** Turns the raw axis label into the tooltip heading. */
  formatLabel?: (raw: string) => string;
  /** Resolves the line-key colour from the raw axis label. */
  swatch?: (raw: string) => string;
};

function tooltipValue(value: TooltipValueType | undefined): string {
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  return "—";
}

function SeriesTooltip({
  active,
  payload,
  label,
  formatLabel,
  swatch,
}: SeriesTooltipProps) {
  const entry = payload?.[0];
  if (!active || !entry) return null;

  const raw = label === undefined || label === null ? "" : String(label);
  const heading = formatLabel ? formatLabel(raw) : raw;
  const keyColor = swatch ? swatch(raw) : (entry.color ?? SERIES_HUE);

  return (
    <div className="pointer-events-none rounded-xl border border-[var(--line-strong)] bg-[var(--surface-overlay)] px-3 py-2 shadow-xl shadow-black/35">
      <p className="text-dim text-[10px] font-bold tracking-[0.08em] uppercase">
        {heading}
      </p>
      {/* Value leads, label follows — the reader already knows the series. */}
      <p className="mt-1 flex items-center gap-2">
        <span
          className="h-0.5 w-3 shrink-0 rounded-full"
          style={{ background: keyColor }}
        />
        <span className="text-body tabular text-sm font-semibold">
          {tooltipValue(entry.value)}
        </span>
        <span className="text-muted text-xs">
          {entry.value === 1 ? "post" : "posts"}
        </span>
      </p>
    </div>
  );
}

// -------------------------------------------------------------------- pieces

function Card({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card flex min-w-0 flex-col gap-3 p-4 sm:p-5", className)}>
      <SectionLabel hint={hint}>{title}</SectionLabel>
      {children}
    </section>
  );
}

function ChartFrame({
  height,
  ready,
  children,
}: {
  height: number;
  ready: boolean;
  children: ReactElement;
}) {
  return (
    <div className="w-full" style={{ height }}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : (
        <div
          aria-hidden
          className="h-full w-full rounded-lg bg-[var(--surface-hover)]/40"
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  foot,
  warn = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  foot?: ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "card flex flex-col gap-2 p-3.5 sm:p-4",
        warn && "border-rose-500/35 bg-rose-500/[0.06]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md",
            warn ? "bg-rose-500/15 text-rose-400" : "bg-brand-500/12 text-brand-400",
          )}
        >
          {icon}
        </span>
        <Label>{label}</Label>
      </div>
      {/* Proportional figures: tabular-nums reads loose at display sizes. */}
      <span
        className={cn(
          "text-2xl leading-none font-semibold sm:text-3xl",
          warn && "text-rose-400",
        )}
      >
        {value.toLocaleString()}
      </span>
      {foot && <div className="text-dim text-[11px]">{foot}</div>}
    </div>
  );
}

function PostRow({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const late = isOverdue(post.date, post.published);
  const title = post.title.trim() || firstLine(post.content) || "Untitled";

  return (
    <button
      type="button"
      onClick={onOpen}
      title={formatShort(post.date)}
      className="focus-ring flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
    >
      <span className="tabular w-[52px] shrink-0 leading-tight">
        <span
          className={cn(
            "block text-[11px] font-semibold",
            late ? "text-rose-400" : "text-body",
          )}
        >
          {formatCompact(post.date)}
        </span>
        <span className="text-dim block text-[10px]">
          {dayLabel(post.date) || "—"}
        </span>
      </span>
      <BiText text={title} clamp={1} className="min-w-0 flex-1 text-sm" />
      <span className="shrink-0">
        <ApprovalPill value={post.approval} />
      </span>
    </button>
  );
}

// ----------------------------------------------------------------- dashboard

export default function DashboardView() {
  const { stats, visiblePosts, board, filters, setFocusedId } = useStore();
  const theme = useChartTheme();
  const ready = theme !== null;
  const chrome = theme ?? FALLBACK_THEME;

  const total = stats.total;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const share = (n: number) => (total ? n / total : 0);

  const typeData = useMemo(() => stats.byType.slice(0, 7), [stats.byType]);
  const platformData = stats.byPlatform;
  const weekData = stats.byWeek;

  const pipeline = [
    { key: "design", label: "Design ready", value: stats.designDone },
    { key: "approved", label: "Approved", value: stats.approved },
    {
      key: "queued",
      label: "Scheduled + published",
      value: stats.scheduled + stats.published,
    },
    { key: "published", label: "Published", value: stats.published },
  ];

  const upcoming = stats.upcoming.slice(0, 6);

  // Overdue first, then anything sent back for a rework; a post can be both.
  const attention = useMemo(() => {
    const byId = new Map<string, Post>();
    for (const post of stats.overdue) byId.set(post.id, post);
    for (const post of visiblePosts) {
      if (post.approval === "Needs Revision") byId.set(post.id, post);
    }
    return [...byId.values()].slice(0, 6);
  }, [stats.overdue, visiblePosts]);

  if (total === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title={filtersActive(filters) ? "No posts match the filters" : "Nothing to report yet"}
          message={
            filtersActive(filters)
              ? "Clear a filter or two and the dashboard will fill back in."
              : "Add a few posts to this sheet and the pipeline, content mix and cadence will build themselves."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:gap-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-dim text-xs">
          {board?.name ?? "All posts"} · {total.toLocaleString()}{" "}
          {total === 1 ? "post" : "posts"} in view
        </p>
      </header>

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Total posts"
          value={total}
          icon={<LayoutGrid className="size-3.5" />}
          foot={
            weekData.length
              ? `Across ${weekData.length} ${weekData.length === 1 ? "week" : "weeks"}`
              : "No dates set yet"
          }
        />
        <Kpi
          label="Published"
          value={stats.published}
          icon={<CircleCheckBig className="size-3.5" />}
          foot={
            <span className="flex flex-col gap-1.5">
              <MiniBar value={share(stats.published)} color={SERIES_HUE} />
              <span className="tabular">{pct(stats.published)}% of plan</span>
            </span>
          }
        />
        <Kpi
          label="Scheduled"
          value={stats.scheduled}
          icon={<CalendarClock className="size-3.5" />}
          foot={`${stats.upcoming.length} upcoming · ${stats.notYet} not queued`}
        />
        <Kpi
          label="Needs revision"
          value={stats.needsRevision}
          icon={<TriangleAlert className="size-3.5" />}
          warn={stats.needsRevision > 0}
          foot={
            stats.needsRevision > 0
              ? "Blocked until reworked"
              : "Nothing to rework"
          }
        />
      </div>

      {/* --------------------------------------------------------- pipeline */}
      <Card title="Production pipeline" hint={`% of ${total.toLocaleString()} planned`}>
        <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          {pipeline.map((stage, i) => (
            <Fragment key={stage.key}>
              {i > 0 && (
                <ChevronRight
                  aria-hidden
                  className="text-dim mt-4 hidden size-3.5 shrink-0 xl:block"
                />
              )}
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted truncate text-xs">{stage.label}</span>
                  <span className="tabular shrink-0 text-xs">
                    <span className="text-body font-semibold">
                      {stage.value.toLocaleString()}
                    </span>
                    <span className="text-dim"> · {pct(stage.value)}%</span>
                  </span>
                </div>
                <MiniBar value={share(stage.value)} color={PIPELINE_RAMP[i]} />
              </div>
            </Fragment>
          ))}
        </div>

        {(stats.pending > 0 || stats.needsRevision > 0) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {stats.pending > 0 && (
              <Pill tone={APPROVAL_TONE.Pending} dot={APPROVAL_TONE.Pending.dot}>
                {stats.pending} awaiting approval
              </Pill>
            )}
            {stats.needsRevision > 0 && (
              <Pill
                tone={APPROVAL_TONE["Needs Revision"]}
                dot={APPROVAL_TONE["Needs Revision"].dot}
              >
                {stats.needsRevision} need revision
              </Pill>
            )}
          </div>
        )}
      </Card>

      {/* ----------------------------------------------- mix + platform mix */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Content mix"
          hint={
            stats.byType.length > typeData.length
              ? `Top ${typeData.length} of ${stats.byType.length}`
              : undefined
          }
        >
          {typeData.length ? (
            <BarRows
              rows={typeData}
              total={stats.total}
              colorFor={() => SERIES_HUE}
            />
          ) : (
            <Hint>Set a content type on a post to see the mix.</Hint>
          )}
        </Card>

        <Card
          title="Platform reach"
          hint={`${platformData.length} ${platformData.length === 1 ? "platform" : "platforms"}`}
        >
          {platformData.length ? (
            /* Platform hues are fixed brand identity, not a validated
               categorical ramp — so every row keeps a visible label and its
               value; colour is never the only channel. */
            <BarRows
              rows={platformData}
              total={stats.total}
              colorFor={platformColor}
            />
          ) : (
            <Hint>Tag a post with a platform to see reach.</Hint>
          )}
        </Card>
      </div>

      {/* --------------------------------------------------------- cadence */}
      <Card
        title="Publishing cadence"
        hint={weekData.length > 1 ? "Posts per week" : undefined}
      >
        {weekData.length > 1 ? (
          <ChartFrame height={232} ready={ready}>
            <ComposedChart
              data={weekData}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="pxCadenceWash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_HUE} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES_HUE} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke={chrome.grid}
                strokeOpacity={0.55}
              />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                minTickGap={18}
                tick={{ fill: chrome.tick, fontSize: 11 }}
                tickFormatter={(value: string) => formatCompact(value)}
              />
              <YAxis
                width={30}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: chrome.tick, fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: chrome.grid, strokeWidth: 1 }}
                content={(props) => (
                  <SeriesTooltip
                    {...props}
                    formatLabel={(raw) => `Week of ${formatShort(raw)}`}
                  />
                )}
              />
              {/* A wash, not a block — the line carries the shape. */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill="url(#pxCadenceWash)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={SERIES_HUE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: SERIES_HUE,
                  stroke: chrome.surface,
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartFrame>
        ) : (
          <Hint icon={<TrendingUp className="text-dim size-5" />}>
            {weekData.length === 1
              ? "Everything lands in a single week — spread the plan across two or more to see the cadence."
              : "Give a few posts a date and the weekly cadence shows up here."}
          </Hint>
        )}
      </Card>

      {/* ----------------------------------------------------------- lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Coming up"
          hint={stats.upcoming.length > upcoming.length ? `${upcoming.length} of ${stats.upcoming.length}` : undefined}
        >
          {upcoming.length ? (
            <div className="-mx-2 flex flex-col">
              {upcoming.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onOpen={() => setFocusedId(post.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarClock className="size-5" />}
              title="Nothing queued"
              message="Every dated post is already out the door. Date a draft to line up what comes next."
            />
          )}
        </Card>

        <Card
          title="Needs attention"
          hint={attention.length ? "Overdue or sent back" : undefined}
        >
          {attention.length ? (
            <div className="-mx-2 flex flex-col">
              {attention.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onOpen={() => setFocusedId(post.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<PartyPopper className="size-5" />}
              title="All clear"
              message="Nothing overdue and nothing waiting on a rework. The plan is on track."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- helpers


function Hint({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="text-muted flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center text-xs leading-relaxed">
      {icon}
      <p className="max-w-xs">{children}</p>
    </div>
  );
}

/**
 * Horizontal bars rendered as plain elements. Recharts' LabelList does not
 * emit anything under v3.10, and a bar chart whose value axis is hidden is
 * unreadable without direct labels — so these draw themselves.
 */
function BarRows({
  rows,
  total,
  colorFor,
}: {
  rows: { name: string; value: number }[];
  total: number;
  colorFor: (name: string) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const share = total ? Math.round((row.value / total) * 100) : 0;
        return (
          <li key={row.name} className="flex items-center gap-3">
            <span className="text-muted w-24 shrink-0 truncate text-right text-[11px]">
              {row.name}
            </span>
            <span className="relative h-4 flex-1 overflow-hidden rounded-[4px] bg-[var(--surface-hover)]">
              <span
                className="block h-full rounded-[4px] transition-[width] duration-500"
                style={{
                  width: `${(row.value / max) * 100}%`,
                  background: colorFor(row.name),
                }}
              />
            </span>
            <span className="tabular w-14 shrink-0 text-[11px] font-semibold">
              {row.value}
              <span className="text-dim ml-1 font-normal">{share}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
