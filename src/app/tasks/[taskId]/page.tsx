"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Table, TBody, TD, TH, THead, TR } from "@/ui/components/Table";
import { cn, theme } from "@/ui/theme";

import { ColorPickerRow, type PaletteColor } from "@/ui/components/ColorPickerRow";
import {
 
  fetchAsImageBitmap,
  normalizeHex,
} from "@/lib/canvasComposite";
import { loadPreviewState, savePreviewState, type PreviewLayerState } from "@/lib/localPreviewState";
import type { PaintSearchHit } from "@/ui/components/PaintColorTypeahead";

type TaskDTO = {
  task_id: string;
  name?: string | null;

  // backend uses processing_type, patch accepts task_type
  processing_type?: "INTERIOR" | "EXTERIOR" | string | null;
  task_type?: "INTERIOR" | "EXTERIOR" | string | null;

  status?: string | null;

  // backend uses these
  original_image_url?: string | null;
  original_image_local_path?: string | null;

  // legacy compatibility if present
  image_url?: string | null;
  image_path?: string | null;

  // Additional properties that may be present
  store_palette_colors?: any;
};

type MaskCatalogItem = {
  mask_catalog_id?: string | null;

  // backend returns `key` (required)
  key?: string | null;

  // keep legacy compatibility
  mask_id?: string | null;
  mask_key?: string | null;

  label?: string | null;
  display_name?: string | null;

  context?: "INTERIOR" | "EXTERIOR" | string | null;
  processing_type?: "INTERIOR" | "EXTERIOR" | string | null;
  type?: "INTERIOR" | "EXTERIOR" | string | null;

  description?: string | null;

  // some older catalog payloads include name
  name?: string | null;

  // Additional properties that may be present
  active?: boolean;
  sort_order?: number;
};

type TaskMaskDTO = {
  mask_key: string;
  status: string;
  failed_step?: "API1" | "API2" | null;
  error_message?: string | null;
};

// Preview functionality types
type PaletteColorItem = {
  id?: string | number;
  name?: string;
  hex: string;
};

type PaintMeta = {
  brand: string;
  name: string;
  code: string;
  hex: string; // normalized "#RRGGBB"
};

function getCatalogKey(m: MaskCatalogItem) {
  return (m.mask_key || m.key || m.mask_id || "").toString();
}

function upper(v?: string | null) {
  return (v || "").toUpperCase();
}

function isRunningStatus(status: string) {
  const s = upper(status);
  return s === "API1_RUNNING" || s === "API2_RUNNING";
}

function toUiStatus(status: string, errorMessage?: string | null) {
  const s = upper(status);

  if (s === "COMPLETED" || s === "SUCCEEDED") return "SUCCEEDED";
  if (s === "PENDING") return "PENDING";
  if (s === "API1_RUNNING") return "API1_RUNNING";
  if (s === "API2_RUNNING") return "API2_RUNNING";

  if (s.includes("FAILED")) {
    const msg = (errorMessage || "").toLowerCase();
    if (msg.includes("canceled by user") || msg.includes("cancelled by user")) return "CANCELED";
    return "FAILED";
  }

  if (s === "CANCELED" || s === "CANCELLED") return "CANCELED";
  return s || "—";
}

function taskTypeLabel(t?: string | null) {
  const s = upper(t);
  if (s === "INTERIOR") return "Interior";
  if (s === "EXTERIOR") return "Exterior";
  return s || "—";
}

function stripHash(hex: string) {
  return (hex || "").replace("#", "").trim();
}

function isCompleted(status: string) {
  const s = upper(status);
  return s === "COMPLETED" || s === "SUCCEEDED";
}

function imageExistsFromTask(task: TaskDTO | null) {
  if (!task) return false;

  if (task.original_image_url || task.original_image_local_path) return true;
  if (task.image_url || task.image_path) return true;

  const s = upper(task.status);
  if (s === "IMAGE_UPLOADED" || s === "PROCESSING" || s === "READY_FOR_PREVIEW") return true;

  return false;
}

function getMaskDisplayName(m: MaskCatalogItem) {
  return m.label || m.display_name || m.name || m.mask_key || "Unnamed mask";
}

function getMaskContext(m: MaskCatalogItem) {
  return upper(m.context || m.processing_type || "");
}

