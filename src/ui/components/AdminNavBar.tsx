// src/ui/components/AdminNavBar.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, theme } from "@/ui/theme";

type AdminNavBarProps = {
  className?: string;
};

const adminLinks = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/masks", label: "Mask Catalog" },
  { href: "/admin/config", label: "Config" },
];

export function AdminNavBar({ className }: AdminNavBarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <nav className={cn("border-b bg-red-50 border-red-200", className)}>
      <div className={cn("mx-auto px-4 py-3", theme.container.max)}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 text-sm font-semibold text-red-800 hover:text-red-900 transition-colors"
          >
            <svg
              className={cn("w-4 h-4 transition-transform", isCollapsed ? "rotate-90" : "")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Admin Panel
          </button>

          {!isCollapsed && (
            <div className="flex items-center gap-1">
              {adminLinks.map((link) => {
                const active = pathname === link.href || pathname?.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      active
                        ? "bg-red-200 text-red-900"
                        : "text-red-700 hover:bg-red-100 hover:text-red-900"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}