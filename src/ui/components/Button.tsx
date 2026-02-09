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
    "h-10 px-4 text-sm font-medium",
    theme.radius.md,
    theme.focus.base,
    theme.focus.ring,
    "transition",
    disabled && "opacity-50 cursor-not-allowed"
  );

  const variants: Record<ButtonVariant, string> = {
    primary: cn(
      theme.color.primaryBg,
      theme.color.primaryText,
      "hover:opacity-90"
    ),
    secondary: cn(
      "border",
      theme.color.border,
      theme.color.surface2,
      theme.color.text,
      "hover:opacity-90"
    ),
    ghost: cn(theme.color.text, "hover:opacity-80"),
  };

  return <button className={cn(base, variants[variant], className)} disabled={disabled} {...props} />;
}