export default function TaskProcessingPage() {
  const router = useRouter();
  const params = useParams();

  const taskId = Array.isArray(params?.taskId) ? params.taskId[0] : (params?.taskId as string | undefined);
  const missingTaskId = !taskId || taskId === "undefined";

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDTO | null>(null);

  // Task name: avoid “poll stomps my typing”
  const [taskNameDraft, setTaskNameDraft] = useState("");
  const [isEditingTaskName, setIsEditingTaskName] = useState(false);
  const [isTaskNameDirty, setIsTaskNameDirty] = useState(false);
  const isEditingTaskNameRef = useRef(false);
  const isTaskNameDirtyRef = useRef(false);

  useEffect(() => {
    isEditingTaskNameRef.current = isEditingTaskName;
  }, [isEditingTaskName]);

  useEffect(() => {
    isTaskNameDirtyRef.current = isTaskNameDirty;
  }, [isTaskNameDirty]);

  const [catalog, setCatalog] = useState<MaskCatalogItem[]>([]);
  const [taskMasks, setTaskMasks] = useState<TaskMaskDTO[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  // ----- Preview state -----
  const [livePreview, setLivePreview] = useState(true);
  const [draftColors, setDraftColors] = useState<Record<string, string | null>>({});
  const [appliedColors, setAppliedColors] = useState<Record<string, string | null>>({});

  // ----- Asset caches -----
  const originalBitmapRef = useRef<ImageBitmap | null>(null);
  const maskBitmapsRef = useRef<Record<string, ImageBitmap>>({});
  const tintedCanvasesRef = useRef<Record<string, HTMLCanvasElement | string>>({});

  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const beforeImgRef = useRef<HTMLImageElement | null>(null);
  const beforeObjectUrlRef = useRef<string | null>(null);

  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // repaint output
  const [repaintUrl, setRepaintUrl] = useState<string | null>(null);
  const [repaintMsg, setRepaintMsg] = useState<string | null>(null);
  const [repainting, setRepainting] = useState(false);

  // historical repaints
  const [historicalRepaints, setHistoricalRepaints] = useState<Array<{repaint_id: string, final_image_url: string, created_at: string, score?: number | null}>>([]);
  const [selectedHistoricalRepaint, setSelectedHistoricalRepaint] = useState<string | null>(null);

  // paint label shown in typeahead input: "CODE NAME"
  const [paintTextByMask, setPaintTextByMask] = useState<Record<string, string>>({});

  // store paint meta per mask (brand/name/code/hex) so we can call repaint API correctly
  const [paintMetaByMask, setPaintMetaByMask] = useState<Record<string, PaintMeta | null>>({});

  // polling control
  const pollStopRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // backend uses processing_type, patch accepts task_type; support both on read
  const processingType = upper((task as any)?.processing_type ?? (task as any)?.task_type) as "INTERIOR" | "EXTERIOR" | "";
  const imageExists = imageExistsFromTask(task);

  // ----- Image preview (via Next proxy route) -----
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const lastImageSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;

    async function loadImage() {
      if (!imageExists) {
        if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
        setImageObjectUrl(null);
        lastImageSigRef.current = null;
        return;
      }

      const sig =
        task?.original_image_url ||
        task?.original_image_local_path ||
        task?.image_url ||
        task?.image_path ||
        task?.status ||
        "image";

      if (lastImageSigRef.current === sig) return;

      try {
        const res = await fetchWithAuth(`/api/tasks/${taskId}/assets/original`, {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) return;

        const blob = await res.blob();
        if (cancelled) return;

        const obj = URL.createObjectURL(blob);

        if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);

        setImageObjectUrl(obj);
        lastImageSigRef.current = sig;
      } catch {
        // don’t break page if image fails
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    taskId,
    imageExists,
    task?.original_image_url,
    task?.original_image_local_path,
    task?.image_url,
    task?.image_path,
    task?.status,
  ]);

  // ---------------------------
  // Preview derived state
  // ---------------------------
  const palette: PaletteColor[] = useMemo(() => {
    const raw = task?.store_palette_colors;
    if (!raw || !Array.isArray(raw)) return [];

    const out: PaletteColor[] = [];
    for (const it of raw) {
      if (typeof it === "string") {
        const hex = normalizeHex(it);
        if (!hex) continue;
        out.push({ id: hex, name: hex, hex });
      } else if (it && typeof it === "object") {
        const hex = normalizeHex(it.hex || "");
        if (!hex) continue;
        out.push({
          id: String(it.id || it.name || hex),
          name: String(it.name || hex),
          hex,
        });
      }
    }
    return out;
  }, [task]);

  // For preview, we'll create a simple mask list - all masks are "completed" for direct painting
  const completedMasks = useMemo(() => {
    const items = catalog
      .filter((m) => m.active !== false)
      .map((m) => {
        const key = getCatalogKey(m);
        return {
          task_mask_id: key, // dummy ID
          mask_key: key,
          display_name: m.display_name || m.name || key,
          sort_order: m.sort_order ?? 9999,
          status: "COMPLETED", // Always completed for direct painting
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name));

    return { items };
  }, [catalog]);
  // Load bitmaps (original + masks) for preview
  // ---------------------------
  useEffect(() => {
    if (!taskId) return;
    if (loading) return;
    if (!imageExists) return;

    let cancelled = false;
    async function loadBitmaps() {
      try {
        // Original
        if (!originalBitmapRef.current) {
          const orig = await fetchAsImageBitmap(fetchWithAuth, `/api/tasks/${taskId}/assets/original`);
          if (cancelled) return;
          originalBitmapRef.current = orig;

          // also set Before <img> URL
          const res = await fetchWithAuth(`/api/tasks/${taskId}/assets/original`, { cache: "no-store" });
          if (!res.ok) throw new Error(await res.text());
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (beforeObjectUrlRef.current) URL.revokeObjectURL(beforeObjectUrlRef.current);
          beforeObjectUrlRef.current = url;
          if (beforeImgRef.current) beforeImgRef.current.src = url;
        }

        // For direct painting, we'll create simple mask bitmaps or skip mask loading
        // Since we're doing direct repaint without masks, we might not need mask bitmaps
        renderComposite();
      } catch (e: unknown) {
        console.error(e);
        // Don't set error for bitmap loading failures in preview mode
      }
    }

    loadBitmaps();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, loading, imageExists]);

  // ---------------------------
  // Persist local preview state
  // ---------------------------
  useEffect(() => {
    if (!taskId) return;
    const layers: Record<string, PreviewLayerState> = {};
    for (const k of Object.keys(appliedColors)) {
      layers[k] = { maskKey: k, color: appliedColors[k] };
    }
    savePreviewState(taskId, { livePreview, layers });
  }, [taskId, livePreview, appliedColors]);

  // ---------------------------
  // Rendering helpers
  // ---------------------------
  function renderComposite() {
    const canvas = afterCanvasRef.current;
    const original = originalBitmapRef.current;
    if (!canvas || !original) return;

    // For direct painting without masks, we'll just show the original image
    // with any applied color overlays if we implement mask-based painting later
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = original.width;
    canvas.height = original.height;
    ctx.drawImage(original, 0, 0);
  }

  function applyOne(maskKey: string) {
    setAppliedColors((prev) => ({ ...prev, [maskKey]: draftColors[maskKey] ?? null }));
  }

  async function clearPaintSelection(maskKey: string) {
    setPaintTextByMask((prev) => ({ ...prev, [maskKey]: "" }));
    setPaintMetaByMask((prev) => ({ ...prev, [maskKey]: null }));
  }

  function resetOne(maskKey: string) {
    setPaintTextByMask((prev) => ({ ...prev, [maskKey]: "" }));
    setPaintMetaByMask((prev) => ({ ...prev, [maskKey]: null }));
    setDraftColors((prev) => ({ ...prev, [maskKey]: null }));
    setAppliedColors((prev) => ({ ...prev, [maskKey]: null }));
  }

  // live preview: whenever draft changes, apply immediately
  useEffect(() => {
    if (!livePreview) return;
    setAppliedColors(draftColors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePreview, draftColors]);

  useEffect(() => {
    renderComposite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedColors]);

  // ---------------------------
  // Save composite
  // ---------------------------
  async function onSave() {
    if (!taskId) return;
    const canvas = afterCanvasRef.current;
    if (!canvas) return;

    setSaving(true);
    setSaveMsg(null);

    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (!b) reject(new Error("Failed to export PNG"));
          else resolve(b);
        }, "image/png");
      });

      const fd = new FormData();
      fd.append("file", blob, "final.png");

      const res = await fetchWithAuth(`/api/tasks/${taskId}/save-composite`, {
        method: "POST",
        body: fd,
      });

      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(text || "Save failed");

      setSaveMsg("Saved successfully");
      setSavedUrl(`/api/tasks/${taskId}/assets/final`);
    } catch (e: unknown) {
      console.error(e);
      setSaveMsg(null);
      setErrorFriendly("Save failed");
      setErrorRaw(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------
  // Load Historical Repaints
  // ---------------------------
  async function loadHistoricalRepaints() {
    if (!taskId) return;
    
    try {
      const res = await fetchWithAuth(`/api/tasks/${taskId}/repaints`);
      if (!res.ok) {
        console.error('Failed to load historical repaints');
        return;
      }
      const data = await res.json();
      setHistoricalRepaints(data);
      setSelectedHistoricalRepaint(null);
    } catch (err) {
      console.error('Failed to load historical repaints:', err);
    }
  }

  // ---------------------------
  // Rate Historical Repaint
  // ---------------------------
  async function rateHistoricalRepaint(repaintId: string, score: number) {
    if (!taskId) return;

    try {
      const res = await fetchWithAuth(`/api/tasks/${taskId}/repaints/${repaintId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score }),
      });

      if (!res.ok) {
        console.error('Failed to rate historical repaint');
        return;
      }

      // Update the local state
      setHistoricalRepaints(prev => prev.map(r => 
        r.repaint_id === repaintId ? { ...r, score } : r
      ));
    } catch (err) {
      console.error('Failed to rate historical repaint:', err);
    }
  }

  // ---------------------------
  // Delete Historical Repaint
  // ---------------------------
  async function deleteHistoricalRepaint(repaintId: string) {
    if (!taskId) return;

    const ok = confirm("Delete this repaint result permanently?");
    if (!ok) return;

    try {
      const res = await fetchWithAuth(`/api/tasks/${taskId}/repaints?repaint_id=${encodeURIComponent(repaintId)}`, { method: "DELETE" });
      if (!res.ok) {
        console.error('Failed to delete historical repaint');
        return;
      }
      // Remove from state
      setHistoricalRepaints(prev => prev.filter(r => r.repaint_id !== repaintId));
      // If the deleted one was selected, reset to latest
      if (selectedHistoricalRepaint === repaintId) {
        setSelectedHistoricalRepaint(null);
      }
    } catch (err) {
      console.error('Failed to delete historical repaint:', err);
    }
  }

  async function onRepaint() {
    if (!taskId) return;

    setRepainting(true);
    setRepaintMsg(null);
    setRepaintUrl(null);
    setErrorFriendly(null);
    setErrorRaw(null);

    try {
      // Build items from CURRENT applied colors (what user sees)
      const items: Array<{ mask_key: string; brand: string; name: string; hex: string }> = [];

      for (const m of completedMasks.items) {
        const key = m.mask_key;
        const hex = normalizeHex(appliedColors[key] || "");
        if (!hex) continue;

        const meta = paintMetaByMask[key];
        const brand = meta?.brand?.trim() || "CUSTOM";
        const name = meta?.name?.trim() || "Custom";

        items.push({
          mask_key: key,
          brand,
          name,
          hex,
        });
      }

      if (items.length === 0) {
        throw new Error("Pick at least one color before repaint.");
      }

      // Start async repaint (avoids long-running proxy timeouts; backend does the work in background)
      const startRes = await fetchWithAuth(`/api/tasks/${taskId}/repaint/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const startText = await startRes.text().catch(() => "");

      if (!startRes.ok) {
        let parsed: unknown = null;
        try {
          parsed = startText ? JSON.parse(startText) : null;
        } catch {
          parsed = null;
        }

        let friendly = "Repaint failed";
        if (startRes.status === 500) friendly = "Server error occurred during repaint.";

        if (parsed && typeof parsed === "object") {
          if ("detail" in parsed) {
            const detail = (parsed as { detail: unknown }).detail;
            if (typeof detail === "string" && detail) friendly = detail;
          } else if ("message" in parsed) {
            const message = (parsed as { message: unknown }).message;
            if (typeof message === "string" && message) friendly = message;
          } else if ("error" in parsed) {
            const error = (parsed as { error: unknown }).error;
            if (typeof error === "string" && error) friendly = error;
          }
        }

        setErrorFriendly(friendly);
        setErrorRaw(
          parsed && typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : (startText || `HTTP ${startRes.status}`)
        );
        return;
      }

      let startJson: { repaint_run_id?: string; status?: string; message?: string } = {};
      try {
        startJson = startText ? JSON.parse(startText) : {};
      } catch {
        startJson = {};
      }

      const runId = startJson.repaint_run_id;
      if (!runId) {
        setErrorFriendly("AI repaint failed");
        setErrorRaw("Missing repaint_run_id from server");
        return;
      }

      setRepaintMsg(startJson.message || "AI repaint started.");

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const startedAt = Date.now();
      const maxMs = 20 * 60 * 1000;

      while (Date.now() - startedAt < maxMs) {
        await sleep(2000);

        const stRes = await fetchWithAuth(`/api/tasks/${taskId}/repaint/status/${encodeURIComponent(runId)}`, {
          method: "GET",
          cache: "no-store",
        });

        const stText = await stRes.text().catch(() => "");
        if (!stRes.ok) {
          if (stRes.status === 404) {
            setErrorFriendly("AI repaint failed");
            setErrorRaw("Repaint run not found (404)");
            return;
          }
          continue;
        }

        let stJson: {
          status?: string;
          message?: string;
          final_legend_image_url?: string | null;
          replicate_status?: string | null;
        } = {};
        try {
          stJson = stText ? JSON.parse(stText) : {};
        } catch {
          stJson = {};
        }

        const st = (stJson.status || "").toLowerCase();
        const msg = stJson.message || (stJson.replicate_status ? `Replicate: ${stJson.replicate_status}` : null);
        if (msg) setRepaintMsg(msg);

        if (st === "succeeded" || st === "success" || st === "done") {
          const url = stJson.final_legend_image_url || null;
          if (url) setRepaintUrl(url);
          await loadHistoricalRepaints();
          setSelectedHistoricalRepaint(null);
          return;
        }

        if (st === "failed" || st === "error" || st === "canceled" || st === "cancelled") {
          setErrorFriendly(stJson.message || "AI repaint failed");
          setErrorRaw(stText || "failed");
          return;
        }
      }

      setErrorFriendly("AI repaint still running");
      setErrorRaw("Polling timed out in UI (backend may still complete). Refresh to see saved result.");
    } catch (e: unknown) {
      console.error(e);
      setRepaintMsg(null);
      setErrorFriendly("AI repaint failed");
      setErrorRaw(e instanceof Error ? e.message : String(e));
    } finally {
      setRepainting(false);
    }
  }

  const hasAnyRenderable = useMemo(() => {
    for (const m of completedMasks.items) {
      const c = appliedColors[m.mask_key];
      if (normalizeHex(c || "")) return true;
    }
    return false;
  }, [completedMasks.items, appliedColors]);

  // Map task masks by key for quick lookup
  const taskMaskByKey = useMemo(() => {
    const m = new Map<string, TaskMaskDTO>();
    for (const tm of taskMasks) m.set(tm.mask_key, tm);
    return m;
  }, [taskMasks]);

  // Catalog filtered by task type (LOCKED)
  const filteredCatalog = useMemo(() => {
    if (!processingType) return [];
    return catalog.filter((c) => getMaskContext(c) === processingType);
  }, [catalog, processingType]);

  // Visible selected masks are those in filtered catalog only
  const visibleSelectedKeys = useMemo(() => {
    const allowed = new Set(filteredCatalog.map((c) => getCatalogKey(c)).filter(Boolean) as string[]);
    return selectedKeys.filter((k) => allowed.has(k));
  }, [selectedKeys, filteredCatalog]);

  // Running definition (LOCKED): any SELECTED mask is API1_RUNNING or API2_RUNNING
  const anySelectedRunning = useMemo(() => {
    for (const k of visibleSelectedKeys) {
      const tm = taskMaskByKey.get(k);
      if (tm && isRunningStatus(tm.status)) return true;
    }
    return false;
  }, [visibleSelectedKeys, taskMaskByKey]);

  // “processing is running” for polling purposes:
  const anyRunningInTaskMasks = useMemo(() => {
    return taskMasks.some((m) => isRunningStatus(m.status));
  }, [taskMasks]);

  const anySelectedFailedOrCanceled = useMemo(() => {
    for (const k of visibleSelectedKeys) {
      const tm = taskMaskByKey.get(k);
      if (!tm) continue;
      const ui = toUiStatus(tm.status, tm.error_message);
      if (ui === "FAILED" || ui === "CANCELED") return true;
    }
    return false;
  }, [visibleSelectedKeys, taskMaskByKey]);

  const allSelectedSucceeded = useMemo(() => {
    if (visibleSelectedKeys.length === 0) return false;
    for (const k of visibleSelectedKeys) {
      const tm = taskMaskByKey.get(k);
      if (!tm) return false;
      if (toUiStatus(tm.status, tm.error_message) !== "SUCCEEDED") return false;
    }
    return true;
  }, [visibleSelectedKeys, taskMaskByKey]);

  // Auto redirect to preview only when ALL selected succeed and none failed/canceled (LOCKED)
  // REMOVED: No longer redirecting to preview - functionality merged here

  // If task type changes: auto-unselect non-matching masks (LOCKED)
  useEffect(() => {
    if (!processingType) return;
    const allowed = new Set(filteredCatalog.map((c) => getCatalogKey(c)).filter(Boolean) as string[]);
    // Also filter out inactive masks
    const activeMasks = new Set(catalog.filter((m) => m.active !== false).map((m) => getCatalogKey(m)).filter(Boolean) as string[]);
    setSelectedKeys((prev) => prev.filter((k) => allowed.has(k) && activeMasks.has(k)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingType, catalog]);

  async function fetchTaskOnce() {
    const res = await fetchWithAuth(`/api/tasks/${taskId}`, { cache: "no-store" });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      throw new Error(`GET /api/tasks/${taskId} failed: ${res.status} ${raw}`);
    }
    return (await res.json()) as TaskDTO;
  }

  async function fetchCatalogOnce(type?: string) {
    const qsParts: string[] = [];
    if (type) qsParts.push(`processing_type=${encodeURIComponent(type)}`);
    const qs = qsParts.length ? `?${qsParts.join("&")}` : "";

    const res = await fetchWithAuth(`/api/tasks/mask-catalog${qs}`, { cache: "no-store" });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      throw new Error(`GET /api/tasks/mask-catalog failed: ${res.status} ${raw}`);
    }
    return (await res.json()) as MaskCatalogItem[];
  }

  async function fetchTaskMasksOnce() {
    const res = await fetchWithAuth(`/api/tasks/${taskId}/masks`, { cache: "no-store" });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      throw new Error(`GET /api/tasks/${taskId}/masks failed: ${res.status} ${raw}`);
    }
    return (await res.json()) as TaskMaskDTO[];
  }

  async function refreshTaskAndMasks({ allowStompDraft = false } = {}) {
    const [t, masks] = await Promise.all([fetchTaskOnce(), fetchTaskMasksOnce()]);
    setTask(t);

    if (allowStompDraft || (!isEditingTaskNameRef.current && !isTaskNameDirtyRef.current)) {
      setTaskNameDraft(t.name || "");
      setIsTaskNameDirty(false);
    }

    setTaskMasks(masks);
  }

  // 1) Initial load ONCE (no polling loop)
  useEffect(() => {
    if (missingTaskId) return;

    let cancelled = false;

    async function loadOnce() {
      try {
        setErrorFriendly(null);
        setErrorRaw(null);

        const t = await fetchTaskOnce();
        if (cancelled) return;

        setTask(t);
        setTaskNameDraft(t.name || "");
        setIsTaskNameDirty(false);

        const type = upper((t as any)?.processing_type ?? (t as any)?.task_type) || undefined;

        const cat = await fetchCatalogOnce(type);
        if (cancelled) return;
        setCatalog(cat);

        const masks = await fetchTaskMasksOnce();
        if (cancelled) return;
        setTaskMasks(masks);

        // If masks already exist (user came back), preselect them
        setSelectedKeys((prev) => (prev.length ? prev : masks.map((x) => x.mask_key)));

        // Load historical repaints
        await loadHistoricalRepaints();

        setLoading(false);
      } catch (err) {
        console.error(err);
        setErrorFriendly("Cannot load processing data");
        setErrorRaw(String(err));
        setLoading(false);
      }
    }

    loadOnce();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, missingTaskId]);

  // 2) Fetch catalog when task type changes (no polling)
  useEffect(() => {
    if (missingTaskId) return;
    if (!processingType) return;

    let cancelled = false;

    async function loadCatalogForType() {
      try {
        const cat = await fetchCatalogOnce(processingType);
        if (cancelled) return;
        setCatalog(cat);
      } catch (err) {
        console.error(err);
      }
    }

    loadCatalogForType();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingType, taskId, missingTaskId]);

  // 3) Poll ONLY while processing is running
  useEffect(() => {
    if (missingTaskId) return;
    if (!anyRunningInTaskMasks) return;

    pollStopRef.current = false;

    async function tick() {
      if (pollStopRef.current) return;

      try {
        setErrorFriendly(null);
        setErrorRaw(null);

        await refreshTaskAndMasks();
        setLoading(false);
      } catch (err) {
        console.error(err);
        setErrorFriendly("Cannot refresh processing status");
        setErrorRaw(String(err));
        setLoading(false);
      } finally {
        pollTimerRef.current = setTimeout(tick, 5000);
      }
    }

    tick();

    return () => {
      pollStopRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, missingTaskId, anyRunningInTaskMasks]);

  const uiErrorFriendly = missingTaskId ? "Something went wrong" : errorFriendly;
  const uiErrorRaw = missingTaskId ? "Missing taskId in route params. Expected URL: /tasks/{taskId}" : errorRaw;

  const canEditType = !anySelectedRunning;
  const canEditMaskSelection = !anySelectedRunning;

  const startEnabled = imageExists && visibleSelectedKeys.length > 0 && !anySelectedRunning;
  const cancelVisible = anySelectedRunning;
  const retryDisabled = anySelectedRunning;

  async function saveTaskName() {
    if (!taskId) return;
    try {
      setErrorFriendly(null);
      setErrorRaw(null);

      const res = await fetchWithAuth(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: taskNameDraft }),
        cache: "no-store",
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(`PATCH /api/tasks/${taskId} failed: ${res.status} ${raw}`);
      }

      const updated = (await res.json()) as TaskDTO;

      setTask(updated);
      setTaskNameDraft(updated.name || "");
      setIsTaskNameDirty(false);
    } catch (err) {
      console.error(err);
      setErrorFriendly("Failed to update task name");
      setErrorRaw(String(err));
    }
  }

  async function changeTaskType(next: "INTERIOR" | "EXTERIOR" | "") {
    console.log('changeTaskType called with:', next, 'canEditType:', canEditType);
    if (!taskId) {
      console.log('No taskId, returning');
      return;
    }
    if (!canEditType) {
      console.log('canEditType is false, returning');
      return;
    }
  if (next == "") {
      console.log('empty value , returning');
      return;
    }

    try {
      console.log('Making API call to update task type');
      setErrorFriendly(null);
      setErrorRaw(null);

      const res = await fetchWithAuth(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task_type: next }),
        cache: "no-store",
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(`PATCH /api/tasks/${taskId} failed: ${res.status} ${raw}`);
      }

      const updated = (await res.json()) as TaskDTO;
      console.log('Task updated:', updated);
      setTask(updated);

      const cat = await fetchCatalogOnce(next);
      console.log('Catalog fetched:', cat.length, 'items');
      setCatalog(cat);
    } catch (err) {
      console.error('Error in changeTaskType:', err);
      setErrorFriendly("Failed to update task type");
      setErrorRaw(String(err));
    }
  }

  function toggleMask(maskKey: string) {
    if (!canEditMaskSelection) return;

    setSelectedKeys((prev) => {
      if (prev.includes(maskKey)) return prev.filter((k) => k !== maskKey);
      return [...prev, maskKey];
    });
  }

  async function startProcessing() {
    if (!taskId) return;
    if (!startEnabled) return;

    try {
      saveTaskName();
      setErrorFriendly(null);
      setErrorRaw(null);

      // If selected masks are FAILED/CANCELED, retry them instead of create-task-masks
      if (anySelectedFailedOrCanceled) {
        // retry only the ones that are failed/canceled
        for (const k of visibleSelectedKeys) {
          const tm = taskMaskByKey.get(k);
          if (!tm) continue;
          const ui = toUiStatus(tm.status, tm.error_message);
          if (ui !== "FAILED" && ui !== "CANCELED") continue;

          const res = await fetchWithAuth(
            `/api/tasks/${taskId}/masks/${encodeURIComponent(k)}/retry`,
            { method: "POST", cache: "no-store" }
          );

          if (!res.ok) {
            const raw = await res.text().catch(() => "");
            throw new Error(`POST /api/tasks/${taskId}/masks/${k}/retry failed: ${res.status} ${raw}`);
          }
        }

        await refreshTaskAndMasks({ allowStompDraft: false });
        return;
      }

      // Normal path: create missing masks + start API1
      const res = await fetchWithAuth(`/api/tasks/${taskId}/create-task-masks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mask_keys: visibleSelectedKeys }),
        cache: "no-store",
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(`POST /api/tasks/${taskId}/create-task-masks failed: ${res.status} ${raw}`);
      }

      await refreshTaskAndMasks({ allowStompDraft: false });
    } catch (err) {
      console.error(err);
      setErrorFriendly("Failed to start processing");
      setErrorRaw(String(err));
    }
  }
  async function cancelProcessing() {
    if (!taskId) return;

    try {
      setErrorFriendly(null);
      setErrorRaw(null);

      const res = await fetchWithAuth(`/api/tasks/${taskId}/cancel`, {
        method: "POST",
        cache: "no-store",
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(`POST /api/tasks/${taskId}/cancel failed: ${res.status} ${raw}`);
      }

      await refreshTaskAndMasks({ allowStompDraft: false });
    } catch (err) {
      console.error(err);
      setErrorFriendly("Failed to cancel processing");
      setErrorRaw(String(err));
    }
  }

  async function retryMask(maskKey: string) {
    if (!taskId) return;
    if (retryDisabled) return;

    try {
      setErrorFriendly(null);
      setErrorRaw(null);

      const res = await fetchWithAuth(`/api/tasks/${taskId}/masks/${encodeURIComponent(maskKey)}/retry`, {
        method: "POST",
        cache: "no-store",
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(`POST /api/tasks/${taskId}/masks/${maskKey}/retry failed: ${res.status} ${raw}`);
      }

      await refreshTaskAndMasks({ allowStompDraft: false });
    } catch (err) {
      console.error(err);
      setErrorFriendly("Failed to retry mask");
      setErrorRaw(String(err));
    }
  }

  const selectedMaskRows = useMemo(() => {
    const catByKey = new Map(
      filteredCatalog.filter((c) => !!getCatalogKey(c)).map((c) => [getCatalogKey(c) as string, c])
    );

    return visibleSelectedKeys
      .map((k) => {
        const cat = catByKey.get(k);
        const tm = taskMaskByKey.get(k);
        return { key: k, cat, tm };
      })
      .filter((x) => !!x.cat);
  }, [visibleSelectedKeys, filteredCatalog, taskMaskByKey]);

  // Build single-cell lines for processing status (name + status + error + retry)
  const statusLines = useMemo(() => {
    return selectedMaskRows.map(({ key, cat, tm }) => {
      const name = cat ? getMaskDisplayName(cat) : key;
      const uiStatus = tm ? toUiStatus(tm.status, tm.error_message) : "PENDING";
      const isFailed = uiStatus === "FAILED";
      const isCanceled = uiStatus === "CANCELED";
      const failedStep = tm?.failed_step ?? null;
      const errMsg = tm?.error_message ?? null;

      return {
        key,
        name,
        uiStatus,
        isFailed,
        isCanceled,
        failedStep,
        errMsg,
      };
    });
  }, [selectedMaskRows]);

  return (
    <Protected roles={["USER", "ADMIN"]}>
      <div className="w-full">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{imageExists ? "Paint Editor" : "Processing Setup"}</h1>
            <p className={cn("mt-1 text-sm", theme.color.mutedText)}>
              {imageExists 
                ? "Select colors and paint your image directly.  "
                : "Configure task and upload image to start painting."
              }
            </p>
          </div>

          <Link href="/tasks">
            <Button variant="secondary">Back to tasks</Button>
          </Link>
        </div>

        {uiErrorFriendly ? (
          <div className="mb-4">
            <ErrorBanner message={uiErrorFriendly} />
            {uiErrorRaw ? (
              <pre className={cn("mt-2 whitespace-pre-wrap text-xs", theme.color.mutedText)}>{uiErrorRaw}</pre>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <Card>
            <div className="p-4">
              <Loading label="Loading task..." />
            </div>
          </Card>
        ) : imageExists ? (
          // PAINT EDITOR MODE: Show color picker and canvas
          <div className="flex w-full min-w-0 gap-4">
            {/* LEFT PANEL: Color Picker */}
            <div className="min-w-0 flex-[0_0_360px] max-w-[360px] flex flex-col gap-4">
              {/* TOP: Task Configuration Card */}
              <Card>
                <div className="p-4">
                  
                  <div className="space-y-3 pl-[10px]">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={taskNameDraft}
                        onChange={(e) => {
                          setTaskNameDraft(e.target.value);
                          setIsTaskNameDirty(true);
                        }}
                        className="w-[290px] px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Enter task name"
                      />
                    
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        value={processingType}
                        onChange={(e) => changeTaskType(e.target.value as "INTERIOR" | "EXTERIOR")}
                        disabled={!canEditType}
                        className="w-[290px] px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Type</option>
                        <option value="INTERIOR">Interior</option>
                        <option value="EXTERIOR">Exterior</option>
                      </select>
                    </div>
                  </div>
                </div>
              </Card>

              {/* MASKS CARD */}

              {processingType === "" ? (
                  <div className="p-4 text-sm text-gray-500">
                    Select Type to load elements
                  </div>
                ) : (

              <Card className="h-auto w-full flex-1 max-h-[780px] ">
                <div className="flex max-h-[780px] flex-col overflow-hidden">
                  {/* keep original hidden image ref */}
                  <img ref={beforeImgRef} alt="Before" className="hidden" />

                  {/* TABLE HEADER + BODY */}
                  <div className="px-3 py-2">
                    <Table className="table-fixed">
                      <THead>
                        <TR>
                          <TH className="w-[200px]">Element</TH>
                          <TH>Palette(Reference)</TH>
                        </TR>
                      </THead>
                    </Table>
                  </div>

                  {/* Scrollable body */}
                  <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
                    <Table className="w-full table-fixed">
                      <TBody>
                        {completedMasks.items.length === 0 ? (
                          <TR>
                            <TD colSpan={3} className="py-3 text-sm text-neutral-600">
                              No masks available.
                            </TD>
                          </TR>
                        ) : (
                          completedMasks.items.map((m) => (
                            <ColorPickerRow
                              key={m.mask_key}
                              title={m.display_name}
                              palette={palette}
                              livePreview={livePreview}
                              draftColor={draftColors[m.mask_key] ?? null}
                              appliedColor={appliedColors[m.mask_key] ?? null}
                              paintText={paintTextByMask[m.mask_key] || ""}
                              onPaintPick={async (hit: PaintSearchHit) => {
                                const pickedHex = normalizeHex(hit.hex) || null;

                                setPaintTextByMask((prev) => ({
                                  ...prev,
                                  [m.mask_key]: `${hit.code} ${hit.name}`,
                                }));

                                if (pickedHex) {
                                  setPaintMetaByMask((prev) => ({
                                    ...prev,
                                    [m.mask_key]: {
                                      brand: hit.brand,
                                      name: hit.name,
                                      code: hit.code,
                                      hex: pickedHex,
                                    },
                                  }));
                                  setDraftColors((prev) => ({ ...prev, [m.mask_key]: pickedHex }));
                                } else {
                                  setPaintMetaByMask((prev) => ({ ...prev, [m.mask_key]: null }));
                                }
                              }}
                              onDraftColorChange={async (next) => {
                                setDraftColors((prev) => ({ ...prev, [m.mask_key]: next }));

                                const nextHex = normalizeHex(next || "") || null;

                                if (!nextHex) {
                                  await clearPaintSelection(m.mask_key);
                                  return;
                                }

                                // EXACT MATCH ONLY
                                try {
                                  const q = stripHash(nextHex); // "RRGGBB"
                                  const res = await fetchWithAuth(`/api/paint/search?q=${encodeURIComponent(q)}&limit=10`);
                                  if (!res.ok) {
                                    await clearPaintSelection(m.mask_key);
                                    return;
                                  }

                                  const hits = (await res.json()) as PaintSearchHit[];
                                  const exact = Array.isArray(hits)
                                    ? hits.find((h) => normalizeHex(h?.hex || "") === nextHex)
                                    : undefined;

                                  if (!exact) {
                                    await clearPaintSelection(m.mask_key);
                                    return;
                                  }

                                  setPaintTextByMask((prev) => ({
                                    ...prev,
                                    [m.mask_key]: `${exact.code} ${exact.name}`,
                                  }));

                                  setPaintMetaByMask((prev) => ({
                                    ...prev,
                                    [m.mask_key]: {
                                      brand: exact.brand,
                                      name: exact.name,
                                      code: exact.code,
                                      hex: nextHex,
                                    },
                                  }));
                                } catch (e) {
                                  console.error("Exact-hex paint search failed:", e);
                                  await clearPaintSelection(m.mask_key);
                                }
                              }}
                              onReset={() => resetOne(m.mask_key)}
                              compact
                              tableRow
                            />
                          ))
                        )}
                      </TBody>
                    </Table>
                  </div>
                </div>
              </Card>


                      )}

            </div>

            {/* RIGHT PANEL: Canvas */}
            <div className="min-w-0 flex-1">
              <Card className="h-auto w-full max-w-[700px] mx-auto">
                <div className="flex h-full flex-col p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium" />
                  </div>

                  <div className="min-h-0 flex overflow-auto rounded bg-white">
                    <canvas ref={afterCanvasRef} className="block h-auto w-full max-w-[700px] mx-auto" />
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button onClick={onRepaint} disabled={repainting || !hasAnyRenderable}>
                      {repainting ? "Repainting..." : "AI Repaint"}
                    </Button>

                    <Button 
                      onClick={() => {
                        // Save task name and type changes
                        if (isTaskNameDirty) {
                          saveTaskName();
                        }
                        // Type changes are auto-saved when changed
                      }}
                      disabled={!isTaskNameDirty}
                      variant="secondary"
                    >
                      Save Changes
                    </Button>

                    {saveMsg ? (
                      <div className="text-sm text-green-600">{saveMsg}</div>
                    ) : null}

                    {repaintMsg ? (
                      <div className="text-sm text-blue-600">{repaintMsg}</div>
                    ) : null}
                  </div>

                  {/* Repaint Result Display */}
                  <div className="mt-4">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="text-sm font-medium">Repaint Results:</div>
                      <select
                        value={selectedHistoricalRepaint || 'latest'}
                        onChange={(e) => setSelectedHistoricalRepaint(e.target.value === 'latest' ? null : e.target.value)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded"
                        disabled={historicalRepaints.length === 0}
                      >
                        <option value="latest">Latest Result</option>
                        {historicalRepaints.map((repaint, index) => (
                          <option key={repaint.repaint_id || `repaint-${index}`} value={repaint.repaint_id}>
                            {new Date(repaint.created_at).toLocaleString()}
                            {repaint.score ? ` (★ ${repaint.score}/5)` : ' (Un-rated)'}
                          </option>
                        ))}
                      </select>
                      
                      {/* Rating Controls */}
                      {selectedHistoricalRepaint && selectedHistoricalRepaint !== 'latest' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Rate:</span>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => rateHistoricalRepaint(selectedHistoricalRepaint, star)}
                              className={`text-lg ${
                                (historicalRepaints.find(r => r.repaint_id === selectedHistoricalRepaint)?.score || 0) >= star
                                  ? 'text-yellow-400'
                                  : 'text-gray-300'
                              } hover:text-yellow-400 transition-colors`}
                            >
                              ★
                            </button>
                          ))}
                          <Button
                            variant="secondary"
                            onClick={() => deleteHistoricalRepaint(selectedHistoricalRepaint)}
                            className="ml-2 h-8 px-3 text-xs text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                      {(() => {
                        const displayUrl = !selectedHistoricalRepaint || selectedHistoricalRepaint === 'latest'
                          ? repaintUrl
                          : historicalRepaints.find(r => r.repaint_id === selectedHistoricalRepaint)?.final_image_url;
                        return displayUrl ? (
                          <img
                            src={displayUrl}
                            alt="AI Repaint Result"
                            className="w-full max-w-[700px] mx-auto cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(displayUrl, '_blank')}
                          />
                        ) : (
                          <div className="w-full max-w-[700px] mx-auto p-8 text-center text-gray-500">
                            No repaint results available yet. Run AI Repaint to generate results.
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          // UPLOAD MODE: Show image upload interface
          <div className="flex flex-col gap-4">
          

            

            {/* BOTTOM: left controls + right image */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LEFT PANEL (controls) */}
              <Card>
                <div className="p-4">
                  <div className="text-sm font-medium mb-2">Task Status</div>
                  <div className={cn("text-sm", theme.color.mutedText)}>
                    Image uploaded successfully. You can now proceed to color selection and painting.
                  </div>
                  <div className="mt-3">
                    <Button onClick={() => window.location.reload()}>
                      Start Painting
                    </Button>
                  </div>
                </div>
              </Card>

              {/* RIGHT PANEL (image) */}
              <Card>
                <div className="p-4">
                  <div className="text-sm font-medium mb-2">Uploaded Image</div>
                  {imageObjectUrl ? (
                    <img
                      src={imageObjectUrl}
                      alt="Uploaded"
                      className="w-full max-h-[520px] object-contain rounded border-0 border-neutral-200 bg-white"
                    />
                  ) : (
                    <div className={cn("text-sm", theme.color.mutedText)}>No image uploaded yet.</div>
                  )}
                </div>
              </Card>
            </div>

           
          </div>
        )}
      </div>
    </Protected>
  );
}