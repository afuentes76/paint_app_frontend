import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

type Context = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(req: NextRequest, context: Context) {
  const { userId } = await context.params;
  const target = `${BACKEND_BASE}/admin/users/${encodeURIComponent(userId)}`;
  const body = await req.arrayBuffer();

  const res = await fetch(target, {
    method: "PATCH",
    headers: forwardHeaders(req),
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