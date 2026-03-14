// src/app/admin/users/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Table, TBody, TD, TH, THead, TR } from "@/ui/components/Table";
import { cn, theme } from "@/ui/theme";

type AdminUser = {
  user_id: string;
  email: string;
  role?: "USER" | "ADMIN";
  enabled: boolean;
  created_at?: string;
};

type RowState = {
  saving: boolean;
  errorFriendly: string | null;
  errorRaw: string | null;
};

function friendlyErrorFrom(resStatus: number, rawText: string): string {
  if (resStatus === 401 || resStatus === 403) return "Not authorized";
  if (resStatus === 404) return "Endpoint not found";
  if (resStatus >= 500) return "Server error";
  if (rawText.toLowerCase().includes("disabled")) return "Action not allowed";
  return "Update failed";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  // pagination (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const rows = useMemo(() => users ?? [], [users]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, safePage, pageSize]);

  // keep page valid if total changes
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  async function load() {
    setLoading(true);
    setErrorFriendly(null);
    setErrorRaw(null);

    try {
      const res = await fetchWithAuth("/api/admin/users");
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        setErrorFriendly(friendlyErrorFrom(res.status, raw));
        setErrorRaw(`HTTP ${res.status}: ${raw || "(no body)"}`);
        return;
      }
      const data = (await res.json()) as AdminUser[];
      setUsers(Array.isArray(data) ? data : []);
      setPage(1); // reset after reload
    } catch (err) {
      console.error("Admin users load error:", err);
      setErrorFriendly("Cannot reach server");
      setErrorRaw(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleEnabled(u: AdminUser, nextEnabled: boolean) {
    const id = u.user_id;
    const prevEnabled = u.enabled;

    setUsers((prev) => prev.map((x) => (x.user_id === id ? { ...x, enabled: nextEnabled } : x)));
    setRowState((prev) => ({
      ...prev,
      [id]: { saving: true, errorFriendly: null, errorRaw: null },
    }));

    try {
      const res = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        const friendly = friendlyErrorFrom(res.status, raw);

        // revert
        setUsers((prev) => prev.map((x) => (x.user_id === id ? { ...x, enabled: prevEnabled } : x)));
        setRowState((prev) => ({
          ...prev,
          [id]: {
            saving: false,
            errorFriendly: friendly,
            errorRaw: `HTTP ${res.status}: ${raw || "(no body)"}`,
          },
        }));
        return;
      }

      setRowState((prev) => ({
        ...prev,
        [id]: { saving: false, errorFriendly: null, errorRaw: null },
      }));
    } catch (err) {
      console.error("Admin users toggle error:", err);
      setUsers((prev) => prev.map((x) => (x.user_id === id ? { ...x, enabled: prevEnabled } : x)));
      setRowState((prev) => ({
        ...prev,
        [id]: { saving: false, errorFriendly: "Cannot reach server", errorRaw: String(err) },
      }));
    }
  }

  return (
    <Protected role="ADMIN" redirectOnRoleMismatch="/tasks">
      <div className="w-full">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Admin Users</h1>
          <p className={cn("mt-1 text-sm", theme.color.mutedText)}>Enable/disable users. Changes auto-save.</p>
        </div>

        {errorFriendly ? (
          <div className="mb-4">
            <ErrorBanner message={errorFriendly} />
            {errorRaw ? (
              <pre className={cn("mt-2 whitespace-pre-wrap text-xs", theme.color.mutedText)}>{errorRaw}</pre>
            ) : null}
          </div>
        ) : null}

        <Card>
          <div className="p-4">
            {loading ? (
              <Loading label="Loading users..." />
            ) : (
              <>
                {/* Pagination toolbar */}
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      className={cn("rounded-md border px-3 py-2 text-sm", theme.color.border)}
                      onClick={() => void load()}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn("text-xs", theme.color.mutedText)}>
                      {total === 0
                        ? "0 users"
                        : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, total)} of ${total}`}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs", theme.color.mutedText)}>Rows:</span>
                      <select
                        className={cn(
                          "h-9 rounded-md border px-2 text-sm",
                          theme.color.border,
                          theme.color.background,
                          theme.color.text
                        )}
                        value={pageSize}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPageSize(v);
                          setPage(1);
                        }}
                      >
                        {[10, 25, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        <button
                          className={cn("rounded-md border px-3 py-2 text-sm", theme.color.border)}
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </button>
                        <div className={cn("text-xs", theme.color.mutedText)}>
                          Page {safePage} / {totalPages}
                        </div>
                        <button
                          className={cn("rounded-md border px-3 py-2 text-sm", theme.color.border)}
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <Table>
                  <THead>
                    <TR>
                      <TH>Email</TH>
                      <TH>Role</TH>
                      <TH>Enabled</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {pageRows.length === 0 ? (
                      <TR>
                        <td colSpan={4} className={cn("px-3 py-2 text-sm", theme.color.mutedText)}>
                          No users found.
                        </td>
                      </TR>
                    ) : (
                      pageRows.map((u) => {
                        const st = rowState[u.user_id];
                        return (
                          <TR key={u.user_id} >
                            <TD>{u.email}</TD>
                            <TD>{u.role ?? "USER"}</TD>
                            <TD>
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={Boolean(u.enabled)}
                                  disabled={Boolean(st?.saving)}
                                  onChange={(e) => toggleEnabled(u, e.target.checked)}
                                />
                                <span className={cn("text-sm", theme.color.mutedText)}>
                                  {u.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </label>
                            </TD>
                            <TD>
                              {st?.saving ? (
                                <span className={cn("text-sm", theme.color.mutedText)}>Saving...</span>
                              ) : st?.errorFriendly ? (
                                <div>
                                  <div className="text-sm font-medium">{st.errorFriendly}</div>
                                  {st.errorRaw ? (
                                    <pre className={cn("mt-1 whitespace-pre-wrap text-xs", theme.color.mutedText)}>
                                      {st.errorRaw}
                                    </pre>
                                  ) : null}
                                </div>
                              ) : (
                                <span className={cn("text-sm", theme.color.mutedText)}>—</span>
                              )}
                            </TD>
                          </TR>
                        );
                      })
                    )}
                  </TBody>
                </Table>
              </>
            )}
          </div>
        </Card>
      </div>
    </Protected>
  );
}
