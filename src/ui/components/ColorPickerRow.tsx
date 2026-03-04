"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/ui/components/Button";
import { PaintColorTypeahead, type PaintSearchHit } from "@/ui/components/PaintColorTypeahead";
import { TD, TR } from "@/ui/components/Table";

export type PaletteColor = {
  id: string;
  name: string;
  hex: string; // "#RRGGBB"
};

function normalizeHexLocal(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;

  const raw = s.startsWith("#") ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toUpperCase()}`;
}

function toSafeHexForColorInput(input: string | null | undefined): string {
  const n = input ? normalizeHexLocal(input) : null;
  return n || "#000000";
}

type Props = {
  title: string;
  palette: PaletteColor[];
  livePreview: boolean;

  draftColor: string | null;
  appliedColor: string | null;

  // Paint picker (library)
  onPaintPick?: (hit: PaintSearchHit) => void;

  // Display text in the paint picker input ("CODE NAME")
  paintText?: string;

  onDraftColorChange: (next: string | null) => void;
  onApply?: () => void;
  onReset?: () => void;

  compact?: boolean;

  // NEW: when true + compact, render as <TR><TD>...</TD>...</TR>
  tableRow?: boolean;
};

export function ColorPickerRow(props: Props) {
  const {
    title,
    livePreview,
    draftColor,
    appliedColor,
    onDraftColorChange,
    onApply,
    onReset,
    compact = false,
    tableRow = false,
  } = props;

  const [hexText, setHexText] = useState<string>(draftColor || "");

  // keep local hex input in sync with parent draft
  useEffect(() => {
    setHexText(draftColor || "");
  }, [draftColor]);

  const appliedBadge = useMemo(() => {
    const a = appliedColor ? normalizeHexLocal(appliedColor) : null;
    return a || null;
  }, [appliedColor]);

  function handleColorPicker(nextColor: string) {
    const n = normalizeHexLocal(nextColor);
    if (!n) return;
    setHexText(n);
    onDraftColorChange(n);
  }

  const paintPickerEl = (
    <PaintColorTypeahead
      value={props.paintText || ""}
      placeholder="Search (HC-1, 1679, Hale...)"
      onPick={(hit) => {
        // Paint pick -> sync to custom hex immediately (existing behavior)
        if (hit.hex) {
          const n = normalizeHexLocal(hit.hex);
          if (n) {
            setHexText(n);
            onDraftColorChange(n);
          }
        }
        props.onPaintPick?.(hit);
      }}
    />
  );

  const customPickerEl = (
    <input
      type="color"
      value={toSafeHexForColorInput(hexText)}
      onChange={(e) => handleColorPicker(e.target.value)}
      className="h-9 w-10 rounded border-0 p-0"
      title="Pick color"
    />
  );

  // ✅ NEW TABLE ROW RENDER (ONLY VISUAL STRUCTURE CHANGES)
  if (compact && tableRow) {
    return (
      <TR>
        {/* 1) Mask name */}
        <TD className="min-w-0 overflow-hidden">
          <div className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
            {/*
              appliedBadge ? (
                <span className="ml-2 text-xs text-neutral-500">({appliedBadge})</span>
              ) : null
            */}
          </div>
        </TD>

        {/* 2) Controls */}
        <TD>
          <div className="flex justify-end gap-1 items-center">
            {paintPickerEl}
            {customPickerEl}
            {/* Apply (only when live preview off) */}
            {!livePreview ? (
              <Button
                onClick={onApply}
                disabled={!normalizeHexLocal(hexText || "")}
                title="Apply"
                className="h-7 w-7 px-0 text-xs"
              >
                ⟳
              </Button>
            ) : null}
            {/* Reset */}
            <Button
              onClick={onReset}
              variant="secondary"
              title="Reset"
              className="h-7 w-7 px-0 text-xs"
            >
              ↺
            </Button>
          </div>
        </TD>
      </TR>
    );
  }

  // EXISTING compact layout (unchanged)
  if (compact) {
    return (
      <div className="rounded border px-2 py-1">
        <div className="grid grid-cols-[minmax(0,1fr)_140px_44px_30px_30px] items-center gap-2">
          {/* Mask name */}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium whitespace-nowrap">
              {title}
              {/*
              appliedBadge ? (
                <span className="ml-2 text-xs text-neutral-500">({appliedBadge})</span>
              ) : null
               */}
            </div>
          </div>

          {/* Paint picker (Palette/Reference) */}
          <div className="flex justify-end">{paintPickerEl}</div>

          {/* Custom picker */}
          <div className="flex justify-end">{customPickerEl}</div>

          {/* Apply (only when live preview off) */}
          <div className="flex justify-end">
            {!livePreview ? (
              <Button
                onClick={onApply}
                disabled={!normalizeHexLocal(hexText || "")}
                title="Apply"
                className="h-7 w-7 px-0 text-xs"
              >
                ⟳
              </Button>
            ) : null}
          </div>

          {/* Reset */}
          <div className="flex justify-end">
            <Button
              onClick={onReset}
              variant="secondary"
              title="Reset"
              className="h-7 w-7 px-0 text-xs"
            >
              ↺
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Non-compact layout (unchanged)
  return (
    <div className="rounded border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium whitespace-nowrap">
            {title}
            {/*
            appliedBadge ? (
              <span className="ml-2 text-xs text-neutral-500">({appliedBadge})</span>
            ) : null
            */}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!livePreview ? (
            <Button onClick={onApply} disabled={!normalizeHexLocal(hexText || "")}>
              Update
            </Button>
          ) : null}
          <Button onClick={onReset} variant="secondary">
            Reset
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs text-neutral-600">Palette (Paint search)</div>
          <div className="mt-1">{paintPickerEl}</div>
        </div>

        <div>
          <div className="text-xs text-neutral-600">Custom picker</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={toSafeHexForColorInput(hexText)}
              onChange={(e) => handleColorPicker(e.target.value)}
              className="h-9 w-14 rounded border-0 p-0"
            />
            <div className="text-sm text-neutral-700">{normalizeHexLocal(hexText || "") || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
