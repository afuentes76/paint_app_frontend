// src/app/admin/masks/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { FormField } from "@/ui/components/FormField";
import { Input } from "@/ui/components/Input";
import { Loading } from "@/ui/components/Loading";
import { Select } from "@/ui/components/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/ui/components/Table";
import { cn, theme } from "@/ui/theme";

type MaskCatalogItem = {
  mask_catalog_id?: string;
  key: string;
  display_name: string;
  processing_type: "INTERIOR" | "EXTERIOR" | string;
  active: boolean;
  sort_order: number;
  mask_prompt?: string | null;
  negative_mask_prompt?: string | null;
};

type EditorMode = "add" | "edit";

const PROCESSING_TYPE_OPTIONS = ["INTERIOR", "EXTERIOR"] as const;
type ProcessingType = (typeof PROCESSING_TYPE_OPTIONS)[number];

type EditorState = {
  open: boolean;
  mode: EditorMode;
  saving: boolean;
  errorFriendly: string | null;
  errorRaw: string | null;
  value: MaskCatalogItem;
};

function emptyItem(): MaskCatalogItem {
  return {
    key: "",
    display_name: "",
    processing_type: "INTERIOR",
    active: true,
    sort_order: 0,
    mask_prompt: "",
    negative_mask_prompt: "",
  };
}

function friendlyErrorFrom(resStatus: number, rawText: string): string {
  if (resStatus === 401 || resStatus === 403) return "Not authorized";
  if (resStatus === 404) return "Endpoint not found";
  if (resStatus >= 500) return "Server error";
  if (rawText.toLowerCase().includes("duplicate") || rawText.toLowerCase().includes("exists")) {
    return "Item already exists";
  }
  return "Request failed";
}

