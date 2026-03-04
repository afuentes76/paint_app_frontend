"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);

  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);

  // Create/revoke preview URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const taskLabel = useMemo(() => task?.task_name ?? task?.task_id ?? "", [task]);

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
      <p className={cn("mt-1 text-sm", theme.color.mutedText)}>Select an image and upload it.</p>

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
              <div className="mt-2 space-y-3">
                

                {/* Controls with proper spacing */}


 



                
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <input
                    id="qrUploadFile"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />

                  <label
                    htmlFor="qrUploadFile"
                    className={cn(
                      "inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm cursor-pointer select-none",
                      theme.color.border
                    )}
                  >
                    Choose Image
                  </label>

                    <br></br>
                  <Button variant="primary" disabled={!file || uploading} onClick={doUpload}>
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>

                {/* Preview */}
                {previewUrl ? (
                  <div className="pt-1">
                    <div className={cn("mb-2 text-xs", theme.color.mutedText)}>{file?.name}</div>
                    <img
                      src={previewUrl}
                      alt="Selected"
                      className={cn("max-w-full rounded-md border", theme.color.border)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {success ? (
              <div className="mt-2 space-y-2">
                <div className="text-sm">Uploaded successfully. You can close this page.</div>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Uploaded"
                    className={cn("max-w-full rounded-md border", theme.color.border)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}