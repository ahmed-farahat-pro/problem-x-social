"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ListFilter, Search, X } from "lucide-react";
import {
  Button,
  Input,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Modal,
} from "@/components/ui";
import { CONTENT_TYPES, PLATFORMS } from "@/lib/catalog";
import { useStore } from "@/lib/store";
import {
  APPROVAL_STATUSES,
  DESIGN_STATUSES,
  EMPTY_FILTERS,
  PUBLISH_STATUSES,
  SORT_FIELDS,
  filterCount,
  filtersActive,
  type SortField,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<SortField, string> = {
  date: "Date",
  title: "Title",
  contentType: "Type",
  designStatus: "Design",
  approval: "Approval",
  published: "Published",
  updatedAt: "Last edited",
};

function CountBadge({ value }: { value: number }) {
  return (
    <span className="bg-brand-500 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white">
      {value}
    </span>
  );
}

function SearchBox() {
  const { filters, setFilters } = useStore();
  return (
    <div className="relative min-w-[9rem] flex-1 sm:max-w-72">
      <Search
        className="text-dim pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="text"
        value={filters.search}
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        placeholder="Search captions, titles, tags…"
        aria-label="Search posts"
        className="h-8 pr-8 pl-8 text-xs"
      />
      {filters.search !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setFilters((f) => ({ ...f, search: "" }))}
          className="text-dim hover:text-body focus-ring absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded transition-colors"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Multi-select dropdown; the menu stays open while values are toggled. */
function FilterMenu<T extends string>({
  label,
  options,
  values,
  onChange,
  full,
}: {
  label: string;
  options: readonly T[];
  values: readonly T[];
  onChange: (next: T[]) => void;
  full?: boolean;
}) {
  const count = values.length;
  const toggle = (option: T) =>
    onChange(
      values.includes(option)
        ? values.filter((v) => v !== option)
        : [...values, option],
    );

  return (
    <Menu
      className={full ? "w-full" : undefined}
      panelClassName="min-w-[13rem]"
      trigger={
        <MenuTrigger
          className={cn(
            !full && "w-auto",
            // Only one text colour is ever emitted: the two custom utilities
            // sit in the same CSS layer, so twMerge cannot resolve a clash.
            count > 0 ? "border-brand-500/50" : "text-muted",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {label}
            {count > 0 && <CountBadge value={count} />}
          </span>
        </MenuTrigger>
      }
    >
      <MenuLabel>{label}</MenuLabel>
      {options.map((option) => (
        <MenuItem
          key={option}
          keepOpen
          selected={values.includes(option)}
          onClick={() => toggle(option)}
        >
          {option}
        </MenuItem>
      ))}
      {count > 0 && (
        <>
          <MenuSeparator />
          <MenuItem onClick={() => onChange([])}>Clear {label.toLowerCase()}</MenuItem>
        </>
      )}
    </Menu>
  );
}

function SortMenu({ full }: { full?: boolean }) {
  const { sortField, sortAsc, setSort } = useStore();
  const Arrow = sortAsc ? ArrowUp : ArrowDown;
  return (
    <Menu
      align="end"
      className={full ? "w-full" : undefined}
      panelClassName="min-w-[13rem]"
      trigger={
        <MenuTrigger className={cn(!full && "w-auto")}>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-dim">Sort</span>
            {SORT_LABELS[sortField]}
            <Arrow className="text-dim size-3" aria-hidden="true" />
          </span>
        </MenuTrigger>
      }
    >
      <MenuLabel>Sort by</MenuLabel>
      {SORT_FIELDS.map((field) => (
        <MenuItem
          key={field}
          keepOpen
          selected={sortField === field}
          onClick={() => setSort(field)}
        >
          {SORT_LABELS[field]}
        </MenuItem>
      ))}
      <MenuSeparator />
      {/* Re-selecting the active field is how the store flips direction. */}
      <MenuItem
        keepOpen
        icon={<Arrow className="size-3.5" />}
        onClick={() => setSort(sortField)}
      >
        {sortAsc ? "Ascending" : "Descending"}
      </MenuItem>
    </Menu>
  );
}

export default function FilterBar({ className }: { className?: string }) {
  const { board, filters, setFilters, visiblePosts } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Sheets imported from clients often carry types outside the catalog.
  const typeOptions = useMemo(() => {
    const used = (board?.posts ?? []).map((p) => p.contentType).filter(Boolean);
    return [...new Set([...CONTENT_TYPES, ...used])];
  }, [board]);

  const active = filtersActive(filters);
  const count = filterCount(filters);

  const menus = (full?: boolean) => (
    <>
      <FilterMenu
        full={full}
        label="Type"
        options={typeOptions}
        values={filters.types}
        onChange={(types) => setFilters((f) => ({ ...f, types }))}
      />
      <FilterMenu
        full={full}
        label="Platform"
        options={PLATFORMS}
        values={filters.platforms}
        onChange={(platforms) => setFilters((f) => ({ ...f, platforms }))}
      />
      <FilterMenu
        full={full}
        label="Design"
        options={DESIGN_STATUSES}
        values={filters.design}
        onChange={(design) => setFilters((f) => ({ ...f, design }))}
      />
      <FilterMenu
        full={full}
        label="Approval"
        options={APPROVAL_STATUSES}
        values={filters.approval}
        onChange={(approval) => setFilters((f) => ({ ...f, approval }))}
      />
      <FilterMenu
        full={full}
        label="Published"
        options={PUBLISH_STATUSES}
        values={filters.published}
        onChange={(published) => setFilters((f) => ({ ...f, published }))}
      />
    </>
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2",
        className,
      )}
    >
      <SearchBox />

      <div className="hidden items-center gap-1.5 lg:flex">{menus()}</div>

      <Button
        variant="secondary"
        size="sm"
        className="lg:hidden"
        onClick={() => setSheetOpen(true)}
      >
        <ListFilter className="size-3.5" aria-hidden="true" />
        Filters
        {count > 0 && <CountBadge value={count} />}
      </Button>

      <div className="hidden lg:block">
        <SortMenu />
      </div>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters(EMPTY_FILTERS)}
          aria-label={`Clear ${count} active filter${count === 1 ? "" : "s"}`}
        >
          <X className="size-3.5" aria-hidden="true" />
          Clear {count}
        </Button>
      )}

      <span className="text-dim tabular ml-auto shrink-0 text-xs">
        {visiblePosts.length} of {board?.posts.length ?? 0}
      </span>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        description="Narrow the sheet down, then close to review."
        footer={
          <>
            <Button
              variant="ghost"
              disabled={!active}
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear all
            </Button>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Show {visiblePosts.length}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          {menus(true)}
          <div className="mt-1 border-t border-[var(--line)] pt-3">
            <SortMenu full />
          </div>
        </div>
      </Modal>
    </div>
  );
}
