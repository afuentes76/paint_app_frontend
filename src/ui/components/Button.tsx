import React from "react";
import { cn, theme } from "@/ui/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = cn(
    "inline-flex items-center justify-center gap-2",
    // Global button sizing (requested)
    "h-12 px-5 text-sm font-semibold",
    "select-none whitespace-nowrap",
    theme.radius.md,
    theme.focus.base,
    theme.focus.ring,
    "transition",
    "active:translate-y-[0.5px]",
    disabled && "opacity-50 cursor-not-allowed pointer-events-none"
  );

  const variants: Record<ButtonVariant, string> = {
    primary: cn(
      theme.color.primaryBg,
      theme.color.primaryText,
      "shadow-sm",
      "hover:brightness-110",
      "active:brightness-95"
    ),
    secondary: cn(
      "border",
      theme.color.border,
      theme.color.surface2,
      theme.color.text,
      "hover:bg-[var(--color-surface)]",
      "active:bg-[var(--color-surface-2)]"
    ),
    ghost: cn(
      theme.color.text,
      "bg-transparent",
      "hover:bg-[var(--color-surface-2)]",
      "active:bg-[var(--color-surface)]"
    ),
  };

  return (
    <button
      className={cn(base, variants[variant], className)}
      disabled={disabled}
      {...props}
    />
  );
}
