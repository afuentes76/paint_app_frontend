"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Button } from "@/ui/components/Button";
import { Table, TBody, TD, TH, THead, TR } from "@/ui/components/Table";
import { cn, theme } from "@/ui/theme";

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
};

type TaskMaskDTO = {
  mask_key: string;
  status: string;
  failed_step?: "API1" | "API2" | null;
  error_message?: string | null;
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
  useEffect(() => {
    if (!taskId) return;
    if (allSelectedSucceeded && !anySelectedFailedOrCanceled) {
      router.replace(`/tasks/${taskId}/preview`);
    }
  }, [allSelectedSucceeded, anySelectedFailedOrCanceled, router, taskId]);

  // If task type changes: auto-unselect non-matching masks (LOCKED)
  useEffect(() => {
    if (!processingType) return;
    const allowed = new Set(filteredCatalog.map((c) => getCatalogKey(c)).filter(Boolean) as string[]);
    setSelectedKeys((prev) => prev.filter((k) => allowed.has(k)));
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

  async function changeTaskType(next: "INTERIOR" | "EXTERIOR") {
    if (!taskId) return;
    if (!canEditType) return;

    try {
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
      setTask(updated);

      const cat = await fetchCatalogOnce(next);
      setCatalog(cat);
    } catch (err) {
      console.error(err);
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
            <h1 className="text-xl font-semibold">Processing</h1>
            <p className={cn("mt-1 text-sm", theme.color.mutedText)}>
              Configure task, select masks, and run processing. This page will advance to Preview when all selected masks succeed.
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
        ) : (
          <div className="flex flex-col gap-4">
            {/* TOP: left controls + right image */}
            <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-8 items-start">
              {/* LEFT PANEL */}
              <Card>
                <div className="p-4">
                  {/* Task Name */}
                  <div className="mb-3">
                    <div className="text-sm font-medium mb-1">Task Name</div>
                    <input
                      className="w-full rounded border px-3 py-2 text-sm"
                      value={taskNameDraft}
                      onFocus={() => setIsEditingTaskName(true)}
                      onBlur={() => setIsEditingTaskName(false)}
                      onChange={(e) => {
                        setTaskNameDraft(e.target.value);
                        setIsTaskNameDirty(true);
                      }}
                      placeholder="Task name"
                    />
                  </div>

                  {/* Task Type (inline label) */}
                  <div className="mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium whitespace-nowrap">Type</div>
                      <select
                        className="rounded border px-3 py-2 text-sm"
                        value={processingType || ""}
                        onChange={(e) => changeTaskType(e.target.value as "INTERIOR" | "EXTERIOR")}
                        disabled={!canEditType}
                      >
                        <option value="" disabled>
                          Select type...
                        </option>
                        <option value="INTERIOR">Interior</option>
                        <option value="EXTERIOR">Exterior</option>
                      </select>

                      {anySelectedRunning ? (
                        <div className={cn("text-xs", theme.color.mutedText)}>• locked while running</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Mask Selection table (no black borders) */}
                  <div>
                    {!processingType ? (
                      <div className={cn("text-sm", theme.color.mutedText)}>Choose a task type to load masks.</div>
                    ) : filteredCatalog.length === 0 ? (
                      <div className={cn("text-sm", theme.color.mutedText)}>No masks found for {taskTypeLabel(processingType)}.</div>
                    ) : (
                      <div className="rounded-xl border-0 border-neutral-200 overflow-hidden bg-white">
                        

                        <div className={cn("max-h-[400px] overflow-y-auto overflow-x-hidden", !canEditMaskSelection ? "opacity-60" : "")}>

                          <Table>
                            <THead>
                              <TR className="border-0 ">
                                <TH className="w-[20px]" />
                                <TH><div className="flex items-center justify-between px-3 py-2 border-0 border-neutral-200 bg-neutral-50">
                          <div className="text-sm font-medium">Masks</div>
                          <div className={cn("text-xs", theme.color.mutedText)}>
                            Selected: <span className="font-medium">{visibleSelectedKeys.length}</span>
                          </div>
                        </div></TH>
                              </TR>
                            </THead>

                            <TBody>
                              {filteredCatalog.map((m, idx) => {
                                const keyStr = String(getCatalogKey(m) || "");
                                const checked = keyStr ? visibleSelectedKeys.includes(keyStr) : false;

                                const rowKey =
                                  (m.mask_id && String(m.mask_id)) ||
                                  (getCatalogKey(m) && String(getCatalogKey(m))) ||
                                  `mask-${idx}`;

                                return (
                                  <TR key={rowKey} className="border-b border-neutral-200 last:border-b-0">
                                    <TD className="w-[44px]">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => keyStr && toggleMask(keyStr)}
                                        disabled={!canEditMaskSelection || !keyStr}
                                        className="h-4 w-4"
                                      />
                                    </TD>
                                    <TD className="text-sm font-medium">{getMaskDisplayName(m)}</TD>
                                  </TR>
                                );
                              })}
                            </TBody>
                          </Table>
                        </div>
                      </div>
                    )}
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

            {/* FULL WIDTH: Start / Cancel */}
            <Card>
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={startProcessing} disabled={!startEnabled}>
                    Start Processing
                  </Button>

                  {cancelVisible ? (
                    <Button variant="danger" onClick={cancelProcessing}>
                      Stop / Cancel
                    </Button>
                  ) : null}

                  <div className={cn("text-xs", theme.color.mutedText)}>
                    Start enabled only if image exists, ≥1 mask selected, and none running.
                  </div>
                </div>
              </div>
            </Card>

            {/* FULL WIDTH: Processing Status (single cell per mask; no black borders) */}
            <Card>
              <div className="p-4">
                

                {visibleSelectedKeys.length === 0 ? (
                  <div className={cn("text-sm", theme.color.mutedText)}>Select at least one mask to see status.</div>
                ) : (
                  <div className="rounded-xl border-0 border-neutral-200 overflow-hidden bg-white">
                    <div className="px-3 py-2 border-0 border-neutral-200 bg-neutral-50">
                      
                    </div>

                    <div className="overflow-y-auto overflow-x-hidden">
                      <Table className="w-full table-fixed">
                        <THead>
                          <TR>
                            <TH>
                               Processing Status 
                            </TH>
                          </TR>
                        </THead>
                        <TBody>
                          {statusLines.map((x) => {
                            const statusText = x.uiStatus;
                            const showReason = (x.isFailed || x.isCanceled) && (x.failedStep || x.errMsg);

                            return (
                              <TR key={x.key} className="border-b border-neutral-200 last:border-b-0">
                                <TD>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium">
                                        {x.name}{" "}
                                        <span className={cn("font-normal", theme.color.mutedText)}>— {statusText}</span>
                                      </div>

                                      {showReason ? (
                                        <div className={cn("mt-1 text-xs", theme.color.mutedText)}>
                                          {x.failedStep ? <span className="font-medium">{x.failedStep} failed</span> : null}
                                          {x.errMsg ? <span className={x.failedStep ? "ml-2" : ""}>{x.errMsg}</span> : null}
                                        </div>
                                      ) : null}
                                    </div>

                                    {x.isFailed ? (
                                      <Button
                                        variant="secondary"
                                        onClick={() => retryMask(x.key)}
                                        disabled={retryDisabled}
                                        className="h-8"
                                      >
                                        Retry
                                      </Button>
                                    ) : null}
                                  </div>
                                </TD>
                              </TR>
                            );
                          })}
                        </TBody>
                      </Table>
                    </div>
                  </div>
                )}

                {anySelectedFailedOrCanceled ? (
                  <div className="mt-3">
                    <ErrorBanner message="Some selected masks failed or were canceled. Fix/retry to proceed to Preview." />
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        )}
      </div>
    </Protected>
  );
}
