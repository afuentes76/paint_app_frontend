// src/app/tasks/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Table, TBody, TD, TH, THead, TR } from "@/ui/components/Table";
import { Badge } from "@/ui/components/Badge";
import { cn, theme } from "@/ui/theme";

import type { TaskDTO } from "@/types/dto.task";

function friendlyErrorFrom(resStatus: number): string {
  if (resStatus === 401 || resStatus === 403) return "Not authorized";
  if (resStatus === 404) return "Endpoint not found";
  if (resStatus >= 500) return "Server error";
  return "Request failed";
}

function pickCreatedValue(t: any): string | null {
  return (
    t?.created_at ??
    t?.createdAt ??
    t?.created ??
    t?.created_on ??
    t?.createdOn ??
    null
  );
}

function formatDateAny(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusLabel(raw?: string | null): string {
  const s = String(raw ?? "").toUpperCase();

  // show real statuses, just nicer labels
  if (s === "NEW") return "New";
  if (s === "WAITING_FOR_UPLOAD") return "Waiting for upload";
  if (s === "IMAGE_UPLOADED") return "Image uploaded";
  if (s === "PROCESSING") return "Processing";
  if (s === "READY_FOR_PREVIEW") return "Ready for preview";
  if (s === "FAILED") return "Failed";

  return raw ?? "—";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskDTO[]>([]);

  // pagination (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // thumbnails: task_id -> objectURL
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  async function loadTasks() {
    setLoading(true);
    setErrorFriendly(null);
    setErrorRaw(null);

    try {
      const res = await fetchWithAuth("/api/tasks");
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        setErrorFriendly(friendlyErrorFrom(res.status));
        setErrorRaw(`HTTP ${res.status}: ${raw || "(no body)"}`);
        return;
      }

      const data = (await res.json()) as TaskDTO[];
      const list = Array.isArray(data) ? data : [];
      setTasks(list);

      // keep selection only for tasks still present
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const t of list) {
          if ((prev as any)[(t as any).task_id]) next[(t as any).task_id] = true;
        }
        return next;
      });
    } catch (err) {
      console.error("Tasks load error:", err);
      setErrorFriendly("Cannot reach server");
      setErrorRaw(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => tasks ?? [], [tasks]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, safePage, pageSize]);

  // if totalPages shrinks, keep page valid
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedCount = selectedIds.length;

  const pageIds = useMemo(() => pageRows.map((t: any) => t.task_id), [pageRows]);
  const pageSelectedCount = useMemo(() => pageIds.filter((id) => selected[id]).length, [pageIds, selected]);
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const somePageSelected = pageSelectedCount > 0 && pageSelectedCount < pageIds.length;

  function toggleSelectOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSelectAllOnPage(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of pageIds) next[id] = checked;
      return next;
    });
  }

  function clearSelection() {
    setSelected({});
  }

  async function handleDelete(taskId: string) {
    const ok = confirm("Delete this task permanently?");
    if (!ok) return;

    try {
      setDeletingId(taskId);

      const res = await fetchWithAuth(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        setErrorFriendly(friendlyErrorFrom(res.status));
        setErrorRaw(`HTTP ${res.status}: ${raw || "(no body)"}`);
        return;
      }

      // cleanup thumbnail url if exists
      setThumbs((prev) => {
        const next = { ...prev };
        const u = next[taskId];
        if (u) URL.revokeObjectURL(u);
        delete next[taskId];
        return next;
      });

      // update UI
      setTasks((prev) => prev.filter((t: any) => t.task_id !== taskId));
      setSelected((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    } catch (err) {
      console.error("Delete error:", err);
      setErrorFriendly("Cannot delete task");
      setErrorRaw(String(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;

    const ok = confirm(`Delete ${selectedCount} selected task(s) permanently?`);
    if (!ok) return;

    setErrorFriendly(null);
    setErrorRaw(null);

    const ids = [...selectedIds];

    try {
      setBulkDeleting(true);

      const failed: Array<{ id: string; status: number; body: string }> = [];

      for (const id of ids) {
        const res = await fetchWithAuth(`/api/tasks/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          failed.push({ id, status: res.status, body: body || "(no body)" });
        }
      }

      const failedSet = new Set(failed.map((f) => f.id));

      // revoke thumbs for successfully deleted
      setThumbs((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (!failedSet.has(id)) {
            const u = next[id];
            if (u) URL.revokeObjectURL(u);
            delete next[id];
          }
        }
        return next;
      });

      setTasks((prev) => prev.filter((t: any) => !ids.includes(t.task_id) || failedSet.has(t.task_id)));

      setSelected(() => {
        const next: Record<string, boolean> = {};
        for (const f of failed) next[f.id] = true;
        return next;
      });

      if (failed.length > 0) {
        setErrorFriendly(`Some deletes failed (${failed.length}/${ids.length})`);
        setErrorRaw(
          failed
            .slice(0, 12)
            .map((f) => `${f.id}: HTTP ${f.status} ${f.body}`)
            .join("\n") + (failed.length > 12 ? `\n...and ${failed.length - 12} more` : "")
        );
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      setErrorFriendly("Bulk delete failed");
      setErrorRaw(String(err));
    } finally {
      setBulkDeleting(false);
    }
  }

  // Thumbnail loader for visible rows (auth-safe: fetchWithAuth blob)
  useEffect(() => {
    let cancelled = false;

    async function ensureThumb(task: any) {
      const id = String(task.task_id);

      // already have it
      if (thumbs[id]) return;

      // only attempt if backend indicates there IS an original image
      const localPath = task?.original_image_local_path;
      const urlHint = task?.original_image_url;

      // If neither exists, skip
      if (!localPath && !urlHint) return;

      try {
        const res = await fetchWithAuth(`/api/tasks/${id}/assets/original`);
        if (!res.ok) return;

        const blob = await res.blob();
        if (cancelled) return;

        const objUrl = URL.createObjectURL(blob);
        setThumbs((prev) => ({ ...prev, [id]: objUrl }));
      } catch {
        // ignore
      }
    }

    (async () => {
      for (const t of pageRows as any[]) {
        await ensureThumb(t);
      }
    })();

    return () => {
      cancelled = true;
    };
    // IMPORTANT: only rerun when pageRows changes (not thumbs itself)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRows]);

  // revoke all thumbs on unmount
  useEffect(() => {
    return () => {
      for (const k of Object.keys(thumbs)) {
        try {
          URL.revokeObjectURL(thumbs[k]);
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Protected roles={["USER", "ADMIN"]}>
      <div className="w-full">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Tasks</h1>
            <p className={cn("mt-1 text-sm", theme.color.mutedText)}>Your tasks and processing status.</p>
          </div>

          <Link href="/tasks/new">
            <Button variant="primary">Create new task</Button>
          </Link>
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
                    <Button variant="danger" disabled={selectedCount === 0 || bulkDeleting} onClick={handleBulkDelete}>
                      {bulkDeleting ? "Deleting..." : `Delete selected (${selectedCount})`}
                    </Button>

                    <Button variant="secondary" disabled={selectedCount === 0 || bulkDeleting} onClick={clearSelection}>
                      Clear selection
                    </Button>

                    <Button variant="secondary" disabled={bulkDeleting} onClick={loadTasks}>
                      Refresh
                    </Button>
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
                          theme.color.bg,
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
                        <Button
                          variant="secondary"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <div className={cn("text-xs", theme.color.mutedText)}>
                          Page {safePage} / {totalPages}
                        </div>
                        <Button
                          variant="secondary"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Table>
                  <THead>
                    <TR>
                      <TH className="w-[44px]">
                        <input
                          type="checkbox"
                          aria-label="Select all tasks on this page"
                          checked={allPageSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = somePageSelected;
                          }}
                          onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                        />
                      </TH>
                      <TH> </TH>
                      <TH>Name</TH>
                      <TH>Created</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Actions</TH>
                    </TR>
                  </THead>

                  <TBody>
                    {pageRows.length === 0 ? (
                      <TR>
                        <td colSpan={5} className={cn("px-3 py-2 text-sm", theme.color.mutedText)}>
                          No tasks yet.
                        </td>
                      </TR>
                    ) : (
                      (pageRows as any[]).map((t) => {
                        const id = String(t.task_id);
                        const created = pickCreatedValue(t);
                        const thumbUrl = thumbs[id];

                        return (
                          <TR key={id}>
                            <TD className="w-[44px]">
                              <input
                                type="checkbox"
                                aria-label={`Select task ${t.name ?? id}`}
                                checked={!!selected[id]}
                                onChange={() => toggleSelectOne(id)}
                              />
                            </TD>
                            <TD>
                                {/* Thumbnail */}
                                <div className="h-[64px] w-[64px] min-h-[64px] min-w-[64px] max-h-[64px] max-w-[64px] overflow-hidden rounded-md border bg-white flex-shrink-0">
                                  {thumbUrl ? (
                                    <img
                                      src={thumbUrl}
                                      alt="thumb"
                                      className="h-[64px] w-[64px] object-cover"
                                      draggable={false}
                                    />
                                  ) : (

                                    <div className={cn("flex h-full w-full items-center justify-center text-[10px]", theme.color.mutedText)}>
                                      —
                                    </div>
                                  )}
                                </div>

                            </TD>

                            <TD>
                              <div className="flex items-center gap-3">
                               

                                <div className="min-w-0">
                                  <div className="truncate">{t.name ?? id}</div>
                                 
                                </div>
                              </div>
                            </TD>

                            <TD className={cn("text-xs", theme.color.mutedText)}>{formatDateAny(created)}</TD>

                            <TD>
                              <Badge variant="muted">{statusLabel(t.status)}</Badge>
                            </TD>

                            <TD className="text-right">
                              <div className="flex justify-end gap-2">
                                <Link href={`/tasks/${id}`}>
                                  <Button variant="secondary">View</Button>
                                </Link>

                                <Button
                                  variant="danger"
                                  disabled={deletingId === id || bulkDeleting}
                                  onClick={() => handleDelete(id)}
                                >
                                  {deletingId === id ? "Deleting..." : "Delete"}
                                </Button>
                              </div>
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
