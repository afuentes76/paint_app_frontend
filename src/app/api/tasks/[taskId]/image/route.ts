// src/app/api/public/tasks/[taskId]/image/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function POST(req: NextRequest, ctx: { params: { taskId: string } }) {
  const { taskId } = ctx.params;

  // backend contract from your reference: POST /api/public/tasks/{task_id}/image (multipart)
  // in backend base: /public/tasks/{task_id}/image
  const target = `${BACKEND_BASE}/public/tasks/${encodeURIComponent(taskId)}/image`;

  const body = await req.arrayBuffer();

  // must forward multipart content-type boundary
  const ct = req.headers.get("content-type") || "";

  const res = await fetch(target, {
    method: "POST",
    headers: ct ? { "content-type": ct } : undefined,
    body,
  });

  const out = await res.arrayBuffer();

  return new NextResponse(out, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}
