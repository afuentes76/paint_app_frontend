import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function POST(req: NextRequest, ctx: { params: { taskId: string } }) {
  const { taskId } = ctx.params;

  if (!taskId) {
    return NextResponse.json({ detail: "Missing taskId" }, { status: 400 });
  }

  const target = `${BACKEND_BASE}/tasks/${taskId}/save-composite`;

  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  // Pass through multipart form-data as-is (do NOT set content-type manually)
  try {
    const body = await req.arrayBuffer();
    const ct = req.headers.get("content-type");
    if (ct) headers.set("content-type", ct);

    const res = await fetch(target, {
      method: "POST",
      headers,
      body: Buffer.from(body),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return new NextResponse(text || "Save failed", { status: res.status });
    }

    // backend returns JSON
    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Save composite proxy error:", err);
    return NextResponse.json({ detail: "Save composite proxy failed" }, { status: 500 });
  }
}
