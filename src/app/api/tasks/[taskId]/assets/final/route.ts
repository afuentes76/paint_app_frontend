import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function GET(req: NextRequest, ctx: { params: { taskId: string } }) {
  const { taskId } = ctx.params;

  if (!taskId) {
    return NextResponse.json({ detail: "Missing taskId" }, { status: 400 });
  }

  const target = `${BACKEND_BASE}/tasks/${taskId}/assets/final`;

  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  try {
    const res = await fetch(target, { method: "GET", headers, cache: "no-store" });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new NextResponse(text || "Failed to fetch image", { status: res.status });
    }

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") || "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("Final asset proxy error:", err);
    return NextResponse.json({ detail: "Final asset proxy failed" }, { status: 500 });
  }
}
