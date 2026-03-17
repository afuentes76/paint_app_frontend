import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await ctx.params;

  const target = `${BACKEND_BASE}api/public/tasks/${encodeURIComponent(taskId)}/image`;
  const body = await req.arrayBuffer();
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