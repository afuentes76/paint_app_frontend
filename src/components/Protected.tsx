"use client";

// src/components/Protected.tsx

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppRole } from "@/lib/auth";
import { getRole, isAuthenticated } from "@/lib/auth";

type ProtectedProps = {
  children: React.ReactNode;
  role?: AppRole;
  roles?: AppRole[];
  redirectOnRoleMismatch?: string;
};

export default function Protected({
  children,
  role,
  roles,
  redirectOnRoleMismatch = "/tasks",
}: ProtectedProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const requiredRoles = useMemo<AppRole[] | null>(() => {
    if (roles && roles.length > 0) return roles;
    if (role) return [role];
    return null;
  }, [role, roles]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const authed = isAuthenticated();
    if (!authed) {
      if (pathname !== "/login") router.replace("/login");
      setAllowed(false);
      return;
    }

    if (requiredRoles) {
      const currentRole = getRole();
      const ok = currentRole ? requiredRoles.includes(currentRole) : false;
      if (!ok) {
        router.replace(redirectOnRoleMismatch);
        setAllowed(false);
        return;
      }
    }

    setAllowed(true);
  }, [mounted, pathname, requiredRoles, redirectOnRoleMismatch, router]);

  if (!mounted) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
