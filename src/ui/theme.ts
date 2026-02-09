// src/ui/theme.ts
// Design tokens + tiny helpers.
// Components must reference these tokens (no hardcoded colors).

export const theme = {
  radius: {
    sm: "rounded-[var(--radius-sm)]",
    md: "rounded-[var(--radius-md)]",
    lg: "rounded-[var(--radius-lg)]",
  },
  shadow: {
    sm: "shadow-[var(--shadow-sm)]",
    md: "shadow-[var(--shadow-md)]",
  },
  container: {
    max: "max-w-[var(--container-max)]",
  },
  color: {
    background: "bg-[var(--color-background)]",
    surface: "bg-[var(--color-surface)]",
    surface2: "bg-[var(--color-surface-2)]",
    border: "border-[var(--color-border)]",
    text: "text-[var(--color-text)]",
    mutedText: "text-[var(--color-muted-text)]",
    primaryBg: "bg-[var(--color-primary)]",
    primaryText: "text-[var(--color-background)]",
    ring: "ring-[var(--color-ring)]",
  },
  focus: {
    base: "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
    ring: "focus-visible:ring-[var(--color-ring)]",
  },
} as const;

type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [k: string]: boolean };

// Minimal className combiner (no extra deps).
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  const push = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(push);
      return;
    }
    if (typeof v === "object") {
      for (const [k, on] of Object.entries(v)) {
        if (on) out.push(k);
      }
    }
  };

  values.forEach(push);
  return out.join(" ");
}