function idOrKey(item: MaskCatalogItem): string {
  return item.mask_catalog_id && item.mask_catalog_id.trim().length > 0 ? item.mask_catalog_id : item.key;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdminMaskCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);
  const [items, setItems] = useState<MaskCatalogItem[]>([]);

  // pagination (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [editor, setEditor] = useState<EditorState>({
    open: false,
    mode: "add",
    saving: false,
    errorFriendly: null,
    errorRaw: null,
    value: emptyItem(),
  });

  const rows = useMemo(() => items ?? [], [items]);

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
      const res = await fetchWithAuth("/api/admin/mask-catalog");
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        setErrorFriendly(friendlyErrorFrom(res.status, raw));
        setErrorRaw(`HTTP ${res.status}: ${raw || "(no body)"}`);
        return;
      }
      const data = (await res.json()) as MaskCatalogItem[];
      setItems(Array.isArray(data) ? data : []);
      setPage(1); // reset to first page after reload
    } catch (err) {
      console.error("Admin mask catalog load error:", err);
      setErrorFriendly("Cannot reach server");
      setErrorRaw(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openAdd() {
    setEditor({
      open: true,
      mode: "add",
      saving: false,
      errorFriendly: null,
      errorRaw: null,
      value: emptyItem(),
    });
  }

  function openEdit(item: MaskCatalogItem) {
    setEditor({
      open: true,
      mode: "edit",
      saving: false,
      errorFriendly: null,
      errorRaw: null,
      value: { ...item },
    });
  }

  function closeEditor() {
    if (editor.saving) return;
    setEditor((prev) => ({ ...prev, open: false }));
  }

  function setField<K extends keyof MaskCatalogItem>(key: K, value: MaskCatalogItem[K]) {
    setEditor((prev) => ({ ...prev, value: { ...prev.value, [key]: value } }));
  }

  async function saveEditor() {
    const payload = editor.value;
    if (!payload.key.trim() || !payload.display_name.trim()) {
      setEditor((prev) => ({
        ...prev,
        errorFriendly: "Key and Display Name are required",
        errorRaw: null,
      }));
      return;
    }

    setEditor((prev) => ({ ...prev, saving: true, errorFriendly: null, errorRaw: null }));

    try {
      const isAdd = editor.mode === "add";
      const url = isAdd ? "/api/admin/mask-catalog" : `/api/admin/mask-catalog/${encodeURIComponent(idOrKey(payload))}`;
      const method = isAdd ? "POST" : "PATCH";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        setEditor((prev) => ({
          ...prev,
          saving: false,
          errorFriendly: friendlyErrorFrom(res.status, raw),
          errorRaw: `HTTP ${res.status}: ${raw || "(no body)"}`,
        }));
        return;
      }

      await load();
      setEditor((prev) => ({ ...prev, saving: false, open: false }));
    } catch (err) {
      console.error("Admin mask catalog save error:", err);
      setEditor((prev) => ({
        ...prev,
        saving: false,
        errorFriendly: "Cannot reach server",
        errorRaw: String(err),
      }));
    }
  }

  async function deleteItem(item: MaskCatalogItem) {
    const ok = window.confirm(`Delete mask catalog entry "${item.key}"?`);
    if (!ok) return;

    setErrorFriendly(null);
    setErrorRaw(null);

    try {
      const res = await fetchWithAuth(`/api/admin/mask-catalog/${encodeURIComponent(idOrKey(item))}`, { method: "DELETE" });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        setErrorFriendly(friendlyErrorFrom(res.status, raw));
        setErrorRaw(`HTTP ${res.status}: ${raw || "(no body)"}`);
        return;
      }

      await load();
    } catch (err) {
      console.error("Admin mask catalog delete error:", err);
      setErrorFriendly("Cannot reach server");
      setErrorRaw(String(err));
    }
  }

  return (
    <Protected role="ADMIN" redirectOnRoleMismatch="/tasks">
      <div className="w-full">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Admin Mask Catalog</h1>
            <p className={cn("mt-1 text-sm", theme.color.mutedText)}>
              Manage available masks (CRUD). This page does not trigger processing.
            </p>
          </div>

          <Button onClick={openAdd}>Add Mask</Button>
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
              <Loading label="Loading mask catalog..." />
            ) : (
              <>
                {/* Pagination toolbar */}
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" className="h-9 px-3" onClick={load}>
                      Refresh
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn("text-xs", theme.color.mutedText)}>
                      {total === 0 ? "0 items" : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, total)} of ${total}`}
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
                        <Button
                          variant="secondary"
                          className="h-9 px-3"
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
                          className="h-9 px-3"
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
                      <TH>Key</TH>
                      <TH>Display Name</TH>
                      <TH>Type</TH>
                      <TH>Active</TH>
                      <TH>Order</TH>
                      <TH className="text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {pageRows.length === 0 ? (
                      <TR>
                        <TD colSpan={6} className={cn("px-3 py-2 text-sm", theme.color.mutedText)}>
                          No mask catalog items found.
                        </TD>
                      </TR>
                    ) : (
                      pageRows.map((m) => (
                        <TR key={idOrKey(m)}  >
                          <TD>{m.key}</TD>
                          <TD>{m.display_name}</TD>
                          <TD>{m.processing_type}</TD>
                          <TD>{m.active ? "Yes" : "No"}</TD>
                          <TD>{String(m.sort_order ?? 0)}</TD>
                          <TD className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button variant="secondary" className="h-9 px-3" onClick={() => openEdit(m)}>
                                Edit
                              </Button>
                              <Button variant="secondary" className="h-9 px-3" onClick={() => deleteItem(m)}>
                                Delete
                              </Button>
                            </div>
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </>
            )}
          </div>
        </Card>

        {editor.open ? (
          <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", "bg-black/20")} role="dialog" aria-modal="true">
            <div className={cn("w-full max-w-lg")}>
              <Card>
                <div className="p-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">{editor.mode === "add" ? "Add Mask" : "Edit Mask"}</h2>
                    <p className={cn("mt-1 text-sm", theme.color.mutedText)}>
                      {editor.mode === "add" ? "Create a new mask catalog entry." : "Update the selected mask catalog entry."}
                    </p>
                  </div>

                  {editor.errorFriendly ? (
                    <div className="mb-4">
                      <ErrorBanner message={editor.errorFriendly} />
                      {editor.errorRaw ? (
                        <pre className={cn("mt-2 whitespace-pre-wrap text-xs", theme.color.mutedText)}>{editor.errorRaw}</pre>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <FormField label="Key" required>
                      <Input
                        value={editor.value.key}
                        onChange={(e) => setField("key", e.target.value)}
                        disabled={editor.saving || editor.mode === "edit"}
                        autoComplete="off"
                      />
                    </FormField>

                    <FormField label="Display Name" required>
                      <Input
                        value={editor.value.display_name}
                        onChange={(e) => setField("display_name", e.target.value)}
                        disabled={editor.saving}
                      />
                    </FormField>

                    <FormField label="Processing Type" required>
                      <Select
                        value={editor.value.processing_type ?? ""}
                        onChange={(e) => setField("processing_type", e.target.value as ProcessingType)}
                        disabled={editor.saving}
                      >
                        <option value="" disabled>
                          Select…
                        </option>

                        {PROCESSING_TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Active">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(editor.value.active)}
                            onChange={(e) => setField("active", e.target.checked)}
                            disabled={editor.saving}
                          />
                          <span className={cn("text-sm", theme.color.mutedText)}>{editor.value.active ? "Active" : "Inactive"}</span>
                        </label>
                      </FormField>

                      <FormField label="Sort Order">
                        <Input
                          type="number"
                          value={String(editor.value.sort_order ?? 0)}
                          onChange={(e) => setField("sort_order", Number(e.target.value))}
                          disabled={editor.saving}
                        />
                      </FormField>
                    </div>

                    <FormField label="Mask Prompt">
                      <textarea
                        value={editor.value.mask_prompt ?? ""}
                        onChange={(e) => setField("mask_prompt", e.target.value)}
                        disabled={editor.saving}
                        className={cn(
                          "w-full min-h-[84px] border px-3 py-2 text-sm",
                          theme.radius.md,
                          theme.color.border,
                          theme.color.surface,
                          theme.color.text,
                          theme.focus.base,
                          theme.focus.ring
                        )}
                      />
                    </FormField>

                    <FormField label="Negative Mask Prompt">
                      <textarea
                        value={editor.value.negative_mask_prompt ?? ""}
                        onChange={(e) => setField("negative_mask_prompt", e.target.value)}
                        disabled={editor.saving}
                        className={cn(
                          "w-full min-h-[84px] border px-3 py-2 text-sm",
                          theme.radius.md,
                          theme.color.border,
                          theme.color.surface,
                          theme.color.text,
                          theme.focus.base,
                          theme.focus.ring
                        )}
                      />
                    </FormField>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-2">
                    <Button variant="secondary" onClick={closeEditor} disabled={editor.saving}>
                      Cancel
                    </Button>
                    <Button onClick={saveEditor} disabled={editor.saving}>
                      {editor.saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </Protected>
  );
}
