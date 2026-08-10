import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadWorkspace } from "@/lib/workspace";
import { dayLabel, formatShort, isRTL } from "@/lib/utils";
import PrintTrigger from "./PrintTrigger";

export const dynamic = "force-dynamic";

/**
 * A print-optimised report. PDF is produced by the browser's own print engine,
 * which is the only thing that shapes Arabic text correctly without shipping a
 * font stack and a bidi algorithm to the server.
 */
export default async function PrintPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { boardId } = await params;
  const workspace = await loadWorkspace();
  const company = workspace.companies.find((c) =>
    c.boards.some((b) => b.id === boardId),
  );
  const board = company?.boards.find((b) => b.id === boardId);
  if (!company || !board) notFound();

  const posts = [...board.posts].sort((a, b) =>
    (a.date ?? "9999").localeCompare(b.date ?? "9999"),
  );

  const published = posts.filter((p) => p.published === "Published").length;
  const scheduled = posts.filter((p) => p.published === "Scheduled").length;
  const approved = posts.filter((p) => p.approval === "Approved").length;
  const revisions = posts.filter((p) => p.approval === "Needs Revision").length;
  const designed = posts.filter((p) => p.designStatus === "Uploaded to Drive").length;

  const dates = posts.map((p) => p.date).filter(Boolean) as string[];
  const platformMix = new Map<string, number>();
  const typeMix = new Map<string, number>();
  for (const p of posts) {
    for (const plat of p.platforms) {
      platformMix.set(plat, (platformMix.get(plat) ?? 0) + 1);
    }
    if (p.contentType) typeMix.set(p.contentType, (typeMix.get(p.contentType) ?? 0) + 1);
  }

  const tiles = [
    { value: posts.length, label: "Total pieces" },
    { value: published, label: "Published" },
    { value: scheduled, label: "Scheduled" },
    { value: approved, label: "Approved" },
    { value: revisions, label: "Needs revision" },
    { value: designed, label: "Design ready" },
  ];

  return (
    <div className="mx-auto max-w-[820px] bg-white px-8 py-10 text-[#111] print:px-0 print:py-0">
      <PrintTrigger />

      <header
        className="-mx-8 mb-8 px-8 py-10 text-white print:-mx-0 print:px-8"
        style={{
          background: `linear-gradient(135deg, ${company.colorHex}, #0EA5E9)`,
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        <p className="text-[10px] font-black tracking-[0.28em] opacity-85">
          PROBLEM-X SOCIAL
        </p>
        <h1 className="mt-3 text-4xl font-bold">{company.name}</h1>
        <p className="mt-2 text-sm opacity-90">
          {board.emoji} {board.name}
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl bg-[#f4f5f8] p-4">
            <p className="text-2xl font-bold" style={{ color: company.colorHex }}>
              {tile.value}
            </p>
            <p className="mt-0.5 text-[9px] font-bold tracking-[0.09em] text-[#6b7280] uppercase">
              {tile.label}
            </p>
          </div>
        ))}
      </section>

      <section className="mb-9 space-y-1.5 text-[11px] text-[#444]">
        {dates.length > 0 && (
          <p>
            <strong className="font-semibold">Plan window</strong>{" "}
            {formatShort(dates[0])} → {formatShort(dates[dates.length - 1])}
          </p>
        )}
        {platformMix.size > 0 && (
          <p>
            <strong className="font-semibold">Platform mix</strong>{" "}
            {[...platformMix.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k} ${v}`)
              .join("  ·  ")}
          </p>
        )}
        {typeMix.size > 0 && (
          <p>
            <strong className="font-semibold">Content mix</strong>{" "}
            {[...typeMix.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `${k} ${v}`)
              .join("  ·  ")}
          </p>
        )}
      </section>

      <section className="mb-10">
        <h2
          className="mb-3 text-[11px] font-black tracking-[0.16em] uppercase"
          style={{ color: company.colorHex }}
        >
          Content index
        </h2>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-[#ddd] text-left text-[8.5px] font-bold tracking-[0.06em] text-[#6b7280] uppercase">
              <th className="py-1.5 pr-2">Date</th>
              <th className="py-1.5 pr-2">Type</th>
              <th className="py-1.5 pr-2">Title</th>
              <th className="py-1.5 pr-2">Approval</th>
              <th className="py-1.5">Published</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-[#f0f0f0]">
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {post.date ?? "—"}
                </td>
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {post.contentType || "—"}
                </td>
                <td className="max-w-[280px] truncate py-1.5 pr-2">
                  {post.title || post.content.split("\n")[0] || "Untitled"}
                </td>
                <td className="py-1.5 pr-2 whitespace-nowrap">{post.approval}</td>
                <td className="py-1.5 whitespace-nowrap">{post.published}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2
          className="mb-4 text-[11px] font-black tracking-[0.16em] uppercase"
          style={{ color: company.colorHex }}
        >
          Content detail
        </h2>
        <div className="space-y-7">
          {posts.map((post) => (
            <article
              key={post.id}
              className="print-break border-t border-[#e8e8e8] pt-5 first:border-t-0 first:pt-0"
            >
              <p
                className="text-[8.5px] font-bold tracking-[0.1em] uppercase"
                style={{ color: company.colorHex }}
              >
                {[
                  post.date ? `${formatShort(post.date)} · ${dayLabel(post.date)}` : "Unscheduled",
                  post.contentType,
                  post.platforms.join(", "),
                ]
                  .filter(Boolean)
                  .join("   |   ")}
              </p>

              <h3
                className="mt-1.5 text-[15px] font-semibold"
                dir={isRTL(post.title) ? "rtl" : "ltr"}
              >
                {post.title || "Untitled"}
              </h3>

              <p className="mt-1 text-[9px] text-[#6b7280]">
                Design: {post.designStatus} &nbsp;&nbsp; Approval: {post.approval}
                &nbsp;&nbsp; Published: {post.published}
              </p>

              {post.content && (
                <p
                  className="mt-2.5 text-[11px] leading-[1.75] whitespace-pre-wrap"
                  dir={isRTL(post.content) ? "rtl" : "ltr"}
                >
                  {post.content}
                </p>
              )}

              {post.notes && (
                <p
                  className="mt-2.5 border-l-2 border-[#f0a500] pl-2.5 text-[10px] leading-relaxed text-[#555]"
                  dir={isRTL(post.notes) ? "rtl" : "ltr"}
                >
                  <strong className="text-[#b57500]">Notes </strong>
                  {post.notes}
                </p>
              )}

              {post.ideas && (
                <p className="mt-1.5 text-[10px] text-[#2451eb]">
                  <strong>Ideas </strong>
                  {post.ideas}
                </p>
              )}

              {post.driveLink && (
                <p className="mt-1.5 text-[9px] break-all text-[#0563c1]">
                  {post.driveLink}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-10 border-t border-[#eee] pt-3 text-[9px] text-[#999]">
        {company.name} · {board.name} · Problem-X Social ·{" "}
        {formatShort(new Date().toISOString().slice(0, 10))}
      </footer>
    </div>
  );
}
