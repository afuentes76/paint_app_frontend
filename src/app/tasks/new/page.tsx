"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Button } from "@/ui/components/Button";
import { cn, theme } from "@/ui/theme";

import type { TaskDTO } from "@/types/dto.task";

/**
 * React 18 + Next dev StrictMode mounts components twice (effects run twice).
 * To prevent TWO POST /api/tasks calls, we guard with a module-scope in-flight promise.
 *
 * IMPORTANT:
 * We must NOT cache a "lastCreatedTaskId" across navigations — that causes the app
 * to redirect to an old task when you create a new one later.
 */
let inFlightCreate: Promise<string> | null = null;

function friendlyErrorFrom(resStatus: number): string {
  if (resStatus === 401 || resStatus === 403) return "Not authorized";
  if (resStatus === 404) return "Endpoint not found";
  if (resStatus >= 500) return "Server error";
  return "Request failed";
}

export default function NewTaskPage() {
  const router = useRouter();

  const [creating, setCreating] = useState(true);
  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  async function createTaskOnceAndRedirect() {
    setCreating(true);
    setErrorFriendly(null);
    setErrorRaw(null);

    try {
      // If a create is already in-flight (StrictMode remount), await it.
      if (!inFlightCreate) {
        // Create in-flight promise immediately to block any 2nd call.
        inFlightCreate = (async () => {
          const res = await fetchWithAuth("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "New Task" }),
          });

          if (!res.ok) {
            const raw = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status}: ${raw || friendlyErrorFrom(res.status)}`);
          }

          const task = (await res.json()) as TaskDTO;
          const taskId = task?.task_id ? String(task.task_id) : "";
          if (!taskId) throw new Error("Backend response missing task_id");

          return taskId;
        })();
      }

      const createdId = await inFlightCreate;

      // CRITICAL: clear the promise so future visits to /tasks/new create a NEW task.
      inFlightCreate = null;

      router.replace(`/tasks/${createdId}/qr`);
    } catch (err) {
      console.error("Create task error:", err);
      setErrorFriendly("Failed to create task");
      setErrorRaw(String(err));
      setCreating(false);

      // Allow retry after a failure
      inFlightCreate = null;
    }
  }

  useEffect(() => {
    createTaskOnceAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Protected roles={["USER", "ADMIN"]}>
      <div className="w-full">
        <h1 className="text-xl font-semibold">New Task</h1>
        <p className={cn("mt-1 text-sm", theme.color.mutedText)}>Creating task and redirecting to QR...</p>

        <div className="mt-4">
          <Card>
            <div className="p-4">
              {creating ? <Loading label="Creating task..." /> : null}

              {errorFriendly ? (
                <div className="mt-3">
                  <ErrorBanner message={errorFriendly} />
                  {errorRaw ? (
                    <pre className={cn("mt-2 whitespace-pre-wrap text-xs", theme.color.mutedText)}>{errorRaw}</pre>
                  ) : null}

                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      disabled={creating}
                      onClick={() => {
                        inFlightCreate = null;
                        createTaskOnceAndRedirect();
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </Protected>
  );
}