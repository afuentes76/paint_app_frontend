export type PreviewLayerState = {
  maskKey: string;
  // null/undefined => unassigned (layer not rendered)
  color?: string | null;
};

export type PreviewPersistedState = {
  zoom?: number; // e.g., 1, 1.5, 2, or fit scale
  livePreview?: boolean;
  layers?: Record<string, PreviewLayerState>;
};

function storageKey(taskId: string) {
  return `preview:${taskId}`;
}

export function loadPreviewState(taskId: string): PreviewPersistedState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(taskId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PreviewPersistedState;
  } catch {
    return {};
  }
}

export function savePreviewState(taskId: string, state: PreviewPersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(taskId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearPreviewState(taskId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(taskId));
  } catch {
    // ignore
  }
}
