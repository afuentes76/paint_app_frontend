// src/ui/components/AppShell.tsx
"use client";

import React, { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, theme } from "@/ui/theme";
import { getAuthEventName, getEmail, getRole, isAuthenticated, logout } from "@/lib/auth";
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

  // Auth/marketing routes should feel like a landing page (no heavy header, no constrained container).
  const isAuthRoute = pathname === "/login" || pathname === "/register";

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

  // ✅ Auth snapshot reader (runs after mount + whenever auth changes)
  const refreshAuth = () => {
    const authed = isAuthenticated();
    const role = getRole();
    const email = getEmail();
    setAuth({ authed, role, email });
  };

  useEffect(() => {
    refreshAuth();

    const evt = getAuthEventName();
    const onAuth = () => refreshAuth();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth_changed_at" || e.key === "jwt" || e.key === "role" || e.key === "email") {
        refreshAuth();
      }
    };

    window.addEventListener(evt, onAuth);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(evt, onAuth);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also refresh on route changes (covers cases where auth was set before navigation)
  useEffect(() => {
    refreshAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
const authed = auth.authed;
  const role = auth.role;
  const email = auth.email;
  const isAdmin = role === "ADMIN";

  const navLinks: Array<{ href: string; label: string }> = [];
  // Navigation is now handled by AdminNavBar for admins only

  return (
    <div className={cn("min-h-screen", theme.color.background, theme.color.text)}>
      <header
        className={cn(
          "sticky top-0 z-40 border-b",
          theme.color.border,
          theme.color.surface,
          isAuthRoute ? "bg-white/70 backdrop-blur" : null
        )}
      >
        <div
          className={cn(
            "mx-auto flex items-center justify-between px-4",
            isAuthRoute ? "py-2" : "py-3",
            theme.container.max
          )}
        >
          <Link href="/tasks" className="flex items-center gap-3" aria-label="Go to Tasks">
            <img
              src="/logo-placeholder.svg"
              alt="Logo"
              className={cn(isAuthRoute ? "h-10 w-auto" : "h-[100px] w-auto", theme.radius.md)}
              draggable={false}
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold">{appName}</div>
              <div className={cn("text-xs", theme.color.mutedText)}>Light theme baseline</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {authed ? (
              <div className={cn("text-xs", theme.color.mutedText)}>
                Signed in as: {email ?? "User"}
                {role ? <span className="ml-2">({role})</span> : null}
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

        {!isAuthRoute && isAdmin ? <AdminNavBar /> : null}
      </header>

      <main className={cn(isAuthRoute ? "w-full p-0" : cn("mx-auto px-4 py-6", theme.container.max))}>
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