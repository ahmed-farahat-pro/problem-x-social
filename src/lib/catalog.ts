import type {
  ApprovalStatus,
  DesignStatus,
  PublishStatus,
} from "./types";

export const CONTENT_TYPES = [
  "Static Post",
  "Carousel Post",
  "Reel",
  "Story",
  "Video",
  "Teaser",
  "Series",
  "Live",
  "Poll",
  "UGC",
  "Ad Creative",
];

export const PLATFORMS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "LinkedIn",
  "X",
  "YouTube",
  "Threads",
  "Snapchat",
  "Pinterest",
];

/** Caption limits used by the live counter in the editor. */
export const CAPTION_LIMITS: Record<string, number> = {
  Instagram: 2200,
  Facebook: 63206,
  TikTok: 2200,
  LinkedIn: 3000,
  X: 280,
  YouTube: 5000,
  Threads: 500,
  Snapchat: 250,
  Pinterest: 500,
};

/** Spellings seen in real trackers, normalised on import. */
const TYPE_ALIASES: Record<string, string> = {
  "caroucel post": "Carousel Post",
  "carousel post": "Carousel Post",
  caroucel: "Carousel Post",
  carousel: "Carousel Post",
  "static post": "Static Post",
  static: "Static Post",
  reel: "Reel",
  reels: "Reel",
  story: "Story",
  stories: "Story",
  video: "Video",
  teaser: "Teaser",
  series: "Series",
};

export function normaliseContentType(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  return TYPE_ALIASES[key] ?? raw.trim();
}

export function parsePlatforms(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.toLowerCase() === "all") {
    return ["Instagram", "Facebook", "TikTok"];
  }
  return trimmed
    .split(/[,/&+|]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (part) =>
        PLATFORMS.find((p) => p.toLowerCase() === part.toLowerCase()) ?? part,
    );
}

export function parseDesignStatus(raw: string): DesignStatus {
  const k = raw.trim().toLowerCase();
  if (k.includes("drive") || k.includes("upload")) return "Uploaded to Drive";
  if (k.includes("ready") || k.includes("done")) return "Design Ready";
  if (k.includes("progress") || k.includes("wip")) return "In Progress";
  return "Not Started";
}

export function parseApproval(raw: string): ApprovalStatus {
  const k = raw.trim().toLowerCase();
  if (k.includes("approv")) return "Approved";
  if (k.includes("revis") || k.includes("reject") || k.includes("change"))
    return "Needs Revision";
  return "Pending";
}

export function parsePublish(raw: string): PublishStatus {
  const k = raw.trim().toLowerCase();
  if (k.includes("publish") || k.includes("live") || k.includes("posted"))
    return "Published";
  if (k.includes("sched")) return "Scheduled";
  return "Not Yet";
}

// ------------------------------------------------------------------- palettes

export const COMPANY_PALETTE = [
  "#7C5CFF",
  "#FF4D8D",
  "#22C55E",
  "#F59E0B",
  "#38BDF8",
  "#F43F5E",
  "#14B8A6",
  "#A855F7",
];

export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  tiktok: "#00C4CC",
  linkedin: "#0A66C2",
  x: "#8B93A1",
  youtube: "#FF0000",
  threads: "#9CA3AF",
  snapchat: "#D9A400",
  pinterest: "#BD081C",
};

export function platformColor(name: string): string {
  return PLATFORM_COLORS[name.toLowerCase()] ?? "#8A94A6";
}

type Tone = { fg: string; bg: string; border: string; dot: string };

export const DESIGN_TONE: Record<DesignStatus, Tone> = {
  "Not Started": {
    fg: "text-slate-400",
    bg: "bg-slate-500/12",
    border: "border-slate-500/25",
    dot: "#8A94A6",
  },
  "In Progress": {
    fg: "text-amber-400",
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    dot: "#F59E0B",
  },
  "Design Ready": {
    fg: "text-sky-400",
    bg: "bg-sky-500/12",
    border: "border-sky-500/25",
    dot: "#38BDF8",
  },
  "Uploaded to Drive": {
    fg: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/25",
    dot: "#22C55E",
  },
};

export const APPROVAL_TONE: Record<ApprovalStatus, Tone> = {
  Pending: {
    fg: "text-amber-400",
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    dot: "#F59E0B",
  },
  Approved: {
    fg: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/25",
    dot: "#22C55E",
  },
  "Needs Revision": {
    fg: "text-rose-400",
    bg: "bg-rose-500/12",
    border: "border-rose-500/25",
    dot: "#F43F5E",
  },
};

export const PUBLISH_TONE: Record<PublishStatus, Tone> = {
  "Not Yet": {
    fg: "text-slate-400",
    bg: "bg-slate-500/12",
    border: "border-slate-500/25",
    dot: "#8A94A6",
  },
  Scheduled: {
    fg: "text-violet-400",
    bg: "bg-violet-500/12",
    border: "border-violet-500/25",
    dot: "#7C5CFF",
  },
  Published: {
    fg: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/25",
    dot: "#22C55E",
  },
};
