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

  // ✅ BASELINE KEY (AppShell uses theme.container.max)
  container: {
    max: "max-w-[var(--container-max)]",
  },

  // ✅ Optional alias (safe): if any file uses theme.layout.max it won't crash
  layout: {
    max: "max-w-[var(--container-max)]",
  },

  color: {
    background: "bg-[var(--color-background)]",
    surface: "bg-[var(--color-surface)]",
    surface2: "bg-[var(--color-surface-2)]",

    border: "border-[var(--color-border)]",

    text: "text-[var(--color-text)]",
    // ✅ keep baseline name
    mutedText: "text-[var(--color-muted-text)]",

    primaryBg: "bg-[var(--color-primary)]",
    primaryText: "text-[var(--color-background)]",

    ring: "ring-[var(--color-ring)]",

    // ✅ extra semantic helpers (additive; won’t break anything)
    successBg: "bg-[var(--color-success)]",
    warningBg: "bg-[var(--color-warning)]",
    dangerBg: "bg-[var(--color-danger)]",
    primaryTextColor: "text-[var(--color-primary)]",
  },

  focus: {
    // baseline
    base: "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
    ring: "focus-visible:ring-[var(--color-ring)]",
  },

  // ✅ extra presets (optional, additive)
  button: {
    base: "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
    primary:
      "bg-[var(--color-primary)] text-white hover:brightness-110 active:brightness-95",
    secondary:
      "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]",
    danger:
      "bg-[var(--color-danger)] text-white hover:brightness-110 active:brightness-95",
  },

  input: {
    base: "w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] placeholder:text-[var(--color-muted-text)] transition",
  },

  card: {
    base: "bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]",
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
