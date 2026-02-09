import { cn, theme } from "@/ui/theme";

type LoadingProps = {
  label?: string;
  className?: string;
};

export function Loading({ label = "Loading…", className }: LoadingProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "h-5 w-5 animate-spin rounded-full border-2 border-t-transparent",
          theme.color.border
        )}
        aria-hidden="true"
      />
      <div className={cn("text-sm", theme.color.mutedText)}>{label}</div>
    </div>
  );
}
