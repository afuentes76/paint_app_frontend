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

export async function GET(req: NextRequest) {
  const target = `${BACKEND_BASE}/admin/mask-catalog`;

  const res = await fetch(target, {
    method: "GET",
    headers: forwardHeaders(req),
    cache: "no-store",
  });

  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const target = `${BACKEND_BASE}/admin/mask-catalog`;
  const body = await req.arrayBuffer();

  const res = await fetch(target, {
    method: "POST",
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