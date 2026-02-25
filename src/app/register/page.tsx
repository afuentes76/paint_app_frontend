// src/app/register/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { FormField } from "@/ui/components/FormField";
import { cn, theme } from "@/ui/theme";

function friendlyRegisterError(status: number, raw: string): string {
  const lower = raw.toLowerCase();
  if (status === 409 || lower.includes("already") || lower.includes("exists")) {
    return "Email already registered";
  }
  if (status === 400 || lower.includes("password")) {
    return "Password does not meet requirements";
  }
  if (status === 404) {
    return "Registration is not available on this server";
  }
  if (status === 401 || status === 403) {
    return "Registration is not allowed";
  }
  if (status >= 500) {
    return "Server error";
  }
  return "Registration failed";
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && confirmPassword.length > 0 && !loading;
  }, [email, password, confirmPassword, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        console.error("Register error response:", res.status, raw);
        setErrorMsg(friendlyRegisterError(res.status, raw));
        return;
      }

      // Success: do not auto-login unless backend returns a token (not assumed here)
      try {
        localStorage.setItem("flash_message", "Account created. Wait admin enabled it");
      } catch {
        // ignore
      }
      router.replace("/login");
    } catch (err) {
      console.error("Register network/unknown error:", err);
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
              <h1 className="text-xl font-semibold">Create account</h1>
              <p className={cn("mt-1 text-sm", theme.color.mutedText)}>
                Register a new user. An admin may need to enable your account before you can sign in.
              </p>
            </div>

            {errorMsg ? (
              <div className="mb-4">
                <ErrorBanner message={errorMsg} />
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              <FormField label="Email" required>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </FormField>

              <FormField label="Password" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </FormField>

              <FormField label="Confirm password" required>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </FormField>

              <Button type="submit" disabled={!canSubmit || loading}>
                {loading ? "Creating..." : "Create account"}
              </Button>
            </form>

            <div className={cn("mt-6 text-sm", theme.color.mutedText)}>
              Already have an account?{" "}
              <Link href="/login" className="underline hover:opacity-80">
                Sign in
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
