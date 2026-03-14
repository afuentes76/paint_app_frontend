import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string; maskKey: string }> }
) {
  const { taskId, maskKey } = await ctx.params;

  if (!taskId || !maskKey) {
    return NextResponse.json({ detail: "Missing taskId or maskKey" }, { status: 400 });
  }

  const target = `${BACKEND_BASE}/tasks/${taskId}/assets/masks/${maskKey}/png`;

  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  try {
    const res = await fetch(target, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new NextResponse(text || "Failed to fetch mask PNG", {
        status: res.status,
      });
    }

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") || "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("Mask PNG proxy error:", err);
    return NextResponse.json({ detail: "Mask PNG proxy failed" }, { status: 500 });
  }
}