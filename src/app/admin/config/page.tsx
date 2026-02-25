"use client";

import React, { useEffect, useMemo, useState } from "react";

import Protected from "@/components/Protected";
import { fetchWithAuth } from "@/lib/api";

import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Button } from "@/ui/components/Button";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { Loading } from "@/ui/components/Loading";
import { cn, theme } from "@/ui/theme";

type AdminSettingsDTO = {
  // Replicate infra
  public_base_url?: string | null;
  replicate_poll_seconds?: number | null;
  replicate_fallback_poll_interval_s?: number | null;
  replicate_fallback_max_attempts?: number | null;

  // write-only secrets (sent only on PATCH when user types something)
  replicate_api_token?: string | null;
  replicate_webhook_secret?: string | null;

  // Theme
  theme_name?: string | null;

  // AI settings
  repaint_model?: "BLACK_FOREST" | "QWEN" | "QWEN_SEQUENTIAL" | string | null;
  mask_adjust_factor?: number | null;

  // Black Forest only
  repaint_guidance?: number | null;
  repaint_steps?: number | null;
  repaint_lora_scale?: number | null;

  // for GET display
  replicate_api_token_set?: boolean;
  replicate_webhook_secret_set?: boolean;
};

const THEMES = [
  { value: "default", label: "Default" },
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" },
  { value: "friendly", label: "Friendly" },
  { value: "contractor", label: "Contractor" },
  { value: "premium", label: "Premium" },
];

type RepaintModel = {
  value: string;
  label: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function applyTheme(themeName: string) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = themeName || "default";
}

function Row(props: {
  title: string;
  help?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("grid items-center gap-3", "md:grid-cols-[240px_1fr]")}>
      <div className="space-y-0.5">
        <div className={cn("text-sm font-medium", theme.color.text)}>{props.title}</div>
        {props.help ? (
          <div className={cn("text-xs leading-4", theme.color.mutedText)}>{props.help}</div>
        ) : null}
      </div>
      <div className={cn(props.wide ? "w-full" : "max-w-[520px]")}>{props.children}</div>
    </div>
  );
}

function Slider(props: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fmt = props.format || ((v) => String(v));
  return (
    <div className="flex items-center gap-3">
      <input
        className="w-full"
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <div className={cn("w-[64px] text-right text-xs tabular-nums", theme.color.mutedText)}>
        {fmt(props.value)}
      </div>
    </div>
  );
}

