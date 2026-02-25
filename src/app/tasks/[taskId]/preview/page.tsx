"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Button } from "@/ui/components/Button";
import { Table, TBody, TD, TH, THead, TR } from "@/ui/components/Table";

import { ColorPickerRow, type PaletteColor } from "@/ui/components/ColorPickerRow";
import {
  buildTintedLayer,
  composeToCanvas,
  fetchAsImageBitmap,
  normalizeHex,
} from "@/lib/canvasComposite";
import { loadPreviewState, savePreviewState, type PreviewLayerState } from "@/lib/localPreviewState";
import type { PaintSearchHit } from "@/ui/components/PaintColorTypeahead";

// Minimal TaskDTO so this file compiles even if you don’t import a shared type.
type PaletteColorItem = {
  id?: string | number;
  name?: string;
  hex: string;
};

type TaskDTO = {
  id?: string;
  name?: string;
  store_palette_colors?: (string | PaletteColorItem)[];
};

type TaskMaskDTO = {
  task_mask_id: string;
  mask_key: string;
  status: string;
  paint_color_id?: string | null;
  mask_png_asset_url?: string | null;
  error_message?: string | null;
};

type MaskCatalogItem = {
  key: string;
  display_name: string;
  sort_order: number;
  processing_type?: string | null;
  active?: boolean;
};

type PaintMeta = {
  brand: string;
  name: string;
  code: string;
  hex: string; // normalized "#RRGGBB"
};

function upper(v?: string | null) {
  return (v || "").toUpperCase();
}

function isCompleted(status: string) {
  const s = upper(status);
  return s === "COMPLETED" || s === "SUCCEEDED";
}

function stripHash(hex: string) {
  return (hex || "").replace("#", "").trim();
}

