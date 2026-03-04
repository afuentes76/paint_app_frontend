import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  // force JSON content-type so FastAPI parsing is consistent
  h.set("content-type", "application/json");

  return h;
}

export async function POST(req: NextRequest, ctx: { params: { taskId: string } }) {
  const { taskId } = ctx.params;
  if (!taskId) return NextResponse.json({ detail: "Missing taskId" }, { status: 400 });

  const target = `${BACKEND_BASE}/tasks/${taskId}/repaint/start`;
  const bodyText = await req.text();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(target, {
      method: "POST",
      headers: forwardHeaders(req),
      body: bodyText,
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = await res.text().catch(() => "");
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("AI repaint start proxy error:", err?.stack || err);
    return NextResponse.json(
      { detail: "AI repaint start proxy failed", error: String(err?.code || err?.message || err) },
      { status: 500 }
    );
  }
}