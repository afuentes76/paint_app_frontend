// src/ui/components/AdminNavBar.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav className={cn("border-t", theme.color.border, theme.color.surface, className)}>
      <div className={cn("mx-auto px-4 py-2", theme.container.max)}>
        <div className="flex items-center justify-end">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors",
                theme.radius.md,
                theme.color.surface2,
                theme.color.text,
                "border",
                theme.color.border,
                "hover:brightness-105"
              )}
              aria-label="Admin menu"
            >
              <svg
                className={cn("w-4 h-4 transition-transform", isOpen ? "rotate-180" : "")}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Admin
            </button>

            {isOpen && (
              <div
                className={cn(
                  "absolute right-0 mt-2 w-52",
                  theme.color.surface,
                  theme.radius.md,
                  theme.shadow.md,
                  "border",
                  theme.color.border,
                  "z-50"
                )}
              >
                <div className="py-1">
                  {adminLinks.map((link) => {
                    const active = pathname === link.href || pathname?.startsWith(link.href + "/");
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "block px-4 py-2 text-sm transition-colors",
                          active ? theme.color.surface2 : "hover:bg-[var(--color-surface-2)]",
                          active ? "font-semibold" : "font-medium",
                          theme.color.text
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}