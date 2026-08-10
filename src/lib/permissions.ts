// Role-based access control.
//
// Four roles with cascading scope: admin > owner > (designer, content_creator).
// `can()` is the single source of truth consulted by every API route; the
// client mirrors the same matrix (via permissionsFor) so UI can hide/disable
// actions the server would reject anyway.

import type { PostInput } from "./types";

export type Role = "admin" | "owner" | "designer" | "content_creator";

export const ROLES: Role[] = [
  "admin",
  "owner",
  "designer",
  "content_creator",
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  owner: "Owner",
  designer: "Designer",
  content_creator: "Content Creator",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access: manages users, signup settings and all content.",
  owner: "Project owner: full control of companies, sheets and posts.",
  designer: "Edits design fields — design status, drive link, ideas.",
  content_creator: "Writes content — caption, type, platforms, date, tags.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

// ----------------------------------------------------------------- resources

export type Resource = "companies" | "boards" | "posts" | "users" | "settings";
export type Action = "create" | "read" | "update" | "delete";

const ALLOW: Record<Role, Partial<Record<Resource, Action[]>>> = {
  admin: {
    users: ["create", "read", "update", "delete"],
    settings: ["read", "update"],
    companies: ["create", "read", "update", "delete"],
    boards: ["create", "read", "update", "delete"],
    posts: ["create", "read", "update", "delete"],
  },
  owner: {
    companies: ["create", "read", "update", "delete"],
    boards: ["create", "read", "update", "delete"],
    posts: ["create", "read", "update", "delete"],
    settings: ["read"],
  },
  designer: {
    companies: ["read"],
    boards: ["read"],
    posts: ["read", "update"],
  },
  content_creator: {
    companies: ["read"],
    boards: ["read"],
    posts: ["create", "read", "update"],
  },
};

export function can(role: Role, action: Action, resource: Resource): boolean {
  return Boolean(ALLOW[role]?.[resource]?.includes(action));
}

// ----------------------------------------------------------- post field gates
//
// Posts are the one resource edited field-by-field. Designers handle the
// design side, content creators handle the copy, and the approval/publish
// workflow is reserved for owner/admin.

export const POST_FIELDS = [
  "date",
  "contentType",
  "title",
  "content",
  "platforms",
  "designStatus",
  "driveLink",
  "notes",
  "approval",
  "published",
  "ideas",
  "tags",
  "owner",
  "position",
] as const;

export type PostField = (typeof POST_FIELDS)[number];

const FIELD_ACCESS: Record<Role, readonly PostField[] | "all"> = {
  admin: "all",
  owner: "all",
  designer: ["designStatus", "driveLink", "ideas", "notes"],
  content_creator: [
    "date",
    "contentType",
    "title",
    "content",
    "platforms",
    "tags",
    "owner",
    "notes",
    "ideas",
  ],
};

export function editableFields(role: Role): readonly PostField[] | "all" {
  return FIELD_ACCESS[role];
}

export function canEditField(role: Role, field: PostField): boolean {
  const allowed = FIELD_ACCESS[role];
  return allowed === "all" || allowed.includes(field);
}

/** Strips a post patch down to the fields this role may write. */
export function filterPostPatch(
  role: Role,
  patch: PostInput,
): PostInput {
  const allowed = FIELD_ACCESS[role];
  if (allowed === "all") return patch;
  const permit = new Set(allowed);
  const next: PostInput = { ...patch };
  for (const key of Object.keys(next) as PostField[]) {
    if (!permit.has(key)) delete next[key];
  }
  return next;
}

// ------------------------------------------------------ client permission set
//
// A compact snapshot the client consumes to hide/disable UI. Mirrors can().

export interface Permissions {
  role: Role;
  isAdmin: boolean;
  canManageStructure: boolean; // create/edit/delete companies & boards
  canCreatePost: boolean;
  canDeletePost: boolean;
  editableFields: readonly PostField[] | "all";
  canEditField: (field: PostField) => boolean;
}

export function permissionsFor(role: Role): Permissions {
  return {
    role,
    isAdmin: role === "admin",
    canManageStructure:
      can(role, "create", "companies") && can(role, "delete", "boards"),
    canCreatePost: can(role, "create", "posts"),
    canDeletePost: can(role, "delete", "posts"),
    editableFields: editableFields(role),
    canEditField: (field) => canEditField(role, field),
  };
}
