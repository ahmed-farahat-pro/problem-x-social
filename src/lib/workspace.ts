import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  ApprovalStatus,
  Board,
  Company,
  DesignStatus,
  Post,
  PublishStatus,
  Workspace,
} from "./types";

type PostRow = typeof schema.posts.$inferSelect;
type BoardRow = typeof schema.boards.$inferSelect;
type CompanyRow = typeof schema.companies.$inferSelect;

export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    boardId: row.boardId,
    date: row.date,
    contentType: row.contentType,
    title: row.title,
    content: row.content,
    platforms: row.platforms ?? [],
    designStatus: row.designStatus as DesignStatus,
    driveLink: row.driveLink,
    notes: row.notes,
    approval: row.approval as ApprovalStatus,
    published: row.published as PublishStatus,
    ideas: row.ideas,
    tags: row.tags ?? [],
    owner: row.owner,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toBoard(row: BoardRow, posts: Post[]): Board {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    emoji: row.emoji,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    posts,
  };
}

function toCompany(row: CompanyRow, boards: Board[]): Company {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    colorHex: row.colorHex,
    brandNotes: row.brandNotes,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    boards,
  };
}

/**
 * Loads the whole tree in three queries and assembles it in memory.
 * The dataset is small (thousands of posts at most) and the client keeps it
 * resident, which is what makes editing feel instant.
 */
export async function loadWorkspace(): Promise<Workspace> {
  const [companyRows, boardRows, postRows] = await Promise.all([
    db
      .select()
      .from(schema.companies)
      .orderBy(asc(schema.companies.position), asc(schema.companies.createdAt)),
    db
      .select()
      .from(schema.boards)
      .orderBy(asc(schema.boards.position), asc(schema.boards.createdAt)),
    db
      .select()
      .from(schema.posts)
      .orderBy(asc(schema.posts.position), asc(schema.posts.createdAt)),
  ]);

  const postsByBoard = new Map<string, Post[]>();
  for (const row of postRows) {
    const list = postsByBoard.get(row.boardId) ?? [];
    list.push(toPost(row));
    postsByBoard.set(row.boardId, list);
  }

  const boardsByCompany = new Map<string, Board[]>();
  for (const row of boardRows) {
    const list = boardsByCompany.get(row.companyId) ?? [];
    list.push(toBoard(row, postsByBoard.get(row.id) ?? []));
    boardsByCompany.set(row.companyId, list);
  }

  return {
    companies: companyRows.map((row) =>
      toCompany(row, boardsByCompany.get(row.id) ?? []),
    ),
  };
}
