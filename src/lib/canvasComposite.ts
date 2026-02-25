export type CachedLayer = {
  maskKey: string;
  maskBitmap: ImageBitmap;
  tintedCanvas: HTMLCanvasElement;
  color: string; // #RRGGBB
};

export function normalizeHex(input: string): string | null {
  if (!input) return null;
  let v = input.trim();
  if (!v) return null;
  if (!v.startsWith("#")) v = `#${v}`;
  v = v.toUpperCase();
  // #RGB => expand
  if (/^#[0-9A-F]{3}$/.test(v)) {
    const r = v[1],
      g = v[2],
      b = v[3];
    v = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (!/^#[0-9A-F]{6}$/.test(v)) return null;
  return v;
}

export async function fetchAsImageBitmap(
  fetchFn: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  url: string
): Promise<ImageBitmap> {
  const res = await fetchFn(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load ${url}`);
  }
  const blob = await res.blob();
  return await createImageBitmap(blob);
}

export function buildTintedLayer(maskBitmap: ImageBitmap, colorHex: string): HTMLCanvasElement {
  const w = maskBitmap.width;
  const h = maskBitmap.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(maskBitmap, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  return c;
}

export function composeToCanvas(
  target: HTMLCanvasElement,
  original: ImageBitmap,
  layers: Array<{ tintedCanvas: HTMLCanvasElement }>
) {
  const w = original.width;
  const h = original.height;
  if (target.width !== w) target.width = w;
  if (target.height !== h) target.height = h;

  const ctx = target.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(original, 0, 0);
  for (const l of layers) {
    ctx.drawImage(l.tintedCanvas, 0, 0);
  }
}
