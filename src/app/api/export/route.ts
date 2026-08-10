import { requireUser } from "@/lib/auth";
import { fail, handle, readJson } from "@/lib/api";
import { loadWorkspace } from "@/lib/workspace";
import { buildCSV, buildMarkdown, buildWorkbook, type SheetSpec } from "@/lib/sheets";
import { sanitiseFileName } from "@/lib/utils";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  format: "xlsx" | "csv" | "md" | "json";
  scope: "board" | "company" | "workspace" | "selection";
  boardId?: string;
  companyId?: string;
  postIds?: string[];
  filename?: string;
}

export async function POST(request: Request) {
  return handle(async () => {
    await requireUser();
    const body = await readJson<Body>(request);
    const workspace = await loadWorkspace();

    let sheets: SheetSpec[] = [];
    let flat: Post[] = [];
    let label = "Problem-X";

    if (body.scope === "workspace") {
      label = "Problem-X workspace";
      for (const c of workspace.companies) {
        for (const b of c.boards) {
          sheets.push({ name: `${c.name} - ${b.name}`, posts: b.posts });
          flat.push(...b.posts);
        }
      }
    } else if (body.scope === "company") {
      const company = workspace.companies.find((c) => c.id === body.companyId);
      if (!company) return fail("Company not found.", 404);
      label = `${company.name} — all sheets`;
      sheets = company.boards.map((b) => ({ name: b.name, posts: b.posts }));
      flat = company.boards.flatMap((b) => b.posts);
    } else {
      const company = workspace.companies.find((c) =>
        c.boards.some((b) => b.id === body.boardId),
      );
      const board = company?.boards.find((b) => b.id === body.boardId);
      if (!board || !company) return fail("Sheet not found.", 404);
      flat =
        body.scope === "selection" && body.postIds?.length
          ? board.posts.filter((p) => body.postIds!.includes(p.id))
          : board.posts;
      label = `${company.name} — ${board.name}`;
      sheets = [{ name: board.name, posts: flat }];
    }

    const accent =
      workspace.companies.find((c) => c.id === body.companyId)?.colorHex ??
      workspace.companies.find((c) =>
        c.boards.some((b) => b.id === body.boardId),
      )?.colorHex ??
      "#7C5CFF";

    const base = sanitiseFileName(body.filename || label);

    switch (body.format) {
      case "xlsx": {
        const buffer = await buildWorkbook(sheets, accent);
        return fileResponse(
          new Uint8Array(buffer),
          `${base}.xlsx`,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      }
      case "csv":
        return fileResponse(buildCSV(flat), `${base}.csv`, "text/csv; charset=utf-8");
      case "md":
        return fileResponse(
          buildMarkdown(label, flat),
          `${base}.md`,
          "text/markdown; charset=utf-8",
        );
      case "json":
        return fileResponse(
          JSON.stringify(
            body.scope === "workspace" ? workspace : { posts: flat },
            null,
            2,
          ),
          `${base}.json`,
          "application/json",
        );
      default:
        return fail("Unknown format.");
    }
  });
}

function fileResponse(
  data: Uint8Array | string,
  filename: string,
  contentType: string,
) {
  const body = typeof data === "string" ? data : (data as unknown as BodyInit);
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
