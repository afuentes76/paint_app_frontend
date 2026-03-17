import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await ctx.params;
  const target = `${BACKEND_BASE}/tasks/${taskId}`;

  const res = await fetch(target, {
    method: "GET",
    headers: forwardHeaders(req),
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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await ctx.params;
  const target = `${BACKEND_BASE}/tasks/${taskId}`;
  const body = await req.text();

  const res = await fetch(target, {
    method: "PATCH",
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await ctx.params;
  const target = `${BACKEND_BASE}/tasks/${taskId}`;

  const res = await fetch(target, {
    method: "DELETE",
    headers: forwardHeaders(req),
    cache: "no-store",
  });

  return new NextResponse(null, {
    status: res.status,
  });
}