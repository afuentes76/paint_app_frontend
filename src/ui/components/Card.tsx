import { cn, theme } from "@/ui/theme";

type CardProps = {
  className?: string;
  children: React.ReactNode;
};

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "border",
        theme.color.border,
        theme.color.surface,
        theme.radius.lg,
        theme.shadow.sm,
        "p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function CardHeader({ title, subtitle, right }: CardHeaderProps) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle ? (
          <div className={cn("mt-0.5 text-xs", theme.color.mutedText)}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}