export default function AdminConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorFriendly, setErrorFriendly] = useState<string | null>(null);

  const [data, setData] = useState<AdminSettingsDTO | null>(null);
  const [draft, setDraft] = useState<AdminSettingsDTO | null>(null);
  const [repaintModels, setRepaintModels] = useState<RepaintModel[]>([]);

  const dirty = useMemo(() => {
    if (!data || !draft) return false;
    // Only compare fields that are persisted via PATCH.
    const keys: (keyof AdminSettingsDTO)[] = [
      "public_base_url",
      "replicate_poll_seconds",
      "replicate_fallback_poll_interval_s",
      "replicate_fallback_max_attempts",
      "theme_name",
      "repaint_model",
      "mask_adjust_factor",
      "repaint_guidance",
      "repaint_steps",
      "repaint_lora_scale",
    ];
    return keys.some((k) => (data[k] ?? null) !== (draft[k] ?? null));
  }, [data, draft]);

  async function load() {
    setLoading(true);
    setErrorFriendly(null);
    try {
      // Load settings
      const res = await fetchWithAuth("/api/admin/settings", { method: "GET" });
      const j = (await res.json()) as AdminSettingsDTO;
      setData(j);
      setDraft({
        ...j,
        // never keep secrets in draft; write-only
        replicate_api_token: "",
        replicate_webhook_secret: "",
      });
      applyTheme(j.theme_name || "default");

      // Load repaint models
      const modelsRes = await fetchWithAuth("/api/admin/repaint-models", { method: "GET" });
      const modelsData = await modelsRes.json();
      setRepaintModels(modelsData.repaint_models || []);
    } catch (e: unknown) {
      setErrorFriendly(e instanceof Error ? e.message : "Failed to load settings");
      setData(null);
      setDraft(null);
      setRepaintModels([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErrorFriendly(null);
    try {
      const payload: AdminSettingsDTO = {
        public_base_url: draft.public_base_url ?? null,
        replicate_poll_seconds: draft.replicate_poll_seconds ?? null,
        replicate_fallback_poll_interval_s: draft.replicate_fallback_poll_interval_s ?? null,
        replicate_fallback_max_attempts: draft.replicate_fallback_max_attempts ?? null,
        theme_name: draft.theme_name ?? null,
        repaint_model: draft.repaint_model ?? null,
        mask_adjust_factor: draft.mask_adjust_factor ?? null,
        repaint_guidance: draft.repaint_guidance ?? null,
        repaint_steps: draft.repaint_steps ?? null,
        repaint_lora_scale: draft.repaint_lora_scale ?? null,
      };

      // Only send secrets if user typed them
      const token = (draft.replicate_api_token || "").trim();
      const whsec = (draft.replicate_webhook_secret || "").trim();
      if (token) payload.replicate_api_token = token;
      if (whsec) payload.replicate_webhook_secret = whsec;

      const res = await fetchWithAuth("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Save failed (${res.status})`);
      }

      const j = (await res.json()) as AdminSettingsDTO;
      setData(j);
      setDraft({
        ...j,
        replicate_api_token: "",
        replicate_webhook_secret: "",
      });
      applyTheme(j.theme_name || "default");
    } catch (e: unknown) {
      setErrorFriendly(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const model = draft?.repaint_model || "BLACK_FOREST";
  const showBlackForest = model === "BLACK_FOREST";

  return (
    <Protected role="ADMIN">
      <div className="max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold">Admin Config</div>
            <div className={cn("mt-1 text-sm", theme.color.mutedText)}>
              Global settings for Replicate + repaint behavior + UI theme.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={load} disabled={loading || saving}>
              Reload
            </Button>
            <Button onClick={save} disabled={!dirty || saving || loading}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {errorFriendly ? (
          <div className="mt-4">
            <ErrorBanner message={errorFriendly} />
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {loading ? (
            <Card>
              <Loading label="Loading settings..." />
            </Card>
          ) : !draft ? (
            <Card>
              <div className={cn("text-sm", theme.color.mutedText)}>No settings loaded.</div>
            </Card>
          ) : (
            <>
              <Card>
                <div className="space-y-4">
                  <div className="text-lg font-semibold">Theme</div>

                  <Row title="Theme preset" help="Applied immediately and saved globally for all users.">
                    <Select
                      value={draft.theme_name || "default"}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft({ ...draft, theme_name: v });
                        applyTheme(v);
                      }}
                    >
                      {THEMES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Row>
                </div>
              </Card>

              <Card>
                <div className="space-y-4">
                  <div className="text-lg font-semibold">Replicate</div>

                  <Row
                    title="Public Base URL"
                    help="Image source for Replicate (where it fetches /public/tasks/... files)."
                    wide
                  >
                    <Input
                      value={draft.public_base_url || ""}
                      placeholder="https://xxxx.trycloudflare.com"
                      onChange={(e) => setDraft({ ...draft, public_base_url: e.target.value })}
                    />
                  </Row>

                  <Row title="Poll seconds" help="Frontend polling interval (seconds).">
                    <Slider
                      value={clamp(Number(draft.replicate_poll_seconds ?? 5), 1, 60)}
                      min={1}
                      max={60}
                      step={1}
                      onChange={(v) => setDraft({ ...draft, replicate_poll_seconds: v })}
                      format={(v) => `${v}s`}
                    />
                  </Row>

                  <Row
                    title="API Token (write-only)"
                    help={draft.replicate_api_token_set ? "Token is set. Leave blank to keep it." : "No token saved yet."}
                    wide
                  >
                    <Input
                      type="password"
                      value={draft.replicate_api_token || ""}
                      placeholder="paste new token"
                      onChange={(e) => setDraft({ ...draft, replicate_api_token: e.target.value })}
                    />
                  </Row>

                  <Row
                    title="Webhook Secret (whsec_...) (write-only)"
                    help={
                      draft.replicate_webhook_secret_set
                        ? "Webhook secret is set. Leave blank to keep it."
                        : "No webhook secret saved yet."
                    }
                    wide
                  >
                    <Input
                      type="password"
                      value={draft.replicate_webhook_secret || ""}
                      placeholder="whsec_..."
                      onChange={(e) => setDraft({ ...draft, replicate_webhook_secret: e.target.value })}
                    />
                  </Row>

                  <Row title="Webhook fallback poll interval" help="If webhook is slow, poll Replicate every N seconds.">
                    <Slider
                      value={clamp(Number(draft.replicate_fallback_poll_interval_s ?? 12), 1, 60)}
                      min={1}
                      max={60}
                      step={1}
                      onChange={(v) => setDraft({ ...draft, replicate_fallback_poll_interval_s: v })}
                      format={(v) => `${v}s`}
                    />
                  </Row>

                  <Row title="Webhook fallback max attempts" help="Maximum poll attempts before giving up.">
                    <Slider
                      value={clamp(Number(draft.replicate_fallback_max_attempts ?? 10), 1, 120)}
                      min={1}
                      max={120}
                      step={1}
                      onChange={(v) => setDraft({ ...draft, replicate_fallback_max_attempts: v })}
                    />
                  </Row>
                </div>
              </Card>

              <Card>
                <div className="space-y-4">
                  <div className="text-lg font-semibold">AI Settings</div>

                  <Row title="Model choice + parameters" help="Controls repaint engine behavior.">
                    <Select
                      value={draft.repaint_model || "BLACK_FOREST"}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft({ ...draft, repaint_model: v });
                      }}
                    >
                      {repaintModels.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </Row>

                  <Row title="Mask adjustment factor" help="Used for API1 (mask generation). Range: -100 to 100.">
                    <Slider
                      value={clamp(Number(draft.mask_adjust_factor ?? 0), -100, 100)}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(v) => setDraft({ ...draft, mask_adjust_factor: v })}
                    />
                  </Row>

                  {showBlackForest ? (
                    <>
                      <Row title="Guidance" help="Flux Fill guidance.">
                        <Slider
                          value={clamp(Number(draft.repaint_guidance ?? 30), 0, 100)}
                          min={0}
                          max={100}
                          step={1}
                          onChange={(v) => setDraft({ ...draft, repaint_guidance: v })}
                        />
                      </Row>

                      <Row title="Steps" help="Denoising steps. Recommended 28–50.">
                        <Slider
                          value={clamp(Number(draft.repaint_steps ?? 28), 1, 50)}
                          min={1}
                          max={50}
                          step={1}
                          onChange={(v) => setDraft({ ...draft, repaint_steps: v })}
                        />
                      </Row>

                      <Row title="LoRA scale" help="Style strength (LoRA scale).">
                        <Slider
                          value={clamp(Number(draft.repaint_lora_scale ?? 1.0), 0.0, 2.0)}
                          min={0}
                          max={2}
                          step={0.05}
                          onChange={(v) => setDraft({ ...draft, repaint_lora_scale: v })}
                          format={(v) => v.toFixed(2)}
                        />
                      </Row>
                    </>
                  ) : (
                    <div className={cn("rounded-md border p-3 text-sm", theme.color.border, theme.color.mutedText)}>
                      Qwen modes:
                      <div className="mt-1">
                        • <b>single</b>: one accumulated prompt (one prediction)
                      </div>
                      <div>
                        • <b>sequential</b>: one prompt per step (multiple predictions, output feeds next step)
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </Protected>
  );
}