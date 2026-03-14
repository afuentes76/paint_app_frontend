import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ qrToken: string }> }
) {
  const { qrToken } = await ctx.params;

  const target = `${BACKEND_BASE}/public/qr/${encodeURIComponent(qrToken)}`;

  const res = await fetch(target, {
    method: "GET",
    cache: "no-store",
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}