import { NextRequest, NextResponse } from "next/server";

// Proxy: Next.js -> FastAPI
// Frontend calls: /api/tasks/:taskId/repaint
// Backend route:  POST {BACKEND_BASE}/tasks/:taskId/repaint

const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

export async function POST(req: NextRequest, ctx: { params: { taskId: string } }) {
  const { taskId } = ctx.params;

  if (!taskId) {
    return NextResponse.json({ detail: "Missing taskId" }, { status: 400 });
  }

  const target = `${BACKEND_BASE}/tasks/${taskId}/repaint`;

  // Important: pass JSON body through unmodified so backend Pydantic validation matches.
  const bodyText = await req.text();

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: forwardHeaders(req),
      body: bodyText,
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("AI repaint proxy error:", err);
    return NextResponse.json({ detail: "AI repaint proxy failed" }, { status: 500 });
  }
}