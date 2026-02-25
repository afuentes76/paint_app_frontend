import { cn, theme } from "@/ui/theme";

type ErrorBannerProps = {
  title?: string;
  message: string;
  details?: string | null;
  className?: string;
};

export function ErrorBanner({
  title = "Something went wrong",
  message,
  details,
  className,
}: ErrorBannerProps) {
  const hasDetails = !!(details && String(details).trim());
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

      {hasDetails && (
        <details className="mt-2">
          <summary className={cn("cursor-pointer text-xs", theme.color.mutedText)}>
            Details
          </summary>
          <pre className={cn("mt-2 whitespace-pre-wrap break-words text-xs", theme.color.mutedText)}>
            {String(details)}
          </pre>
        </details>
      )}
    </div>
  );
}