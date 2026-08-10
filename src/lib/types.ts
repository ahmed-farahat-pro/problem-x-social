// Shared domain types. Mirrors the DB schema in src/db/schema.ts.

export const DESIGN_STATUSES = [
  "Not Started",
  "In Progress",
  "Design Ready",
  "Uploaded to Drive",
] as const;

export const APPROVAL_STATUSES = [
  "Pending",
  "Approved",
  "Needs Revision",
] as const;

export const PUBLISH_STATUSES = ["Not Yet", "Scheduled", "Published"] as const;

export type DesignStatus = (typeof DESIGN_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export interface Post {
  id: string;
  boardId: string;
  /** ISO date string (yyyy-mm-dd) or null when unscheduled. */
  date: string | null;
  contentType: string;
  title: string;
  content: string;
  platforms: string[];
  designStatus: DesignStatus;
  driveLink: string;
  notes: string;
  approval: ApprovalStatus;
  published: PublishStatus;
  ideas: string;
  tags: string[];
  owner: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  companyId: string;
  name: string;
  emoji: string;
  position: number;
  createdAt: string;
  posts: Post[];
}

export interface Company {
  id: string;
  name: string;
  handle: string;
  colorHex: string;
  brandNotes: string;
  position: number;
  createdAt: string;
  boards: Board[];
}

export interface Workspace {
  companies: Company[];
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

// ---------------------------------------------------------------- view models

export const VIEW_MODES = ["table", "board", "calendar", "dashboard"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const GROUP_KEYS = [
  "designStatus",
  "approval",
  "published",
  "contentType",
] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

export const SORT_FIELDS = [
  "date",
  "title",
  "contentType",
  "designStatus",
  "approval",
  "published",
  "updatedAt",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export interface Filters {
  search: string;
  types: string[];
  platforms: string[];
  design: DesignStatus[];
  approval: ApprovalStatus[];
  published: PublishStatus[];
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  types: [],
  platforms: [],
  design: [],
  approval: [],
  published: [],
};

export function filtersActive(f: Filters): boolean {
  return (
    f.search.trim() !== "" ||
    f.types.length > 0 ||
    f.platforms.length > 0 ||
    f.design.length > 0 ||
    f.approval.length > 0 ||
    f.published.length > 0
  );
}

export function filterCount(f: Filters): number {
  return (
    (f.search.trim() ? 1 : 0) +
    f.types.length +
    f.platforms.length +
    f.design.length +
    f.approval.length +
    f.published.length
  );
}

/** Shape accepted when creating/updating a post. All fields optional. */
export type PostInput = Partial<Omit<Post, "id" | "createdAt" | "updatedAt">>;
