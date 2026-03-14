// src/app/admin/tasks/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Table, TBody, TD, TH, THead, TR } from "@/ui/components/Table";
import { cn, theme } from "@/ui/theme";

type AdminTask = {
  task_id: string;
  owner_user_id?: string;
  name?: string;
  status?: string;
  processing_type?: string | null;
  original_image_url?: string | null;
  qr_url?: string | null;
};

type AdminUser = {
  user_id: string;
  email?: string;
  name?: string;
  full_name?: string;
  display_name?: string;
};

function friendlyErrorFrom(resStatus: number): string {
  if (resStatus === 401 || resStatus === 403) return "Not authorized";
  if (resStatus === 404) return "Endpoint not found";
  if (resStatus >= 500) return "Server error";
  return "Request failed";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function bestUserLabel(u?: AdminUser | null): string {
  if (!u) return "—";
  return (
    u.display_name ||
    u.full_name ||
    u.name ||
    u.email ||
    u.user_id ||
    "—"
  );
}

export default function AdminTasksPage() {
  const [loading, setLoading] = useState(true);
  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // pagination (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const rows = useMemo(() => tasks ?? [], [tasks]);

  const userById = useMemo(() => {
    const m = new Map<string, AdminUser>();
    for (const u of users) {
      if (u?.user_id) m.set(u.user_id, u);
    }
    return m;
  }, [users]);

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

  async function loadAll() {
    setLoading(true);
    setErrorFriendly(null);
    setErrorRaw(null);

    try {
      // Load tasks
      const resTasks = await fetchWithAuth("/api/admin/tasks");
      if (!resTasks.ok) {
        const raw = await resTasks.text().catch(() => "");
        setErrorFriendly(friendlyErrorFrom(resTasks.status));
        setErrorRaw(`HTTP ${resTasks.status}: ${raw || "(no body)"}`);
        return;
      }
      const taskData = (await resTasks.json()) as AdminTask[];
      const taskList = Array.isArray(taskData) ? taskData : [];
      setTasks(taskList);

      // Load users (to map owner_user_id -> email/name)
      const resUsers = await fetchWithAuth("/api/admin/users");
      if (!resUsers.ok) {
        // Not fatal: still show IDs if users endpoint missing
        const raw = await resUsers.text().catch(() => "");
        console.warn("Admin users fetch failed:", resUsers.status, raw);
        setUsers([]);
        return;
      }
      const userData = (await resUsers.json()) as AdminUser[];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      console.error("Admin tasks load error:", err);
      setErrorFriendly("Cannot reach server");
      setErrorRaw(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <Protected role="ADMIN" redirectOnRoleMismatch="/tasks">
      <div className="w-full">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Admin Tasks</h1>
          <p className={cn("mt-1 text-sm", theme.color.mutedText)}>Read-only list of tasks.</p>
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
              <Loading label="Loading tasks..." />
            ) : (
              <>
                {/* Toolbar */}
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      className={cn("rounded-md border px-3 py-2 text-sm", theme.color.border)}
                      onClick={loadAll}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn("text-xs", theme.color.mutedText)}>
                      {total === 0
                        ? "0 tasks"
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
                      <TH>Name</TH>
                      <TH>Status</TH>
                      <TH>Type</TH>
                      <TH>Owner</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {pageRows.length === 0 ? (
                      <TR>
                        <td colSpan={4} className={cn("px-3 py-2 text-sm", theme.color.mutedText)}>
                          No tasks found.
                        </td>
                      </TR>
                    ) : (
                      pageRows.map((t) => {
                        const ownerId = t.owner_user_id ?? "";
                        const owner = ownerId ? userById.get(ownerId) : null;

                        return (
                          <TR key={t.task_id}  >
                            <TD>{t.name ?? t.task_id}</TD>
                            <TD>{t.status ?? "—"}</TD>
                            <TD>{t.processing_type ?? "—"}</TD>
                            <TD className={cn("text-xs", theme.color.mutedText)}>
                              {owner ? bestUserLabel(owner) : (ownerId || "—")}
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
