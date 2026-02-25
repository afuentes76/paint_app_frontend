import React from "react";
import { cn, theme } from "@/ui/theme";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, disabled, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full px-3 text-sm",
        "transition",
        "border",
        theme.color.border,
        theme.color.surface,
        theme.color.text,
        theme.radius.md,
        theme.focus.base,
        theme.focus.ring,

        // nicer placeholder
        "placeholder:text-[var(--color-muted-text)]",

        // hover / focus feel
        "hover:border-[var(--color-ring)]",

        // disabled feel
        disabled && "opacity-60 cursor-not-allowed",

        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
