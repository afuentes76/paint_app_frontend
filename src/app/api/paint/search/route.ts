import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  return h;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const limit = url.searchParams.get("limit") || "10";

  const target = `${BACKEND_BASE}/paint/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;

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
