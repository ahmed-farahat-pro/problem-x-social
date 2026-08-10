"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import {
  APPROVAL_TONE,
  DESIGN_TONE,
  PUBLISH_TONE,
  platformColor,
} from "@/lib/catalog";
import type {
  ApprovalStatus,
  DesignStatus,
  PublishStatus,
} from "@/lib/types";
import { cn, initials, isRTL } from "@/lib/utils";

// -------------------------------------------------------------------- button

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-400 active:bg-brand-600 shadow-sm shadow-brand-500/25",
  secondary:
    "bg-[var(--surface-hover)] text-body hover:bg-[var(--surface-overlay)] border border-[var(--line)]",
  ghost: "text-muted hover:text-body hover:bg-[var(--surface-hover)]",
  danger: "bg-rose-500/12 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25",
  subtle: "text-muted hover:text-body",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-8 w-8 justify-center",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg font-medium transition-colors focus-ring",
        "disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------- pill

export function Pill({
  children,
  tone,
  className,
  dot,
}: {
  children: ReactNode;
  tone?: { fg: string; bg: string; border: string };
  className?: string;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone?.fg,
        tone?.bg,
        tone?.border,
        !tone && "border-[var(--line)] bg-[var(--surface-hover)] text-muted",
        className,
      )}
    >
      {dot && (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: dot }}
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function DesignPill({ value }: { value: DesignStatus }) {
  const tone = DESIGN_TONE[value];
  return <Pill tone={tone} dot={tone.dot}>{value}</Pill>;
}

export function ApprovalPill({ value }: { value: ApprovalStatus }) {
  const tone = APPROVAL_TONE[value];
  return <Pill tone={tone} dot={tone.dot}>{value}</Pill>;
}

export function PublishPill({ value }: { value: PublishStatus }) {
  const tone = PUBLISH_TONE[value];
  return <Pill tone={tone} dot={tone.dot}>{value}</Pill>;
}

export function PlatformChip({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  const color = platformColor(name);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
      )}
      style={{ color, background: `${color}1f` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

export function PlatformStrip({
  platforms,
  max = 3,
}: {
  platforms: string[];
  max?: number;
}) {
  if (!platforms.length) return <span className="text-dim text-xs">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {platforms.slice(0, max).map((p) => (
        <PlatformChip key={p} name={p} compact />
      ))}
      {platforms.length > max && (
        <span className="text-dim text-[10px] font-semibold">
          +{platforms.length - max}
        </span>
      )}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 28,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[30%] font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

// -------------------------------------------------------------------- inputs

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 text-sm",
        "placeholder:text-[var(--text-dim)] focus-ring transition-colors",
        "focus:border-brand-500/60",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  autoGrow,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!autoGrow || !ref.current) return;
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow, props.value]);

  const dir = typeof props.value === "string" && isRTL(props.value) ? "rtl" : "ltr";
  return (
    <textarea
      ref={ref}
      dir={dir}
      className={cn(
        "w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-3 text-sm leading-relaxed",
        "placeholder:text-[var(--text-dim)] focus-ring transition-colors focus:border-brand-500/60",
        dir === "rtl" && "rtl-text text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-dim text-[10px] font-bold tracking-[0.09em] uppercase">
      {children}
    </span>
  );
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2", className)}>
      <span className="relative grid place-items-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            "peer size-4 shrink-0 appearance-none rounded border border-[var(--line-strong)]",
            "bg-[var(--surface-raised)] transition-colors focus-ring",
            "checked:border-brand-500 checked:bg-brand-500",
            "indeterminate:border-brand-500 indeterminate:bg-brand-500",
          )}
        />
        <Check
          className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3.5}
        />
      </span>
      {label && <span className="text-sm select-none">{label}</span>}
    </label>
  );
}

// ------------------------------------------------------------------ segmented

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-0.5",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring",
            value === o.value
              ? "bg-brand-500 text-white"
              : "text-muted hover:text-body hover:bg-[var(--surface-hover)]",
          )}
        >
          {o.icon}
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ dropdown

interface MenuCtx {
  close: () => void;
}
const MenuContext = createContext<MenuCtx>({ close: () => {} });

