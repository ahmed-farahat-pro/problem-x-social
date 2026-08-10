import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull().default(""),
  colorHex: text("color_hex").notNull().default("#7C5CFF"),
  brandNotes: text("brand_notes").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🗓️"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("boards_company_idx").on(t.companyId)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    // Stored as a bare date so a post never shifts across timezones.
    date: text("date"),
    contentType: text("content_type").notNull().default(""),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    platforms: text("platforms").array().notNull().default([]),
    designStatus: text("design_status").notNull().default("Not Started"),
    driveLink: text("drive_link").notNull().default(""),
    notes: text("notes").notNull().default(""),
    approval: text("approval").notNull().default("Pending"),
    published: text("published").notNull().default("Not Yet"),
    ideas: text("ideas").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    owner: text("owner").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("posts_board_idx").on(t.boardId)],
);
