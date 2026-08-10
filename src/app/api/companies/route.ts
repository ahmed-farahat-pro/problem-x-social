import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCan } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { COMPANY_PALETTE } from "@/lib/catalog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    await requireCan("create", "companies");
    const body = await readJson<{
      name?: string;
      handle?: string;
      colorHex?: string;
      withBoard?: boolean;
    }>(request);

    const existing = await db
      .select({ position: schema.companies.position })
      .from(schema.companies)
      .orderBy(desc(schema.companies.position))
      .limit(1);
    const nextPosition = (existing[0]?.position ?? -1) + 1;

    const [company] = await db
      .insert(schema.companies)
      .values({
        name: (body.name ?? "").trim() || "New Company",
        handle: body.handle ?? "",
        colorHex:
          body.colorHex ??
          COMPANY_PALETTE[nextPosition % COMPANY_PALETTE.length],
        position: nextPosition,
      })
      .returning();

    let board = null;
    if (body.withBoard !== false) {
      [board] = await db
        .insert(schema.boards)
        .values({
          companyId: company.id,
          name: "Content Plan",
          emoji: "🗓️",
          position: 0,
        })
        .returning();
    }

    return ok({ company, board });
  });
}
