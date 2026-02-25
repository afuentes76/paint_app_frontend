import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { taskId: string; taskMaskId: string } }
) {
  const { taskId, taskMaskId } = ctx.params;

  const target = `${BACKEND_BASE}/tasks/${taskId}/masks/${taskMaskId}/paint-color`;
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
