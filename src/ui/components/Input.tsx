import { cn, theme } from "@/ui/theme";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full px-3 text-sm",
        "border",
        theme.color.border,
        theme.color.surface,
        theme.color.text,
        theme.radius.md,
        theme.focus.base,
        theme.focus.ring,
        "placeholder:opacity-60",
        className
      )}
      {...props}
    />
  );
}
