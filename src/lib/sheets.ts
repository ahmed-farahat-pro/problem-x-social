import ExcelJS from "exceljs";
import {
  CONTENT_TYPES,
  normaliseContentType,
  parseApproval,
  parseDesignStatus,
  parsePlatforms,
  parsePublish,
} from "./catalog";
import {
  APPROVAL_STATUSES,
  DESIGN_STATUSES,
  PUBLISH_STATUSES,
  type Post,
  type PostInput,
} from "./types";
import { dayLabel, formatShort, toISODate } from "./utils";

export const SHEET_HEADERS = [
  "Date",
  "Day",
  "Content Type",
  "Title / Topic",
  "Content",
  "Platform(s)",
  "Design Status",
  "Drive Link",
  "Notes",
  "Approval",
  "Published",
  "Ideas out of the box",
  "Tags",
  "Owner",
];

const COLUMN_WIDTHS = [12, 8, 17, 34, 60, 22, 19, 30, 40, 16, 15, 34, 20, 16];

// ------------------------------------------------------------------ exporting

export interface SheetSpec {
  name: string;
  posts: Post[];
}

function sanitiseSheetName(raw: string, used: Set<string>): string {
  let name = (raw || "Sheet").replace(/[\\/?*[\]:]/g, "-").trim().slice(0, 31);
  if (!name) name = "Sheet";
  let attempt = 2;
  const base = name;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${attempt++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

/**
 * Builds a styled workbook: frozen header in the brand colour, sized columns,
 * wrapped text, autofilter, and live dropdowns so the file stays a *working*
 * sheet rather than a dead dump.
 */
export async function buildWorkbook(
  sheets: SheetSpec[],
  accentHex = "#7C5CFF",
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Problem-X Social";
  wb.created = new Date();

  const argb = "FF" + accentHex.replace("#", "").toUpperCase();
  const used = new Set<string>();
  const specs = sheets.length ? sheets : [{ name: "Sheet1", posts: [] }];

  for (const spec of specs) {
    const ws = wb.addWorksheet(sanitiseSheetName(spec.name, used), {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    ws.columns = SHEET_HEADERS.map((header, i) => ({
      header,
      width: COLUMN_WIDTHS[i],
    }));

    const headerRow = ws.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = thinBorder();
    });

    for (const post of spec.posts) {
      const row = ws.addRow([
        post.date ?? "",
        dayLabel(post.date),
        post.contentType,
        post.title,
        post.content,
        post.platforms.join(", "),
        post.designStatus,
        post.driveLink,
        post.notes,
        post.approval,
        post.published,
        post.ideas,
        post.tags.join(", "),
        post.owner,
      ]);
      row.alignment = { vertical: "top", wrapText: true };
      row.eachCell((cell) => (cell.border = thinBorder()));
      row.getCell(1).alignment = { vertical: "top", horizontal: "center" };
      for (const i of [2, 3, 7, 10, 11, 14]) {
        row.getCell(i).alignment = {
          vertical: "top",
          horizontal: "center",
          wrapText: true,
        };
      }
      if (post.driveLink) {
        row.getCell(8).font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }

    const lastRow = Math.max(ws.rowCount, 2);
    ws.autoFilter = { from: "A1", to: { row: lastRow, column: SHEET_HEADERS.length } };

    const validationLast = Math.max(lastRow, 500);
    addList(ws, "C", validationLast, CONTENT_TYPES);
    addList(ws, "G", validationLast, [...DESIGN_STATUSES]);
    addList(ws, "J", validationLast, [...APPROVAL_STATUSES]);
    addList(ws, "K", validationLast, [...PUBLISH_STATUSES]);
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: "thin" as const, color: { argb: "FFD9DDE3" } };
  return { top: side, left: side, bottom: side, right: side };
}

/** ExcelJS exposes `dataValidations` at runtime but omits it from its types. */
interface ValidationHost {
  dataValidations: {
    add(range: string, validation: ExcelJS.DataValidation): void;
  };
}

function addList(
  ws: ExcelJS.Worksheet,
  column: string,
  lastRow: number,
  values: string[],
) {
  // Range form, not per-cell: touching cells would instantiate hundreds of
  // blank rows and bloat the file.
  (ws as unknown as ValidationHost).dataValidations.add(
    `${column}2:${column}${lastRow}`,
    {
      type: "list",
      allowBlank: true,
      formulae: [`"${values.join(",")}"`],
    },
  );
}

// -------------------------------------------------------------- csv / markdown

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCSV(posts: Post[]): string {
  const lines = [SHEET_HEADERS.map(csvCell).join(",")];
  for (const p of posts) {
    lines.push(
      [
        p.date ?? "",
        dayLabel(p.date),
        p.contentType,
        p.title,
        p.content,
        p.platforms.join(", "),
        p.designStatus,
        p.driveLink,
        p.notes,
        p.approval,
        p.published,
        p.ideas,
        p.tags.join(", "),
        p.owner,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM so Excel reads the Arabic as UTF-8 on the first open.
  return "﻿" + lines.join("\n");
}

export function buildMarkdown(title: string, posts: Post[]): string {
  const published = posts.filter((p) => p.published === "Published").length;
  const approved = posts.filter((p) => p.approval === "Approved").length;
  let out = `# ${title}\n\n_Exported from Problem-X Social · ${formatShort(
    toISODate(new Date()),
  )}_\n\n`;
  out += `**${posts.length}** pieces · ${published} published · ${approved} approved\n\n---\n\n`;

  for (const p of posts) {
    out += `## ${p.title || "Untitled"}\n\n`;
    out += `\`${p.date ? `${formatShort(p.date)} · ${dayLabel(p.date)}` : "Unscheduled"}\``;
    if (p.contentType) out += ` · **${p.contentType}**`;
    if (p.platforms.length) out += ` · ${p.platforms.join(", ")}`;
    out += `\n\n| Design | Approval | Published |\n|---|---|---|\n`;
    out += `| ${p.designStatus} | ${p.approval} | ${p.published} |\n\n`;
    if (p.content) {
      out += p.content.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n";
    }
    if (p.notes) out += `**Notes:** ${p.notes}\n\n`;
    if (p.ideas) out += `**Ideas:** ${p.ideas}\n\n`;
    if (p.driveLink) out += `[Assets](${p.driveLink})\n\n`;
    out += `---\n\n`;
  }
  return out;
}

// ------------------------------------------------------------------ importing

type Field =
  | "date" | "day" | "type" | "title" | "content" | "platforms" | "design"
  | "link" | "notes" | "approval" | "published" | "ideas" | "tags" | "owner";

/** Maps a header cell to a field. Order matters — specific tests run first. */
export function fieldForHeader(header: string): Field | null {
  const h = header.trim().toLowerCase();
  if (!h) return null;
  if (h === "day" || h.startsWith("day ")) return "day";
  if (h.includes("date") || h.includes("when") || h.includes("schedule")) return "date";
  if (h.includes("idea")) return "ideas";
  if (h.includes("approv") || h.includes("review")) return "approval";
  if (h.includes("publish") || h.includes("posted") || h.includes("live")) return "published";
  if (h.includes("design") || h === "status") return "design";
  if (h.includes("platform") || h.includes("channel") || h.includes("network")) return "platforms";
  if (h.includes("link") || h.includes("drive") || h.includes("url") || h.includes("asset")) return "link";
  if (h.includes("note") || h.includes("feedback") || h.includes("comment") || h.includes("revision")) return "notes";
  if (h.includes("tag") || h.includes("label")) return "tags";
  if (h.includes("owner") || h.includes("assign") || h.includes("responsib")) return "owner";
  if (h.includes("type") || h.includes("format")) return "type";
  if (h.includes("title") || h.includes("topic") || h.includes("subject") || h.includes("headline")) return "title";
  if (h.includes("content") || h.includes("caption") || h.includes("copy") || h.includes("script") || h.includes("body")) return "content";
  return null;
}

const DEFAULT_ORDER: Field[] = [
  "date", "day", "type", "title", "content", "platforms", "design",
  "link", "notes", "approval", "published", "ideas", "tags", "owner",
];

type Cell = string | number | Date | null;

/**
 * ExcelJS hands back UTC-midnight Date objects for date cells. Reading them
 * with local getters shifts the calendar day in any negative-offset timezone,
 * so the UTC components are the ones that mean "the day the user typed".
 */
function excelDateToISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function cellToText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return excelDateToISO(cell);
  return String(cell).trim();
}

function cellToDate(cell: Cell): string | null {
  if (cell instanceof Date) return excelDateToISO(cell);
  if (typeof cell === "number") {
    // Excel serial → JS date. Reject values outside a sane calendar window so a
    // plain "5" in a date column doesn't become 1900.
    if (cell < 20000 || cell > 80000) return null;
    const base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + Math.round(cell));
    return toISODate(base);
  }
  const text = cellToText(cell);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : toISODate(parsed);
}

export function rowsToPosts(grid: Cell[][]): PostInput[] {
  if (!grid.length) return [];

  // Find the header within the first few rows.
  let headerIndex = -1;
  let mapping = new Map<number, Field>();
  for (let i = 0; i < Math.min(10, grid.length); i++) {
    const candidate = new Map<number, Field>();
    grid[i].forEach((cell, c) => {
      const f = fieldForHeader(cellToText(cell));
      if (f) candidate.set(c, f);
    });
    if (new Set(candidate.values()).size >= 3) {
      headerIndex = i;
      mapping = candidate;
      break;
    }
  }
  if (headerIndex === -1) {
    DEFAULT_ORDER.forEach((f, i) => mapping.set(i, f));
  }

  const out: PostInput[] = [];
  for (const raw of grid.slice(headerIndex + 1)) {
    const post: PostInput = {};
    let sawSomething = false;
    let isRepeatedHeader = false;

    for (const [index, field] of mapping) {
      const cell = raw[index];
      if (cell === undefined) continue;
      const text = cellToText(cell);

      switch (field) {
        case "day":
          break;
        case "date": {
          const d = cellToDate(cell);
          if (d) { post.date = d; sawSomething = true; }
          break;
        }
        case "type": {
          if (text.toLowerCase() === "content type") isRepeatedHeader = true;
          const v = normaliseContentType(text);
          if (v) { post.contentType = v; sawSomething = true; }
          break;
        }
        case "title":
          if (text.toLowerCase() === "title / topic") isRepeatedHeader = true;
          if (text) { post.title = text; sawSomething = true; }
          break;
        case "content":
          if (text) { post.content = text; sawSomething = true; }
          break;
        case "platforms": {
          const p = parsePlatforms(text);
          if (p.length) { post.platforms = p; sawSomething = true; }
          break;
        }
        case "design":
          if (text) { post.designStatus = parseDesignStatus(text); sawSomething = true; }
          break;
        case "link":
          if (text) { post.driveLink = text; sawSomething = true; }
          break;
        case "notes":
          // "." is the team's placeholder for "no notes".
          if (text && text !== ".") { post.notes = text; sawSomething = true; }
          break;
        case "approval":
          if (text) { post.approval = parseApproval(text); sawSomething = true; }
          break;
        case "published":
          if (text) { post.published = parsePublish(text); sawSomething = true; }
          break;
        case "ideas":
          if (text) { post.ideas = text; sawSomething = true; }
          break;
        case "tags": {
          const tags = text.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
          if (tags.length) { post.tags = tags; sawSomething = true; }
          break;
        }
        case "owner":
          if (text) { post.owner = text; sawSomething = true; }
          break;
      }
    }

    if (isRepeatedHeader) continue;
    // A row carrying only a date is spreadsheet padding.
    if (!sawSomething) continue;
    if (!post.title && !post.content && !post.contentType && !post.driveLink) continue;
    out.push(post);
  }
  return out;
}

export async function readWorkbook(
  buffer: ArrayBuffer,
): Promise<{ name: string; posts: PostInput[] }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const result: { name: string; posts: PostInput[] }[] = [];

  wb.eachSheet((ws) => {
    const grid: Cell[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      // ExcelJS row.values is 1-indexed with a leading hole.
      const cells = values.slice(1).map((v) => {
        if (v === null || v === undefined) return null;
        if (v instanceof Date) return v;
        if (typeof v === "number" || typeof v === "string") return v;
        const rich = v as { richText?: { text: string }[]; text?: string; result?: unknown };
        if (rich.richText) return rich.richText.map((r) => r.text).join("");
        if (typeof rich.text === "string") return rich.text;
        if (rich.result !== undefined) return String(rich.result);
        return String(v);
      }) as Cell[];
      grid.push(cells);
    });
    const posts = rowsToPosts(grid);
    if (posts.length) result.push({ name: ws.name, posts });
  });

  return result;
}

/** RFC-4180-ish scan so quoted cells containing newlines survive. */
export function parseDelimited(text: string): string[][] {
  const normalised = text.replace(/\r\n?/g, "\n");
  const firstLine = normalised.split("\n", 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/\t/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
      ? "\t"
      : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalised.length; i++) {
    const ch = normalised[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalised[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
