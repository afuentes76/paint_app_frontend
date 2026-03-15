"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Button } from "@/ui/components/Button";
import { cn, theme } from "@/ui/theme";

type TaskDTO = {
  task_id: string;
  status?: string | null;
  qr_token?: string | null;
  qr_url?: string | null;
};

function friendlyErrorFrom(resStatus: number): string {
  if (resStatus === 401 || resStatus === 403) return "Not authorized";
  if (resStatus === 404) return "Task not found";
  if (resStatus >= 500) return "Server error";
  return "Request failed";
}

export default function TaskQrPage() {
  const router = useRouter();
  const params = useParams();

  const taskId = Array.isArray(params?.taskId)
    ? params.taskId[0]
    : (params?.taskId as string | undefined);

  // Derived error (no setState needed)
  const missingTaskId = !taskId || taskId === "undefined";

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDTO | null>(null);
  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  // ✅ FIX: prefer backend-provided qr_url (built from PUBLIC_BASE_URL)
  // fallback to NEXT_PUBLIC_APP_ORIGIN / window.origin only if qr_url missing
  const uploadUrl = useMemo(() => {
    const backendUrl = (task?.qr_url || "").trim();
    if (backendUrl) return backendUrl;

    const token = (task?.qr_token || "").trim();
    if (!token) return "";

    const appOrigin =
      process.env.NEXT_PUBLIC_APP_ORIGIN ||
      (typeof window !== "undefined" ? window.location.origin : "");

    return appOrigin ? `${appOrigin}/upload/${token}` : "";
  }, [task?.qr_token, task?.qr_url]);

  const statusToNextRoute = useCallback((status?: string | null) => {
    const s = (status || "").toUpperCase();
    if (!taskId) return null;

    // ✅ Locked: Processing page is /tasks/{taskId}
    if (s === "IMAGE_UPLOADED") return `/tasks/${taskId}`;
    if (s === "WAITING_FOR_UPLOAD") return null;

    if (s === "PROCESSING") return `/tasks/${taskId}`;
    if (s === "READY_FOR_PREVIEW") return `/tasks/${taskId}/preview`;

    return null;
  }, [taskId]);

  useEffect(() => {
    // Stop polling if the dynamic route param is missing.
    if (missingTaskId) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (stopped) return;

      try {
        // only clear errors if we actually poll
        setErrorFriendly(null);
        setErrorRaw(null);

        const res = await fetchWithAuth(`/api/tasks/${taskId}`);
        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          setErrorFriendly(friendlyErrorFrom(res.status));
          setErrorRaw(`HTTP ${res.status}: ${raw || "(no body)"}`);
          setLoading(false);
          return;
        }

        const data = (await res.json()) as TaskDTO;
        setTask(data);

        const next = statusToNextRoute(data.status);
        if (next) {
          router.replace(next);
          return;
        }

        setLoading(false);
        timer = setTimeout(tick, 2000);
      } catch (err) {
        console.error("QR polling error:", err);
        setErrorFriendly("Cannot reach server");
        setErrorRaw(String(err));
        setLoading(false);
      }
    }

    tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [taskId, router, missingTaskId, statusToNextRoute]);

  // Render-time error message if missing param
  const uiErrorFriendly = missingTaskId ? "Something went wrong" : errorFriendly;
  const uiErrorRaw = missingTaskId
    ? "Missing taskId in route params. Expected URL: /tasks/{taskId}/qr"
    : errorRaw;

  const uiLoading = missingTaskId ? false : loading;

  return (
    <Protected roles={["USER", "ADMIN"]}>
      <div className={cn("p-6", theme.color.background)}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">Upload Image</div>
            <div className="text-sm opacity-70">
              Scan this QR code on your phone to upload the image. This page will
              auto-advance once upload is detected.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/tasks">
              <Button variant="secondary">Back to tasks</Button>
            </Link>
          </div>
        </div>

        {uiErrorFriendly && (
          <ErrorBanner
            title={uiErrorFriendly}
            message={uiErrorFriendly}
            details={uiErrorRaw || undefined}
          />
        )}

        {uiLoading && <Loading label="Loading task…" />}

        {!uiLoading && task && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Card className="flex w-[25%] flex-col items-center gap-4 p-4">
              {uploadUrl ? (
                <div className="flex items-start gap-6">
                  <div className="rounded bg-white p-3">
                    <QRCode value={uploadUrl} size={400} />
                  </div>
                </div>
              ) : (
                <div className="text-sm opacity-70">QR token not available yet.</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </Protected>
  );
}
