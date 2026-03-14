import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

function forwardHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  return h;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string; maskKey: string }> }
) {
  const { taskId, maskKey } = await ctx.params;

  const target = `${BACKEND_BASE}/tasks/${taskId}/masks/${encodeURIComponent(maskKey)}/retry`;

  const res = await fetch(target, {
    method: "POST",
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