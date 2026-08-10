"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { Button, Input, Modal, SectionLabel, Spinner } from "@/components/ui";
import { useStore } from "@/lib/store";
import { cn, downloadBlob, sanitiseFileName } from "@/lib/utils";

/** `pdf` never reaches the API — it opens the print route instead. */
type ExportFormat = "xlsx" | "csv" | "md" | "json" | "pdf";
type ExportScope = "board" | "selection" | "company" | "workspace";

const FORMATS: {
  value: ExportFormat;
  name: string;
  icon: LucideIcon;
  description: string;
  extension?: string;
  wide?: boolean;
}[] = [
  {
    value: "xlsx",
    name: "Excel (.xlsx)",
    icon: FileSpreadsheet,
    description: "Styled workbook with frozen headers, filters and live dropdowns.",
    extension: "xlsx",
  },
  {
    value: "csv",
    name: "CSV",
    icon: Table2,
    description: "Plain data with a UTF-8 BOM so Excel reads Arabic correctly.",
    extension: "csv",
  },
  {
    value: "md",
    name: "Markdown",
    icon: FileText,
    description: "Readable plain text for Notion, docs or chat.",
    extension: "md",
  },
  {
    value: "json",
    name: "JSON",
    icon: Braces,
    description: "Structured backup you can re-import later.",
    extension: "json",
  },
  {
    value: "pdf",
    name: "PDF report",
    icon: Printer,
    description: "Print-ready report — opens the print view, then Save as PDF.",
    wide: true,
  },
];

/** Pull the server's own filename out of Content-Disposition when it sent one. */
function filenameFromResponse(header: string | null, fallback: string): string {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return fallback;
  }
}

export default function ExportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { workspace, company, board, companyId, boardId, selected, notify } = useStore();

  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [rawScope, setScope] = useState<ExportScope>("board");
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const boardCount = board?.posts.length ?? 0;
    const companyCount =
      company?.boards.reduce((sum, b) => sum + b.posts.length, 0) ?? 0;
    const workspaceCount = workspace.companies.reduce(
      (sum, c) => sum + c.boards.reduce((n, b) => n + b.posts.length, 0),
      0,
    );
    return {
      board: boardCount,
      selection: selected.size,
      company: companyCount,
      workspace: workspaceCount,
    };
  }, [board, company, workspace, selected]);

  const defaultName = useMemo(() => {
    if (company && board) return `${company.name} — ${board.name}`;
    if (company) return company.name;
    return "Problem-X workspace";
  }, [company, board]);

  // Re-derive the defaults on each open — but never mid-session, so edits stick.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setFormat("xlsx");
      setScope(
        selected.size > 0
          ? "selection"
          : board
            ? "board"
            : company
              ? "company"
              : "workspace",
      );
      setFilename(defaultName);
      setBusy(false);
    }
    wasOpen.current = open;
  }, [open, selected, board, company, defaultName]);

  const scopeOptions = useMemo(() => {
    const list: { value: ExportScope; label: string; count: number }[] = [];
    if (board) list.push({ value: "board", label: "This sheet", count: counts.board });
    if (selected.size > 0)
      list.push({ value: "selection", label: "Selected only", count: counts.selection });
    if (company)
      list.push({ value: "company", label: "This company", count: counts.company });
    list.push({ value: "workspace", label: "Entire workspace", count: counts.workspace });
    return list;
  }, [board, company, selected, counts]);

  const activeFormat = FORMATS.find((f) => f.value === format);
  const isPrint = format === "pdf";
  // The chosen scope can stop being offered (e.g. the selection was cleared).
  const scope = scopeOptions.some((o) => o.value === rawScope)
    ? rawScope
    : (scopeOptions[0]?.value ?? "workspace");
  const rows = isPrint ? counts.board : counts[scope];
  const canConfirm = isPrint ? Boolean(boardId) : rows > 0;

  async function confirm() {
    if (isPrint) {
      if (!boardId) return;
      // The print route shapes Arabic correctly via the browser's own renderer.
      window.open(`/print/${boardId}`, "_blank", "noopener,noreferrer");
      onClose();
      return;
    }

    const base = sanitiseFileName(filename.trim() || defaultName);
    setBusy(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          scope,
          boardId: boardId ?? undefined,
          companyId: companyId ?? undefined,
          postIds: scope === "selection" ? [...selected] : undefined,
          filename: base,
        }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      downloadBlob(
        blob,
        filenameFromResponse(
          response.headers.get("Content-Disposition"),
          `${base}.${activeFormat?.extension ?? "txt"}`,
        ),
      );
      notify(`Exported ${rows} row${rows === 1 ? "" : "s"}`);
      onClose();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export"
      description="Hand the plan to a client, a designer or your own archive."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void confirm()} disabled={busy || !canConfirm}>
            {busy ? <Spinner /> : isPrint ? <Printer className="size-4" /> : <Download className="size-4" />}
            {isPrint
              ? "Open print view"
              : `Export ${rows} row${rows === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Export format</legend>
          <SectionLabel>Format</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const active = format === f.value;
              return (
                <label
                  key={f.value}
                  className={cn(
                    "group relative flex cursor-pointer gap-2.5 rounded-xl border p-3 transition-colors",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-400",
                    active
                      ? "border-brand-500/60 bg-brand-500/10"
                      : "border-[var(--line)] bg-[var(--surface-raised)] hover:border-[var(--line-strong)]",
                    f.wide && "sm:col-span-2",
                  )}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={f.value}
                    checked={active}
                    onChange={() => setFormat(f.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                      active
                        ? "bg-brand-500 text-white"
                        : "bg-[var(--surface-hover)] text-muted",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{f.name}</span>
                    <span className="text-muted mt-0.5 block text-[11px] leading-snug">
                      {f.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {isPrint ? (
          <p className="text-muted rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3 text-xs leading-relaxed">
            {board
              ? `“${board.name}” opens in a new tab and the print dialog appears on its own — choose “Save as PDF” as the destination.`
              : "Pick a sheet first — the print report is built one sheet at a time."}
          </p>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Rows to include</legend>
              <SectionLabel>Include</SectionLabel>
              <div className="flex flex-col gap-1">
                {scopeOptions.map((o) => (
                  <label
                    key={o.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-400",
                      scope === o.value
                        ? "bg-[var(--surface-hover)]"
                        : "hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="export-scope"
                      value={o.value}
                      checked={scope === o.value}
                      onChange={() => setScope(o.value)}
                      className={cn(
                        "size-4 shrink-0 appearance-none rounded-full border border-[var(--line-strong)]",
                        "bg-[var(--surface-raised)] transition-colors",
                        // Inset ring carves the classic dot out of the filled circle.
                        "checked:border-brand-500 checked:bg-brand-500",
                        "checked:shadow-[inset_0_0_0_3px_var(--surface-raised)]",
                      )}
                    />
                    <span className="flex-1 text-sm">{o.label}</span>
                    <span className="text-dim tabular text-xs">{o.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <SectionLabel
                hint={activeFormat?.extension ? `.${activeFormat.extension}` : undefined}
              >
                File name
              </SectionLabel>
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={defaultName}
                aria-label="File name"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
