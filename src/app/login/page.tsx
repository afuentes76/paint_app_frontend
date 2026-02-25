// src/app/login/page.tsx
"use client";

// src/app/login/page.tsx

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { setAuth } from "@/lib/auth";

// Use existing UI components from Chat 0
import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { FormField } from "@/ui/components/FormField";

type LoginSuccess = {
  access_token?: string;
  token?: string;
  jwt?: string;
  role?: "USER" | "ADMIN";
  user_id?: string;
};

function extractToken(payload: LoginSuccess): string | null {
  return payload.access_token ?? payload.token ?? payload.jwt ?? null;
}

function extractRole(payload: LoginSuccess): "USER" | "ADMIN" | null {
  if (payload.role === "USER" || payload.role === "ADMIN") return payload.role;
  return null;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setErrorMsg(res.status === 403 ? "Account is not enabled yet" : "Invalid email or password");
        } else if (res.status === 500) {
          setErrorMsg("Server error occurred during login. Please check server logs.");
        } else {
          setErrorMsg("Login failed");
        }
        try {
          const raw = await res.text();
          console.error("Login error response:", res.status, raw);
        } catch (err) {
          console.error("Login error response read failed:", err);
        }
        return;
      }

      const data = (await res.json()) as LoginSuccess;

      const token = extractToken(data);
      const role = extractRole(data);

      if (!token || !role) {
        console.error("Login success payload missing required fields:", data);
        setErrorMsg("Login failed");
        return;
      }

      setAuth({ token, role, userId: data.user_id ?? null });

      router.replace("/tasks");
    } catch (err) {
      console.error("Login network/unknown error:", err);
      setErrorMsg("Cannot reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-xl font-semibold">Login</h1>
              <p className="mt-1 text-sm opacity-80">Sign in to continue.</p>
            </div>

            {errorMsg ? (
              <div className="mb-4">
                <ErrorBanner message={errorMsg} />
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
             <FormField label="Email" required>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                />
                </FormField>

                <FormField label="Password" required>
                <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                />
                </FormField>

                <Button type="submit" disabled={!canSubmit || loading}>
                    {loading ? "Logging in..." : "Login"}
                </Button>
            </form>

            <div className="mt-6 text-sm opacity-80">
              <Link href="/register" className="underline hover:opacity-80">
                Create account
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
