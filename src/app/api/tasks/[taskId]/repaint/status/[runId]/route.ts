import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  return h;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string; runId: string }> }
) {
  const { taskId, runId } = await ctx.params;

  if (!taskId) {
    return NextResponse.json({ detail: "Missing taskId" }, { status: 400 });
  }

  if (!runId) {
    return NextResponse.json({ detail: "Missing runId" }, { status: 400 });
  }

  const target = `${BACKEND_BASE}/tasks/${taskId}/repaint/status/${encodeURIComponent(runId)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(target, {
      method: "GET",
      headers: forwardHeaders(req),
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
  } catch (err) {
    console.error("Repaint status proxy error:", err);
    return NextResponse.json(
      { detail: "Repaint status proxy failed" },
      { status: 500 }
    );
  }
}