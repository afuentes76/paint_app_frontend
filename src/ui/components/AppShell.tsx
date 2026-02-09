import { cn, theme } from "@/ui/theme";

type AppShellProps = {
  appName: string;
  children: React.ReactNode;
};

export function AppShell({ appName, children }: AppShellProps) {
  return (
    <div className={cn("min-h-screen", theme.color.background, theme.color.text)}>
      <header className={cn("border-b", theme.color.border, theme.color.surface)}>
        <div
          className={cn(
            "mx-auto flex h-14 items-center justify-between px-4",
            theme.container.max
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-9 w-9 border",
                theme.color.border,
                theme.radius.md,
                theme.color.surface2
              )}
              aria-hidden="true"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold">{appName}</div>
              <div className={cn("text-xs", theme.color.mutedText)}>
                Light theme baseline
              </div>
            </div>
          </div>

          <div className={cn("text-xs", theme.color.mutedText)}>
            {/* placeholder for future: auth/user menu */}
            Not signed in
          </div>
        </div>
      </header>

      <main className={cn("mx-auto px-4 py-6", theme.container.max)}>
        {children}
      </main>
    </div>
  );
}
