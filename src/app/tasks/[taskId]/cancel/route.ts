// src/app/api/tasks/[taskId]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

export async function POST(req: NextRequest, ctx: { params: { taskId: string } }) {
  const { taskId } = ctx.params;

  // Cancel processing for this task (mask generation API1/API2)
  const body = await req.text(); // pass-through (usually empty)
  const target = `${BACKEND_BASE}/tasks/${taskId}/cancel`;

  const res = await fetch(target, {
    method: "POST",
    headers: forwardHeaders(req),
    body,
    cache: "no-store",
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}