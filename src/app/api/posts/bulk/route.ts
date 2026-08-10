import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/api";
import { can, filterPostPatch } from "@/lib/permissions";
import { toPost } from "@/lib/workspace";
import { pickPostFields } from "../route";
import type { PostInput } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  action: "update" | "delete" | "duplicate" | "move" | "reschedule";
  ids: string[];
  patch?: PostInput;
  boardId?: string;
  /** reschedule: ISO start date, day step, and whether to skip Sat/Sun. */
  start?: string;
  step?: number;
  skipWeekends?: boolean;
  /** duplicate: shift each copy's date forward by N days. */
  offsetDays?: number;
}

function shiftISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson<Body>(request);
    const ids = body.ids ?? [];
    if (ids.length === 0) return fail("No posts selected.");

    switch (body.action) {
      case "delete": {
        if (!can(user.role, "delete", "posts")) return fail("Not allowed.", 403);
        await db.delete(schema.posts).where(inArray(schema.posts.id, ids));
        return ok({ deleted: ids });
      }

      case "update": {
        if (!can(user.role, "update", "posts")) return fail("Not allowed.", 403);
        const filtered = filterPostPatch(user.role, pickPostFields(body.patch ?? {}));
        if (Object.keys(filtered).length === 0) return fail("Nothing to update.");
        const patch: Record<string, unknown> = { ...filtered, updatedAt: new Date() };
        const rows = await db
          .update(schema.posts)
          .set(patch)
          .where(inArray(schema.posts.id, ids))
          .returning();
        return ok({ posts: rows.map(toPost) });
      }

      case "move": {
        // Moving reorganises boards, so it needs structural rights.
        if (!can(user.role, "delete", "posts")) return fail("Not allowed.", 403);
        if (!body.boardId) return fail("boardId is required.");
        const rows = await db
          .update(schema.posts)
          .set({ boardId: body.boardId, updatedAt: new Date() })
          .where(inArray(schema.posts.id, ids))
          .returning();
        return ok({ posts: rows.map(toPost) });
      }

      case "duplicate": {
        if (!can(user.role, "create", "posts")) return fail("Not allowed.", 403);
        const source = await db
          .select()
          .from(schema.posts)
          .where(inArray(schema.posts.id, ids));
        if (!source.length) return ok({ posts: [] });

        const offset = body.offsetDays ?? 0;
        const rows = await db
          .insert(schema.posts)
          .values(
            source.map((p) => ({
              boardId: body.boardId ?? p.boardId,
              date: p.date && offset ? shiftISO(p.date, offset) : p.date,
              contentType: p.contentType,
              title: offset ? p.title : p.title ? `${p.title} (copy)` : "",
              content: p.content,
              platforms: p.platforms,
              // A repeat starts fresh — carrying "Published" over is never right.
              designStatus: offset ? "Not Started" : p.designStatus,
              driveLink: offset ? "" : p.driveLink,
              notes: p.notes,
              approval: offset ? "Pending" : p.approval,
              published: "Not Yet",
              ideas: p.ideas,
              tags: p.tags,
              owner: p.owner,
              position: p.position,
            })),
          )
          .returning();
        return ok({ posts: rows.map(toPost) });
      }

      case "reschedule": {
        if (!can(user.role, "update", "posts")) return fail("Not allowed.", 403);
        if (!body.start) return fail("start date is required.");
        const step = Math.max(1, body.step ?? 1);
        let cursor = body.start;
        const updated = [];

        for (const id of ids) {
          if (body.skipWeekends) {
            for (;;) {
              const [y, m, d] = cursor.split("-").map(Number);
              const day = new Date(y, m - 1, d).getDay();
              if (day !== 0 && day !== 6) break;
              cursor = shiftISO(cursor, 1);
            }
          }
          const [row] = await db
            .update(schema.posts)
            .set({ date: cursor, updatedAt: new Date() })
            .where(inArray(schema.posts.id, [id]))
            .returning();
          if (row) updated.push(toPost(row));
          cursor = shiftISO(cursor, step);
        }
        return ok({ posts: updated });
      }

      default:
        return fail("Unknown action.");
    }
  });
}
