import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------- text / bidi

/**
 * True when the first strongly-directional character is RTL.
 * The team writes Egyptian Arabic with Latin product names mixed in, so
 * sniffing the first strong character beats counting characters.
 */
export function isRTL(text: string): boolean {
  for (const ch of text) {
    const v = ch.codePointAt(0)!;
    if (
      (v >= 0x0590 && v <= 0x08ff) ||
      (v >= 0xfb1d && v <= 0xfdff) ||
      (v >= 0xfe70 && v <= 0xfeff)
    ) {
      return true;
    }
    if ((v >= 0x41 && v <= 0x5a) || (v >= 0x61 && v <= 0x7a)) return false;
  }
  return false;
}

export function dirOf(text: string): "rtl" | "ltr" {
  return isRTL(text) ? "rtl" : "ltr";
}

export function firstLine(text: string): string {
  return text.split("\n").find((l) => l.trim())?.trim() ?? "";
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// -------------------------------------------------------------------- dates

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parses a yyyy-mm-dd string as a *local* date, avoiding UTC day-shift. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatShort(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatCompact(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dayLabel(iso: string | null): string {
  if (!iso) return "";
  return DAYS[parseISODate(iso).getDay()];
}

export function isWeekend(iso: string | null): boolean {
  if (!iso) return false;
  const day = parseISODate(iso).getDay();
  return day === 0 || day === 6;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function isOverdue(iso: string | null, published: string): boolean {
  if (!iso) return false;
  return iso < todayISO() && published !== "Published";
}

/** Monday-anchored week start, used for cadence charts. */
export function weekStart(iso: string): string {
  const d = parseISODate(iso);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

// ------------------------------------------------------------------- misc

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const s = parts.map((p) => p[0] ?? "").join("");
  return (s || "?").toUpperCase();
}

export function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function sanitiseFileName(raw: string): string {
  const s = raw.replace(/[/\\:?%*|"<>]/g, "-").trim();
  return s || "export";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
