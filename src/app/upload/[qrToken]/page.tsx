"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { Card } from "@/ui/components/Card";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { Button } from "@/ui/components/Button";
import { cn, theme } from "@/ui/theme";

type ResolveQrOut = {
  task_id: string;
  task_name?: string;
  status?: string;
};

function friendlyErr(status: number) {
  if (status === 404) return "This QR code is expired or invalid.";
  if (status === 400) return "This QR code is already used.";
  if (status === 413) return "File too large.";
  if (status >= 500) return "Server error.";
  return "Request failed.";
}

export default function UploadByQrTokenPage() {
  const params = useParams<{ qrToken: string }>();
  const qrToken = params?.qrToken;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<ResolveQrOut | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!qrToken) return;

    (async () => {
      setLoading(true);
      setErrorFriendly(null);
      setErrorRaw(null);

      try {
        // NOTE: phone must never call backend directly (CORS). Always go through Next API routes.
        const res = await fetch(`/api/tasks/public/qr/${encodeURIComponent(qrToken)}`);
        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          setErrorFriendly(friendlyErr(res.status));
          setErrorRaw(`HTTP ${res.status}: ${raw || "(no body)"}`);
          setLoading(false);
          return;
        }

        const data = (await res.json()) as ResolveQrOut;
        setTask(data);
      } catch (err) {
        console.error("QR resolve error:", err);
        setErrorFriendly("Cannot reach server.");
        setErrorRaw(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [qrToken]);

  async function doUpload() {
    if (!task?.task_id || !file) return;

    setUploading(true);
    setErrorFriendly(null);
    setErrorRaw(null);

    try {
      const form = new FormData();
      form.append("file", file);

       
      const res = await fetch(`/api/public/tasks/${task.task_id}/image`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        setErrorFriendly("Upload failed. Please try again.");
        setErrorRaw(`HTTP ${res.status}: ${raw || friendlyErr(res.status)}`);
        setUploading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Upload error:", err);
      setErrorFriendly("Upload failed. Please try again.");
      setErrorRaw(String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-xl font-semibold">Upload Image</h1>
      <p className={cn("mt-1 text-sm", theme.color.mutedText)}>
        Select an image and upload it.
      </p>

      <div className="mt-4">
        <Card>
          <div className="p-4">
            {loading ? <Loading label="Validating QR..." /> : null}

            {errorFriendly ? (
              <div>
                <ErrorBanner message={errorFriendly} />
                {errorRaw ? (
                  <pre className={cn("mt-2 whitespace-pre-wrap text-xs", theme.color.mutedText)}>{errorRaw}</pre>
                ) : null}
              </div>
            ) : null}

            {!loading && !errorFriendly && !success ? (
              <div className="mt-2">
                <div className={cn("text-sm", theme.color.mutedText)}>
                  Task: <span className="font-medium">{task?.task_name ?? task?.task_id}</span>
                </div>

                <div className="mt-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="mt-3">
                  <Button variant="primary" disabled={!file || uploading} onClick={doUpload}>
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            ) : null}

            {success ? (
              <div className="mt-2">
                <div className="text-sm">Uploaded successfully. You can close this page.</div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
