import { cn, theme } from "@/ui/theme";

type BadgeVariant = "default" | "muted";

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: cn(theme.color.surface2, theme.color.text, "border", theme.color.border),
    muted: cn(theme.color.surface, theme.color.mutedText, "border", theme.color.border),
  };

  return (
    <span
      className={cn(
        "inline-flex items-center",
        "h-6 px-2 text-xs font-medium",
        theme.radius.md,
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
