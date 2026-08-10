"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CircleAlert,
  CloudUpload,
  FileSpreadsheet,
  Rows3,
  Upload,
} from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  Pill,
  SectionLabel,
  Spinner,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import type { PostInput } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".xlsx,.csv,.tsv,.json";

type Destination = "newCompany" | "existingCompany" | "currentBoard";

interface PreviewSheet {
  name: string;
  posts: PostInput[];
}

interface Preview {
  fileName: string;
  sheets: PreviewSheet[];
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Imported";
}

function summarise(posts: PostInput[]) {
  return {
    dated: posts.filter((p) => Boolean(p.date)).length,
    live: posts.filter((p) => p.published === "Published").length,
  };
}

export default function ImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { workspace, company, board, boardId, refresh, notify } = useStore();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [destination, setDestination] = useState<Destination>("newCompany");
  const [companyName, setCompanyName] = useState("");
  const [targetCompanyId, setTargetCompanyId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPreview(null);
    setIncluded(new Set());
    setDestination("newCompany");
    setCompanyName("");
    setTargetCompanyId(company?.id ?? workspace.companies[0]?.id ?? null);
    setDragging(false);
    setPhase("idle");
    setError(null);
  }, [company, workspace]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) reset();
    wasOpen.current = open;
  }, [open, reset]);

  const chosenSheets = useMemo(
    () => (preview?.sheets ?? []).filter((_, i) => included.has(i)),
    [preview, included],
  );
  const totalRows = chosenSheets.reduce((sum, s) => sum + s.posts.length, 0);
  const busy = phase !== "idle";

  // ---------------------------------------------------------------- step 1

  const readFile = useCallback(async (file: File) => {
    setError(null);
    setPhase("reading");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/import", { method: "PUT", body });
      const payload = (await response.json().catch(() => ({}))) as Partial<Preview> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Could not read that file (${response.status})`);
      }
      const sheets = payload.sheets ?? [];
      setPreview({ fileName: payload.fileName ?? file.name, sheets });
      setIncluded(new Set(sheets.map((_, i) => i)));
      setCompanyName(baseName(payload.fileName ?? file.name));
    } catch (e) {
      setPreview(null);
      setIncluded(new Set());
      setError((e as Error).message);
    } finally {
      setPhase("idle");
    }
  }, []);

  // ---------------------------------------------------------------- step 2

  async function commit() {
    if (!chosenSheets.length) return;
    setError(null);
    setPhase("saving");
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          companyName: destination === "newCompany" ? companyName.trim() : undefined,
          companyId: destination === "existingCompany" ? targetCompanyId : undefined,
          boardId: destination === "currentBoard" ? boardId : undefined,
          sheets: chosenSheets,
        }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `Import failed (${response.status})`);
      }
      await refresh();
      notify(
        `Imported ${totalRows} row${totalRows === 1 ? "" : "s"} from ${chosenSheets.length} sheet${chosenSheets.length === 1 ? "" : "s"}`,
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase("idle");
    }
  }

  // ---------------------------------------------------------------- dnd

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  const destinationOptions: { value: Destination; label: string }[] = [
    { value: "newCompany", label: "Create a new company" },
  ];
  if (workspace.companies.length) {
    destinationOptions.push({
      value: "existingCompany",
      label: "Add sheets to an existing company",
    });
  }
  if (board) {
    destinationOptions.push({
      value: "currentBoard",
      label: `Append rows to “${board.name}”`,
    });
  }

  const targetCompany =
    workspace.companies.find((c) => c.id === targetCompanyId) ?? null;

  const canCommit =
    chosenSheets.length > 0 &&
    (destination !== "existingCompany" || Boolean(targetCompanyId)) &&
    (destination !== "currentBoard" || Boolean(boardId));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import"
      description="Drop an Excel, CSV or JSON plan and map it onto a company."
      size="lg"
      footer={
        <>
          {preview && (
            <span className="text-dim mr-auto text-xs">
              {totalRows} row{totalRows === 1 ? "" : "s"} ready
            </span>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void commit()}
            disabled={busy || !canCommit}
          >
            {phase === "saving" ? <Spinner /> : <Upload className="size-4" />}
            Import{totalRows ? ` ${totalRows} row${totalRows === 1 ? "" : "s"}` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            // Children re-fire dragleave; only drop the highlight when truly outside.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragging(false);
            }
          }}
          onDrop={onDrop}
          disabled={busy}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center transition-colors focus-ring",
            "disabled:pointer-events-none disabled:opacity-60",
            dragging
              ? "border-brand-400 bg-brand-500/10"
              : "border-[var(--line-strong)] bg-[var(--surface-raised)] hover:border-brand-500/60 hover:bg-[var(--surface-hover)]",
          )}
        >
          <span
            className={cn(
              "grid size-10 place-items-center rounded-xl transition-colors",
              dragging ? "bg-brand-500 text-white" : "bg-[var(--surface-hover)] text-brand-400",
            )}
          >
            {phase === "reading" ? <Spinner /> : <CloudUpload className="size-5" />}
          </span>
          <span className="text-sm font-medium">
            {phase === "reading"
              ? "Reading the file…"
              : preview
                ? preview.fileName
                : dragging
                  ? "Drop it here"
                  : "Drop a file, or click to browse"}
          </span>
          <span className="text-muted text-[11px]">
            .xlsx, .csv, .tsv or .json — nothing is saved until you confirm.
          </span>
        </button>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs leading-relaxed text-rose-400"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {preview && (
          <>
            <div className="flex flex-col gap-2">
              <SectionLabel hint={`${preview.sheets.length} detected`}>
                Sheets found
              </SectionLabel>
              <ul className="flex flex-col gap-1.5">
                {preview.sheets.map((sheet, index) => {
                  const { dated, live } = summarise(sheet.posts);
                  const on = included.has(index);
                  return (
                    <li
                      key={`${sheet.name}-${index}`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                        on
                          ? "border-brand-500/40 bg-brand-500/[0.07]"
                          : "border-[var(--line)] bg-[var(--surface-raised)]",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onChange={(next) =>
                          setIncluded((prev) => {
                            const copy = new Set(prev);
                            if (next) copy.add(index);
                            else copy.delete(index);
                            return copy;
                          })
                        }
                        label={
                          <span className="flex items-center gap-2">
                            <FileSpreadsheet className="text-dim size-3.5 shrink-0" />
                            <span className="font-medium break-words">{sheet.name}</span>
                          </span>
                        }
                        className="min-w-0 flex-1"
                      />
                      <span className="flex shrink-0 items-center gap-1.5">
                        {dated > 0 && <Pill>{dated} dated</Pill>}
                        {live > 0 && <Pill>{live} live</Pill>}
                        <span className="text-dim tabular flex items-center gap-1 text-xs">
                          <Rows3 className="size-3.5" />
                          {sheet.posts.length}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Import destination</legend>
              <SectionLabel>Destination</SectionLabel>
              <div className="flex flex-col gap-1">
                {destinationOptions.map((o) => (
                  <div key={o.value} className="flex flex-col gap-2">
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-400",
                        destination === o.value
                          ? "bg-[var(--surface-hover)]"
                          : "hover:bg-[var(--surface-hover)]",
                      )}
                    >
                      <input
                        type="radio"
                        name="import-destination"
                        value={o.value}
                        checked={destination === o.value}
                        onChange={() => setDestination(o.value)}
                        className={cn(
                          "size-4 shrink-0 appearance-none rounded-full border border-[var(--line-strong)]",
                          "bg-[var(--surface-raised)] transition-colors",
                          "checked:border-brand-500 checked:bg-brand-500",
                          "checked:shadow-[inset_0_0_0_3px_var(--surface-raised)]",
                        )}
                      />
                      <span className="flex-1 text-sm">{o.label}</span>
                    </label>

                    {o.value === "newCompany" && destination === "newCompany" && (
                      <div className="pl-9">
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder={baseName(preview.fileName)}
                          aria-label="New company name"
                        />
                      </div>
                    )}

                    {o.value === "existingCompany" && destination === "existingCompany" && (
                      <div className="pl-9">
                        <Menu
                          className="w-full max-w-xs"
                          trigger={
                            <MenuTrigger muted={!targetCompany}>
                              <span className="flex items-center gap-1.5">
                                <Building2 className="size-3.5 shrink-0" />
                                {targetCompany?.name ?? "Choose a company"}
                              </span>
                            </MenuTrigger>
                          }
                        >
                          {workspace.companies.map((c) => (
                            <MenuItem
                              key={c.id}
                              icon={<Building2 className="size-3.5" />}
                              selected={c.id === targetCompanyId}
                              onClick={() => setTargetCompanyId(c.id)}
                            >
                              {c.name}
                            </MenuItem>
                          ))}
                        </Menu>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </div>
    </Modal>
  );
}
