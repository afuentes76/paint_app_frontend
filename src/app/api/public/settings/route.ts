import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function GET(_req: NextRequest) {
  // Backend endpoint is /meta/public-settings (NOT /public/settings) because /public is reserved for StaticFiles.
  const target = `${BACKEND_BASE}/meta/public-settings`;

  const res = await fetch(target, { method: "GET", cache: "no-store" });
  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
