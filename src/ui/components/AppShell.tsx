// src/ui/components/AppShell.tsx
"use client";

import React, { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, theme } from "@/ui/theme";
import { getRole, isAuthenticated, logout } from "@/lib/auth";
import { Button } from "@/ui/components/Button";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { AdminNavBar } from "@/ui/components/AdminNavBar";

type AppShellProps = {
  appName: string;
  children: React.ReactNode;
};

function safeGetLS(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(key);
    return v && v.trim().length > 0 ? v : null;
  } catch {
    return null;
  }
}

function safeRemoveLS(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function AppShell({ appName, children }: AppShellProps) {
  const pathname = usePathname();
  const [flash, setFlash] = useState<string | null>(null);

  // ✅ NEW: client-only auth state (prevents hydration mismatch)
  const [auth, setAuth] = useState<{ authed: boolean; role: string | null; email: string | null }>({
    authed: false,
    role: null,
    email: null,
  });

  // Flash message (e.g. after register -> login). Read once on mount.
  useEffect(() => {
    const msg = safeGetLS("flash_message");
    if (msg) {
      safeRemoveLS("flash_message");
      startTransition(() => setFlash(msg));
    }
  }, []);

  // ✅ NEW: read auth snapshot only AFTER mount
  useEffect(() => {
    const authed = isAuthenticated();
    const role = getRole();
    const email = safeGetLS("email"); // optional if login flow stored it
    setAuth({ authed, role, email });
  }, []);

  const authed = auth.authed;
  const role = auth.role;
  const email = auth.email;
  const isAdmin = role === "ADMIN";

  const navLinks: Array<{ href: string; label: string }> = [];
  // Navigation is now handled by AdminNavBar for admins only

  return (
    <div className={cn("min-h-screen", theme.color.background, theme.color.text)}>
      <header className={cn("border-b", theme.color.border, theme.color.surface)}>
        <div className={cn("mx-auto flex h-14 items-center justify-between px-4", theme.container.max)}>
          <div className="flex items-center gap-3">
            <div
              className={cn("h-9 w-9 border", theme.color.border, theme.radius.md, theme.color.surface2)}
              aria-hidden="true"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold">{appName}</div>
              <div className={cn("text-xs", theme.color.mutedText)}>Light theme baseline</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {authed ? (
              <div className={cn("text-xs", theme.color.mutedText)}>
                Signed in as: {role ?? "USER"}
                {email ? <span className="ml-2">({email})</span> : null}
              </div>
            ) : (
              <div className={cn("text-xs", theme.color.mutedText)}>Not signed in</div>
            )}

            {authed ? (
              <Button variant="secondary" onClick={() => logout("/login")} className="h-9 px-3">
                Logout
              </Button>
            ) : null}
          </div>
        </div>

        {navLinks.length > 0 ? (
          <div className={cn("border-t", theme.color.border)}>
            <div className={cn("mx-auto flex items-center gap-2 px-4 py-2", theme.container.max)}>
              {navLinks.map((l) => {
                const active = pathname === l.href || pathname?.startsWith(l.href + "/");
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "text-sm",
                      theme.radius.md,
                      "px-3 py-1 border",
                      theme.color.border,
                      active ? theme.color.surface2 : theme.color.surface,
                      active ? "font-semibold" : "font-medium",
                      "hover:opacity-90"
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      {isAdmin && <AdminNavBar />}

      <main className={cn("mx-auto px-4 py-6", theme.container.max)}>
        {flash ? (
          <div className="mb-4">
            <ErrorBanner title="Success" message={flash} />
          </div>
        ) : null}

        {children}
      </main>
    </div>
  );
}
