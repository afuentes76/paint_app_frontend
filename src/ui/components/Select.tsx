import { cn, theme } from "@/ui/theme";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full px-3 text-sm",
        "border",
        theme.color.border,
        theme.color.surface,
        theme.color.text,
        theme.radius.md,
        theme.focus.base,
        theme.focus.ring,
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
