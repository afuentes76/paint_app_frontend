import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);

  return h;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;

  if (!taskId) {
    return NextResponse.json({ detail: "Missing taskId" }, { status: 400 });
  }

  const target = `${BACKEND_BASE}/tasks/${taskId}/repaints`;

  try {
    const res = await fetch(target, {
      method: "GET",
      headers: forwardHeaders(req),
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
    console.error("Load repaints proxy error:", err);
    return NextResponse.json({ detail: "Load repaints proxy failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;

  if (!taskId) {
    return NextResponse.json({ detail: "Missing taskId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const repaintId = url.searchParams.get("repaint_id");

  if (!repaintId) {
    return NextResponse.json({ detail: "Missing repaint_id" }, { status: 400 });
  }

  const target = `${BACKEND_BASE}/tasks/${taskId}/repaints/${repaintId}`;

  try {
    const res = await fetch(target, {
      method: "DELETE",
      headers: forwardHeaders(req),
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
    console.error("Delete repaint proxy error:", err);
    return NextResponse.json({ detail: "Delete repaint proxy failed" }, { status: 500 });
  }
}