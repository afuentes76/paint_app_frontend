"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchWithAuth } from "@/lib/api";

export type PaintSearchHit = {
  color_id: string;
  brand: string;
  collection: string;
  collection_slug: string;
  code: string;
  name: string;
  hex: string;
};

type Props = {
  value: string;
  placeholder?: string;
  onPick: (hit: PaintSearchHit) => void;
};

function extractCodeFromLabel(s: string) {
  const t = (s || "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0] || "";
}

// purely for readability (UI only)
function textColorForHex(hex: string) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length !== 6) return "#111827";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.55 ? "#FFFFFF" : "#111827";
}

export function PaintColorTypeahead({ value, placeholder, onPick }: Props) {
  const [displayText, setDisplayText] = useState(value || "");
  const [queryText, setQueryText] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PaintSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [committed, setCommitted] = useState(false);

  // UI-only: only show "No matches" AFTER a search finishes at least once
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // ===== sync from parent value =====
  useEffect(() => {
    const v = (value || "").trim();
    setDisplayText(v);

    if (!v) {
      setQueryText("");
      setCommitted(false);
      setItems([]);
      setOpen(false);
      setHasSearched(false);
      return;
    }

    setQueryText(extractCodeFromLabel(v));
    setCommitted(true);
    setItems([]);
    setOpen(false);
    setHasSearched(false);
  }, [value]);

  const canSearch = useMemo(() => {
    const q = queryText.trim();
    if (!q) return false;
    if (q.length >= 2) return true;
    if (/^hc-?$/i.test(q)) return true;
    if (/^\d+$/i.test(q)) return true;
    return false;
  }, [queryText]);

  // ===== search logic =====
  useEffect(() => {
    if (committed || !canSearch) return;

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetchWithAuth(`/api/paint/search?q=${encodeURIComponent(queryText)}&limit=10`);
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(true);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [queryText, canSearch, committed]);

  // ===== portal positioning (UI-only) =====
  const updatePosition = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // ===== close on outside click (required because portal) =====
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const input = inputRef.current;
      const dd = dropdownRef.current;
      const target = e.target as Node;

      if (input && input.contains(target)) return;
      if (dd && dd.contains(target)) return;

      setOpen(false);
    };

    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);

  // select
  const selectColor = (hit: PaintSearchHit) => {
    const label = `${hit.code} ${hit.name}`;
    setDisplayText(label);
    setQueryText(hit.code);
    setCommitted(true);
    setOpen(false);
    setHasSearched(false);
    onPick(hit);
  };

  const showNoMatches =
    !committed && open && !loading && hasSearched && queryText.trim().length > 0 && items.length === 0;

  const showList = !committed && open && items.length > 0;

  return (
    <>
      <input
        ref={inputRef}
        className="w-full min-w-0 rounded border px-2 py-1 text-sm"
        placeholder={placeholder || "Search (HC-1, 1679, Hale...)"} 
        value={displayText}
        onChange={(e) => {
          const v = e.target.value;
          setDisplayText(v);
          setQueryText(v);
          setCommitted(false);
          setHasSearched(false);
        }}
        onFocus={() => {
          if (committed) return;
          if (hasSearched && (items.length > 0 || showNoMatches)) setOpen(true);
        }}
      />

      {(showList || showNoMatches) &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: 250,
              zIndex: 999999,
              backgroundColor: "#ffffff",
            }}
            className="border border-gray-300 rounded shadow-2xl max-h-64 overflow-auto"
          >
            {showNoMatches && (
              <div style={{ backgroundColor: "#ffffff" }} className="px-2 py-2 text-xs text-gray-600">
                No matches
              </div>
            )}

            {showList &&
              items.map((hit) => {
                const fg = textColorForHex(hit.hex);
                return (
                  <div
                    key={hit.color_id}
                    onMouseDown={() => selectColor(hit)}
                    className="cursor-pointer flex items-center gap-2 px-2 py-2"
                    style={{ backgroundColor: hit.hex || "#ffffff", color: fg }}
                  >
                    <div className="w-4 h-4 border border-black/20" style={{ background: hit.hex || "transparent" }} />
                    <div className="font-medium whitespace-nowrap">{hit.code} :</div>
                    <div className="truncate">{hit.name}</div>
                  </div>
                );
              })}
          </div>,
          document.body
        )}
    </>
  );
}
