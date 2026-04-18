import React from "react";
import { cn } from "../lib/utils";
import Icon from "./Icon";

type Tone = "slate" | "emerald" | "rose" | "amber" | "sky" | "violet";

const badgeToneByVariant: Record<"success" | "warning" | "danger" | "info" | "secondary", Tone> = {
  success: "emerald",
  warning: "amber",
  danger: "rose",
  info: "sky",
  secondary: "slate",
};

function toneValue(tone: Tone) {
  return {
    slate: "var(--ink-3)",
    emerald: "var(--pos)",
    rose: "var(--neg)",
    amber: "var(--warn)",
    sky: "var(--info)",
    violet: "var(--violet)",
  }[tone];
}

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
  padded = true,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  padded?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "overflow-hidden rounded-[20px] bg-[color:var(--bg-2)] hairline",
        padded && "p-4",
        onClick && "cursor-pointer transition active:scale-[0.995]",
        className,
      )}
    >
      {(title || subtitle || action) && (
        <div className={cn("flex items-start justify-between gap-4", padded ? "mb-4" : "px-4 pt-4 pb-3")}>
          <div className="min-w-0">
            {title && <div className="font-display text-[15px] font-semibold text-[color:var(--ink)]">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[11.5px] text-[color:var(--ink-3)]">{subtitle}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Chip({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const color = toneValue(tone);
  const isSlate = tone === "slate";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.08em]", className)}
      style={{
        color: isSlate ? "var(--ink-3)" : color,
        background: isSlate ? "rgba(255,255,255,0.03)" : `color-mix(in oklch, ${color} 12%, transparent)`,
        boxShadow: `inset 0 0 0 1px ${isSlate ? "rgba(255,255,255,0.10)" : `color-mix(in oklch, ${color} 22%, transparent)`}`,
      }}
    >
      {children}
    </span>
  );
}

export function Badge({
  children,
  variant = "info",
  className,
}: {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "secondary";
  className?: string;
}) {
  const tone = badgeToneByVariant[variant];

  return <Chip tone={tone} className={className}>{children}</Chip>;
}

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  block,
  icon,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "soft";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  icon?: React.ReactNode;
}) {
  const variants = {
    primary: "bg-[color:var(--accent)] text-[color:var(--bg)] shadow-[0_6px_20px_-8px_color-mix(in_oklch,var(--accent)_60%,transparent)] hover:brightness-110",
    secondary: "bg-white/[0.05] text-[color:var(--ink)] hairline hover:bg-white/[0.08]",
    soft: "bg-[color:var(--bg-3)] text-[color:var(--ink-2)] hairline hover:bg-white/[0.04]",
    ghost: "bg-transparent text-[color:var(--ink-3)] hover:bg-white/[0.05] hover:text-[color:var(--ink)]",
    danger: "bg-[color:var(--neg)]/90 text-white hover:brightness-110",
  };

  const sizes = {
    sm: "h-8 rounded-[10px] px-3 text-[12px]",
    md: "h-10 rounded-[12px] px-4 text-[13.5px]",
    lg: "h-12 rounded-[14px] px-5 text-[14.5px]",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

function FieldShell({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      {label && <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-4)]">{label}</div>}
      {children}
      {error && <div className="mt-1 text-[11px] text-[color:var(--neg)]">{error}</div>}
    </label>
  );
}

export function Input({
  label,
  error,
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <FieldShell label={label} error={error}>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        className={cn(
          "w-full rounded-[14px] bg-[color:var(--bg-3)] px-3.5 py-[11px] text-[14px] text-[color:var(--ink)] outline-none ring-1 ring-inset ring-white/[0.06] transition placeholder:text-[color:var(--ink-4)] focus:ring-[color:var(--accent)]/55",
          error && "ring-[color:var(--neg)]/50",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  error,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <FieldShell label={label} error={error}>
      <div className="relative">
        <select
          className={cn(
            "w-full appearance-none rounded-[14px] bg-[color:var(--bg-3)] px-3.5 py-[11px] pr-10 text-[14px] text-[color:var(--ink)] outline-none ring-1 ring-inset ring-white/[0.06] transition focus:ring-[color:var(--accent)]/55",
            error && "ring-[color:var(--neg)]/50",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[color:var(--ink-4)]">
          <Icon name="chev-down" size={16} />
        </span>
      </div>
    </FieldShell>
  );
}

export function Sheet({
  open,
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const visible = open ?? isOpen ?? false;
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 fade-in" onClick={onClose} />
      <div
        className={cn(
          "relative w-full max-w-[520px] overflow-hidden rounded-t-[26px] bg-[color:var(--bg-2)] sheet-in hairline-2",
          className,
        )}
        style={{ maxHeight: "90dvh" }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/15" />
        </div>
        <div className="flex items-start justify-between px-5 pt-1 pb-3">
          <div className="min-w-0">
            <div className="truncate font-display text-[18px] font-semibold text-[color:var(--ink)]">{title}</div>
            {subtitle && <div className="mt-0.5 truncate text-[12.5px] text-[color:var(--ink-3)]">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--ink-3)] hover:bg-white/5">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto px-5 pb-4 no-scrollbar">{children}</div>
        {footer && (
          <div className="border-t border-white/[0.06] bg-[color:var(--bg-2)] px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  mobileSheet = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  mobileSheet?: boolean;
}) {
  if (mobileSheet) {
    return (
      <Sheet open={isOpen} onClose={onClose} title={title} className={className}>
        {children}
      </Sheet>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 p-4 fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={cn("relative w-full max-w-2xl rounded-[24px] bg-[color:var(--bg-2)] hairline-2 shadow-2xl", className)}>
        <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="font-display text-[18px] font-semibold text-[color:var(--ink)]">{title}</div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--ink-3)] hover:bg-white/5">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-5 no-scrollbar">{children}</div>
      </div>
    </div>
  );
}

export function Table({
  headers,
  children,
  onSort,
  sortConfig,
}: {
  headers: { label: string; key?: string }[];
  children: React.ReactNode;
  onSort?: (key: string) => void;
  sortConfig?: { key: string; direction: "asc" | "desc" };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {headers.map((header, index) => {
              const active = sortConfig && header.key && sortConfig.key === header.key;
              return (
                <th
                  key={index}
                  className={cn(
                    "px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-4)]",
                    header.key && "cursor-pointer hover:text-[color:var(--ink-2)]",
                  )}
                  onClick={() => header.key && onSort?.(header.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {header.label}
                    {active && <span>{sortConfig.direction === "asc" ? "^" : "v"}</span>}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
      </table>
    </div>
  );
}
