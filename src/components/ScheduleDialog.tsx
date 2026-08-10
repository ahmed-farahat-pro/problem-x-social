"use client";

import { useState } from "react";
import { CalendarClock, Repeat } from "lucide-react";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/utils";
import { Button, Checkbox, Input, Label, Modal } from "./ui";

type Mode = "spread" | "repeat";

export default function ScheduleDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { selected, visiblePosts, reschedule, duplicatePosts } = useStore();
  const [mode, setMode] = useState<Mode>("spread");
  const [start, setStart] = useState(todayISO());
  const [step, setStep] = useState(1);
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [offset, setOffset] = useState(7);
  const [busy, setBusy] = useState(false);

  // With nothing selected the action applies to everything currently visible.
  const ids = selected.size
    ? visiblePosts.filter((p) => selected.has(p.id)).map((p) => p.id)
    : visiblePosts.map((p) => p.id);

  async function apply() {
    setBusy(true);
    try {
      if (mode === "spread") await reschedule(ids, start, step, skipWeekends);
      else await duplicatePosts(ids, offset);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk scheduling"
      description={`${ids.length} post${ids.length === 1 ? "" : "s"} ${
        selected.size ? "selected" : "in view"
      }`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={apply}
            disabled={busy || ids.length === 0}
          >
            {busy ? "Working…" : "Apply"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={mode === "spread"}
            onClick={() => setMode("spread")}
            icon={<CalendarClock className="size-4" />}
            title="Spread dates"
            body="Re-date the posts across a cadence."
          />
          <ModeCard
            active={mode === "repeat"}
            onClick={() => setMode("repeat")}
            icon={<Repeat className="size-4" />}
            title="Repeat forward"
            body="Copy them forward with statuses reset."
          />
        </div>

        {mode === "spread" ? (
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <Label>Start on</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <Label>Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={step}
                  onChange={(e) => setStep(Math.max(1, Number(e.target.value)))}
                  className="w-24"
                />
                <span className="text-muted text-sm">
                  day{step === 1 ? "" : "s"}
                </span>
              </div>
            </label>
            <Checkbox
              checked={skipWeekends}
              onChange={setSkipWeekends}
              label="Skip weekends"
            />
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <Label>Shift copies by</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={offset}
                  onChange={(e) => setOffset(Math.max(1, Number(e.target.value)))}
                  className="w-24"
                />
                <span className="text-muted text-sm">days</span>
              </div>
            </label>
            <p className="text-muted text-xs leading-relaxed">
              Each post is copied forward with design, approval and publish
              status reset — the fastest way to plan next week from this week.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-xl border border-brand-500 bg-brand-500/12 p-3 text-left transition-colors focus-ring"
          : "rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3 text-left transition-colors hover:border-[var(--line-strong)] focus-ring"
      }
    >
      <span
        className={
          active
            ? "text-brand-400 inline-flex items-center gap-2 text-sm font-semibold"
            : "inline-flex items-center gap-2 text-sm font-semibold"
        }
      >
        {icon}
        {title}
      </span>
      <span className="text-muted mt-1 block text-xs leading-relaxed">{body}</span>
    </button>
  );
}