export default function PreviewPage() {
  const params = useParams();
  const taskId = Array.isArray(params?.taskId)
    ? params.taskId[0]
    : (params?.taskId as string | undefined);

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDTO | null>(null);
  const [taskMasks, setTaskMasks] = useState<TaskMaskDTO[]>([]);
  const [catalog, setCatalog] = useState<MaskCatalogItem[]>([]);

  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  // ----- Local preview state -----
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

  // paint label shown in typeahead input: "CODE NAME"
  const [paintTextByMask, setPaintTextByMask] = useState<Record<string, string>>({});

  // store paint meta per mask (brand/name/code/hex) so we can call repaint API correctly
  const [paintMetaByMask, setPaintMetaByMask] = useState<Record<string, PaintMeta | null>>({});

  // ---------------------------
  // Load initial data
  // ---------------------------
  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorFriendly(null);
      setErrorRaw(null);

      try {
        const [taskRes, masksRes, catalogRes] = await Promise.all([
          fetchWithAuth(`/api/tasks/${taskId}`),
          fetchWithAuth(`/api/tasks/${taskId}/masks`, { cache: "no-store" }),
          fetchWithAuth(`/api/tasks/mask-catalog`, { cache: "no-store" }),
        ]);

        if (!taskRes.ok) throw new Error(await taskRes.text());
        if (!masksRes.ok) throw new Error(await masksRes.text());
        if (!catalogRes.ok) throw new Error(await catalogRes.text());

        const taskJson = (await taskRes.json()) as TaskDTO;
        const masksJson = (await masksRes.json()) as TaskMaskDTO[];
        const catalogJson = (await catalogRes.json()) as MaskCatalogItem[];

        if (cancelled) return;

        setTask(taskJson);
        setTaskMasks(masksJson);
        setCatalog(catalogJson);

        // load persisted preview state
        if (taskId) {
          const persisted = loadPreviewState(taskId);
          setLivePreview(!!persisted.livePreview);

          const initial: Record<string, string | null> = {};
          const layers = persisted.layers || {};
          for (const k of Object.keys(layers)) {
            const layerState = layers[k];
            initial[k] = layerState?.color || null;
          }
          setDraftColors(initial);
          setAppliedColors(initial);
        }
      } catch (e: unknown) {
        console.error(e);
        setErrorFriendly("Failed to load preview assets");
        setErrorRaw(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // cleanup object URL
  useEffect(() => {
    return () => {
      if (beforeObjectUrlRef.current) {
        URL.revokeObjectURL(beforeObjectUrlRef.current);
        beforeObjectUrlRef.current = null;
      }
    };
  }, []);

  // ---------------------------
  // Derived: completed masks only
  // ---------------------------
  const completedMasks = useMemo(() => {
    const items = taskMasks
      .filter((m) => isCompleted(m.status))
      .map((m) => {
        const cat = catalog.find((c) => c.key === m.mask_key);
        return {
          task_mask_id: m.task_mask_id,
          mask_key: m.mask_key,
          display_name: cat?.display_name || m.mask_key,
          sort_order: cat?.sort_order ?? 9999,
          status: m.status,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name));

    return { items };
  }, [taskMasks, catalog]);

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

  // ---------------------------
  // Load bitmaps (original + masks)
  // ---------------------------
  useEffect(() => {
    if (!taskId) return;
    if (loading) return;
    if (errorFriendly) return;

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

        // Masks
        for (const m of completedMasks.items) {
          if (maskBitmapsRef.current[m.mask_key]) continue;
          const bm = await fetchAsImageBitmap(
            fetchWithAuth,
            `/api/tasks/${taskId}/assets/masks/${encodeURIComponent(m.mask_key)}/png`
          );
          if (cancelled) return;
          maskBitmapsRef.current[m.mask_key] = bm;
        }

        renderComposite();
      } catch (e: unknown) {
        console.error(e);
        setErrorFriendly("Failed to load bitmaps");
        setErrorRaw(e instanceof Error ? e.message : String(e));
      }
    }

    loadBitmaps();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, loading, errorFriendly, completedMasks.items.length]);

  // ---------------------------
  // Persist local state
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

    const layersToDraw: Array<{ tintedCanvas: HTMLCanvasElement }> = [];

    for (const m of completedMasks.items) {
      const key = m.mask_key;
      const color = appliedColors[key];
      const norm = typeof color === "string" ? normalizeHex(color) : null;
      if (!norm) continue;

      const existing = tintedCanvasesRef.current[key] as HTMLCanvasElement | undefined;
      const maskBm = maskBitmapsRef.current[key];
      if (!maskBm) continue;

      const lastColorKey = tintedCanvasesRef.current[`${key}__color`] as string | undefined;
      if (!existing || lastColorKey !== norm) {
        const tinted = buildTintedLayer(maskBm, norm);
        tintedCanvasesRef.current[key] = tinted;
        tintedCanvasesRef.current[`${key}__color`] = norm;
      }

      layersToDraw.push({ tintedCanvas: tintedCanvasesRef.current[key] as HTMLCanvasElement });
    }

    composeToCanvas(canvas, original, layersToDraw);
  }

  function applyOne(maskKey: string) {
    setAppliedColors((prev) => ({ ...prev, [maskKey]: draftColors[maskKey] ?? null }));
  }

  async function clearPaintSelection(maskKey: string, taskMaskId: string) {
    setPaintTextByMask((prev) => ({ ...prev, [maskKey]: "" }));
    setPaintMetaByMask((prev) => ({ ...prev, [maskKey]: null }));

    try {
      await fetchWithAuth(`/api/tasks/${taskId}/masks/${taskMaskId}/paint-color`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paint_color_id: null }),
      });
    } catch (e) {
      console.error("Failed to clear paint color:", e);
    }
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
     
  }, [livePreview, draftColors]);

  useEffect(() => {
    renderComposite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedColors, completedMasks.items.length]);

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
  // AI Repaint
  // ---------------------------
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

      const res = await fetchWithAuth(`/api/tasks/${taskId}/repaint`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        // Do NOT throw -> prevents Next.js red overlay
        let parsed: unknown = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = null;
        }

        console.log("Repaint error response:", { text, parsed });

        let friendly = "Repaint failed";
        if (parsed && typeof parsed === "object") {
          // Try "detail" first (FastAPI default)
          if ("detail" in parsed) {
            const detail = (parsed as { detail: unknown }).detail;
            if (typeof detail === "string" && detail) {
              friendly = detail;
            }
          }
          // Try "message" as fallback (some APIs use this)
          else if ("message" in parsed) {
            const message = (parsed as { message: unknown }).message;
            if (typeof message === "string" && message) {
              friendly = message;
            }
          }
        }
        if (!friendly && typeof text === "string" && text) {
          friendly = text;
        }

        const details =
            parsed && typeof parsed === "object"
            ? JSON.stringify(parsed, null, 2)
            : (text || `HTTP ${res.status}`);

        setErrorFriendly(friendly);
        setErrorRaw(details);
        return; // <-- critical: stop here, no exception
      }
      
      let json: { final_legend_image_url?: string } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      // backend returns { repaint_run_id, final_legend_image_url }
      const url = json.final_legend_image_url || null;
      if (url) {
        setRepaintUrl(url);
        setRepaintMsg("AI repaint started.");
      } else {
        setRepaintMsg("AI repaint started (no URL returned).");
      }
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

  if (!taskId) {
    return (
      <Protected>
        <Card>
          <ErrorBanner message="Missing taskId" />
        </Card>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="w-full max-w-none px-4 py-3">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Preview</h1>
          </div>

          <Link href="/tasks">
            <Button variant="secondary">Back to tasks</Button>
          </Link>
        </div>

        <div className="mb-3">
          <div className="text-sm text-neutral-600">Task: {task?.name || taskId}</div>
        </div>

        {errorFriendly && <ErrorBanner message={errorFriendly} details={errorRaw || undefined} />}

        {loading ? (
          <Loading />
        ) : (
          <div className="flex w-full min-w-0 gap-4">
            {/* LEFT */}
            <div className="min-w-0 flex-[0_0_360px] max-w-[400px]">
              <Card className="h-auto w-full">
                <div className="flex h-full flex-col overflow-hidden">
                  {/* keep original hidden image ref (behavior unchanged) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={beforeImgRef} alt="Before" className="hidden" />

                  {/* TABLE HEADER + BODY */}
                  <div className="px-3 py-2">
                    <Table>
                      <THead>
                        <TR>
                          <TH className="w-[330px]">Mask</TH>
                          <TH>Palette(Reference)</TH>
                          <TH className="w-[90px]">Custom</TH>
                          <TH className="w-[110px] text-right">Actions</TH>
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
                            <TD colSpan={4} className="py-3 text-sm text-neutral-600">
                              Some masks are not ready yet.
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

                                try {
                                  await fetchWithAuth(`/api/tasks/${taskId}/masks/${m.task_mask_id}/paint-color`, {
                                    method: "PATCH",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ paint_color_id: hit.color_id }),
                                  });
                                } catch (e) {
                                  console.error("Failed to persist paint color:", e);
                                }
                              }}
                              onDraftColorChange={async (next) => {
                                setDraftColors((prev) => ({ ...prev, [m.mask_key]: next }));

                                const nextHex = normalizeHex(next || "") || null;

                                if (!nextHex) {
                                  await clearPaintSelection(m.mask_key, m.task_mask_id);
                                  return;
                                }

                                // EXACT MATCH ONLY
                                try {
                                  const q = stripHash(nextHex); // "RRGGBB"
                                  const res = await fetchWithAuth(`/api/paint/search?q=${encodeURIComponent(q)}&limit=10`);
                                  if (!res.ok) {
                                    await clearPaintSelection(m.mask_key, m.task_mask_id);
                                    return;
                                  }

                                  const hits = (await res.json()) as PaintSearchHit[];
                                  const exact = Array.isArray(hits)
                                    ? hits.find((h) => normalizeHex(h?.hex || "") === nextHex)
                                    : undefined;

                                  if (!exact) {
                                    await clearPaintSelection(m.mask_key, m.task_mask_id);
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

                                  await fetchWithAuth(`/api/tasks/${taskId}/masks/${m.task_mask_id}/paint-color`, {
                                    method: "PATCH",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ paint_color_id: exact.color_id }),
                                  });
                                } catch (e) {
                                  console.error("Exact-hex paint search failed:", e);
                                  await clearPaintSelection(m.mask_key, m.task_mask_id);
                                }
                              }}
                              onApply={() => applyOne(m.mask_key)}
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
            </div>

            {/* RIGHT */}
            <div className="min-w-0 flex-1">
              <Card className="h-auto w-full max-w-[700px] mx-auto">
                <div className="flex h-full flex-col p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium" />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={livePreview}
                        onChange={(e) => setLivePreview(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Live Preview</span>
                      <span className="text-xs text-neutral-500">&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </label>
                  </div>

                  <div className="min-h-0 flex overflow-auto rounded bg-white">
                    <canvas ref={afterCanvasRef} className="block h-auto w-full max-w-[700px] mx-auto" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="mt-3 flex w-full">
          <div className="border-0 px-3 py-3 w-full">
            <div className="flex gap-3 max-w-[700px]">
              <Button onClick={onSave} disabled={saving || !hasAnyRenderable} className="w-full">
                {saving ? "Saving..." : "Save Composite"}
              </Button>

              <Button onClick={onRepaint} disabled={repainting || !hasAnyRenderable} className="w-full" variant="secondary">
                {repainting ? "Repainting..." : "AI Repaint"}
              </Button>

              <Button onClick={() => window.print()} variant="secondary" className="w-full">
                Print
              </Button>
            </div>

            {!hasAnyRenderable && (
              <div className="mt-2 text-xs text-neutral-500">
                Assign at least one color to enable saving/repaint.
              </div>
            )}

            {saveMsg && <div className="mt-2 text-sm text-green-700">{saveMsg}</div>}

            {savedUrl && (
              <a
                href={savedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm text-blue-700 underline"
              >
                Open saved image
              </a>
            )}

            {repaintMsg && <div className="mt-2 text-sm text-neutral-700">{repaintMsg}</div>}

            {repaintUrl && (
              <a
                href={repaintUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm text-blue-700 underline"
              >
                Open AI repaint result
              </a>
            )}
          </div>
        </div>

        <div className="mt-2 flex w-full text-sm text-neutral-600">
          Disclaimer: Palette colors are approximate and not affiliated with any brand. Color library includes popular
          paint brand references
        </div>
      </div>
    </Protected>
  );
}