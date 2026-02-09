import { cn, theme } from "@/ui/theme";

type ErrorBannerProps = {
  title?: string;
  message: string;
  className?: string;
};

export function ErrorBanner({
  title = "Something went wrong",
  message,
  className,
}: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "border p-3",
        theme.color.border,
        theme.color.surface2,
        theme.radius.lg,
        className
      )}
      role="alert"
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className={cn("mt-1 text-sm", theme.color.mutedText)}>{message}</div>
    </div>
  );
}
