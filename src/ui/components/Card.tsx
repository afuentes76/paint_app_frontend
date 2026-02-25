import React from "react";
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
        "p-4 md:p-5", // a little nicer on desktop
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
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold leading-5 text-[var(--color-text)]">
          {title}
        </div>

        {subtitle ? (
          <div className={cn("mt-1 text-xs leading-4", theme.color.mutedText)}>
            {subtitle}
          </div>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