export function Menu({
  trigger,
  children,
  align = "start",
  className,
  panelClassName,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    place();

    const onPointerDown = (e: PointerEvent) => {
      if (
        !anchor.current?.contains(e.target as Node) &&
        !panel.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Keep the panel inside the viewport on small screens.
  const [adjusted, setAdjusted] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!open || !panel.current) return setAdjusted(null);
    const rect = panel.current.getBoundingClientRect();
    let { top, left } = coords;
    if (align === "end") left = coords.left + coords.width - rect.width;
    if (left + rect.width > window.innerWidth - 8)
      left = window.innerWidth - rect.width - 8;
    if (left < 8) left = 8;
    if (top + rect.height > window.innerHeight - 8) {
      const above = coords.top - rect.height - 12;
      top = above > 8 ? above : Math.max(8, window.innerHeight - rect.height - 8);
    }
    setAdjusted({ top, left });
  }, [open, coords, align]);

  return (
    <div ref={anchor} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex w-full items-center focus-ring rounded-lg"
      >
        {trigger}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="menu"
            className={cn(
              "animate-fade-up fixed z-50 min-w-[190px] overflow-hidden rounded-xl border border-[var(--line-strong)]",
              "bg-[var(--surface-overlay)] p-1 shadow-2xl shadow-black/45",
              panelClassName,
            )}
            style={{
              top: adjusted?.top ?? coords.top,
              left: adjusted?.left ?? coords.left,
              maxHeight: "min(70vh, 520px)",
              overflowY: "auto",
              visibility: adjusted ? "visible" : "hidden",
            }}
          >
            <MenuContext.Provider value={{ close: () => setOpen(false) }}>
              {children}
            </MenuContext.Provider>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  selected,
  danger,
  keepOpen,
  icon,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onClick?.();
        if (!keepOpen) close();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        danger
          ? "text-rose-400 hover:bg-rose-500/12"
          : "text-body hover:bg-[var(--surface-hover)]",
      )}
    >
      {icon && <span className="grid size-4 shrink-0 place-items-center">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {selected && <Check className="size-3.5 shrink-0 text-brand-400" strokeWidth={3} />}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-dim px-2.5 pt-2 pb-1 text-[10px] font-bold tracking-[0.08em] uppercase">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-[var(--line)]" />;
}

/** Standard trigger styling for a Menu that looks like a select. */
export function MenuTrigger({
  children,
  className,
  muted,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-full items-center gap-1.5 rounded-lg border border-[var(--line)]",
        "bg-[var(--surface-raised)] px-2.5 text-xs transition-colors hover:border-[var(--line-strong)]",
        muted && "text-muted",
        className,
      )}
    >
      <span className="flex-1 truncate text-left">{children}</span>
      <ChevronDown className="text-dim size-3.5 shrink-0" />
    </span>
  );
}

// --------------------------------------------------------------------- modal

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-fade-up relative flex max-h-[92dvh] w-full flex-col overflow-hidden",
          "rounded-t-2xl border border-[var(--line-strong)] bg-[var(--surface-overlay)] shadow-2xl",
          "sm:rounded-2xl",
          widths[size],
        )}
      >
        <header className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {description && (
              <p className="text-muted mt-0.5 text-xs">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

// -------------------------------------------------------------------- pieces

export function SectionLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Label>{children}</Label>
      {hint && <span className="text-dim text-[11px]">{hint}</span>}
    </div>
  );
}

export function MiniBar({
  value,
  color = "var(--color-brand-500)",
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]",
        className,
      )}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: color,
        }}
      />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-400">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted max-w-sm text-xs leading-relaxed">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/** Bidi-aware read-only text. */
export function BiText({
  text,
  className,
  clamp,
}: {
  text: string;
  className?: string;
  clamp?: number;
}) {
  const rtl = isRTL(text);
  return (
    <span
      dir={rtl ? "rtl" : "ltr"}
      className={cn(
        // line-clamp needs display:-webkit-box, so `block` must not be emitted
        // alongside it — tailwind-merge can't see that conflict on its own.
        clamp && clamp > 1 ? "line-clamp-[var(--clamp)]" : "block",
        rtl && "rtl-text text-right",
        clamp === 1 && "truncate",
        className,
      )}
      style={clamp && clamp > 1 ? ({ "--clamp": clamp } as React.CSSProperties) : undefined}
    >
      {text}
    </span>
  );
}
