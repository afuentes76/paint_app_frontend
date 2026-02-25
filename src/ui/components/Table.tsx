import { cn, theme } from "@/ui/theme";

type TableProps = {
  className?: string;
  children: React.ReactNode;
};

export function Table({ className, children }: TableProps) {
  return (
    <div className={cn("w-full overflow-x-auto border", theme.color.border, theme.radius.lg)}>
      <table className={cn("w-full text-left text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className={cn(theme.color.surface2, "border-b", theme.color.border)}>
      {children}
    </thead>
  );
}

export function TH({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3 py-2 text-xs font-semibold", theme.color.mutedText, className)}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children }: { children: React.ReactNode }) {
  return <tr className={cn("border-b last:border-b-0", theme.color.border)}>{children}</tr>;
}

export function TD({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td className={cn("px-3 py-2", className)} colSpan={colSpan}>{children}</td>;
}
