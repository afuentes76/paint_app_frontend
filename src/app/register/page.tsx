"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";
import { ErrorBanner } from "@/ui/components/ErrorBanner";
import { FormField } from "@/ui/components/FormField";

type Pt = { x: number; y: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Ellipse border point in direction from center to target:
 * center + t * dir where t = 1 / sqrt((dx/rx)^2 + (dy/ry)^2)
 */
function ellipseBorderPoint(center: Pt, rx: number, ry: number, target: Pt): Pt {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const denom = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  if (!isFinite(denom) || denom === 0) return center;
  const t = 1 / denom;
  return { x: center.x + dx * t, y: center.y + dy * t };
}

/**
 * Create a smooth cubic curve between two points with a gentle bend.
 * Bend is computed perpendicular to the direction vector.
 */
function curvedPath(a: Pt, b: Pt, bendPx: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  // Perpendicular
  const px = -uy;
  const py = ux;

  const bend = clamp(bendPx, -220, 220);

  const c1: Pt = {
    x: a.x + dx * 0.33 + px * bend,
    y: a.y + dy * 0.33 + py * bend,
  };
  const c2: Pt = {
    x: a.x + dx * 0.66 + px * bend,
    y: a.y + dy * 0.66 + py * bend,
  };

  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} C ${c1.x.toFixed(2)} ${c1.y.toFixed(
    2
  )}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/**
 * Full-width flow layer that spans the entire hero content area.
 * Positions are your current baseline; arrows are computed border-to-border.
 */
function HowItWorksFlowFull() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const b1Ref = useRef<HTMLDivElement | null>(null);
  const b2Ref = useRef<HTMLDivElement | null>(null);
  const b3Ref = useRef<HTMLDivElement | null>(null);
  const b4Ref = useRef<HTMLDivElement | null>(null);
  const b5Ref = useRef<HTMLDivElement | null>(null);

  const [paths, setPaths] = useState<{ p12: string; p23: string; p34: string; p45: string } | null>(null);
  const [vb, setVb] = useState({ w: 1200, h: 520 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const compute = () => {
      const c = canvasRef.current;
      const b1 = b1Ref.current;
      const b2 = b2Ref.current;
      const b3 = b3Ref.current;
      const b4 = b4Ref.current;
      const b5 = b5Ref.current;
      if (!c || !b1 || !b2 || !b3 || !b4 || !b5) return;

      const cr = c.getBoundingClientRect();

      const rectToLocal = (r: DOMRect) => ({
        x: r.left - cr.left,
        y: r.top - cr.top,
        w: r.width,
        h: r.height,
      });

      const r1 = rectToLocal(b1.getBoundingClientRect());
      const r2 = rectToLocal(b2.getBoundingClientRect());
      const r3 = rectToLocal(b3.getBoundingClientRect());
      const r4 = rectToLocal(b4.getBoundingClientRect());
      const r5 = rectToLocal(b5.getBoundingClientRect());

      const c1 = { x: r1.x + r1.w / 2, y: r1.y + r1.h / 2 };
      const c2 = { x: r2.x + r2.w / 2, y: r2.y + r2.h / 2 };
      const c3 = { x: r3.x + r3.w / 2, y: r3.y + r3.h / 2 };
      const c4 = { x: r4.x + r4.w / 2, y: r4.y + r4.h / 2 };
      const c5 = { x: r5.x + r5.w / 2, y: r5.y + r5.h / 2 };

      const e1 = { rx: r1.w / 2, ry: r1.h / 2 };
      const e2 = { rx: r2.w / 2, ry: r2.h / 2 };
      const e3 = { rx: r3.w / 2, ry: r3.h / 2 };
      const e4 = { rx: r4.w / 2, ry: r4.h / 2 };
      const e5 = { rx: r5.w / 2, ry: r5.h / 2 };

      const s12 = ellipseBorderPoint(c1, e1.rx, e1.ry, c2);
      const t12 = ellipseBorderPoint(c2, e2.rx, e2.ry, c1);

      const s23 = ellipseBorderPoint(c2, e2.rx, e2.ry, c3);
      const t23 = ellipseBorderPoint(c3, e3.rx, e3.ry, c2);

      const s34 = ellipseBorderPoint(c3, e3.rx, e3.ry, c4);
      const t34 = ellipseBorderPoint(c4, e4.rx, e4.ry, c3);

      const s45 = ellipseBorderPoint(c4, e4.rx, e4.ry, c5);
      const t45 = ellipseBorderPoint(c5, e5.rx, e5.ry, c4);

      const p12 = curvedPath(s12, t12, -50);
      const p23 = curvedPath(s23, t23, 90);
      const p34 = curvedPath(s34, t34, 50);
      const p45 = curvedPath(s45, t45, 55);

      setVb({ w: cr.width, h: cr.height });
      setPaths({ p12, p23, p34, p45 });
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(canvas);

    const onResize = () => compute();
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={canvasRef} className="flow-canvas" aria-hidden="true">
      <svg className="flow-arrows" viewBox={`0 0 ${vb.w} ${vb.h}`} preserveAspectRatio="none">
        <defs>
          <marker
            id="arrowHead"
            markerWidth="14"
            markerHeight="14"
            refX="12"
            refY="7"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L14,7 L0,14 Z" fill="rgba(15,23,42,0.62)" />
          </marker>
        </defs>

        {paths ? (
          <>
            <path d={paths.p12} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="10" strokeLinecap="round" />
            <path
              d={paths.p12}
              fill="none"
              stroke="rgba(15,23,42,0.55)"
              strokeWidth="4"
              strokeLinecap="round"
              markerEnd="url(#arrowHead)"
            />

            <path d={paths.p23} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="10" strokeLinecap="round" />
            <path
              d={paths.p23}
              fill="none"
              stroke="rgba(15,23,42,0.55)"
              strokeWidth="4"
              strokeLinecap="round"
              markerEnd="url(#arrowHead)"
            />

            <path d={paths.p34} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="10" strokeLinecap="round" />
            <path
              d={paths.p34}
              fill="none"
              stroke="rgba(15,23,42,0.55)"
              strokeWidth="4"
              strokeLinecap="round"
              markerEnd="url(#arrowHead)"
            />

            <path d={paths.p45} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="10" strokeLinecap="round" />
            <path
              d={paths.p45}
              fill="none"
              stroke="rgba(15,23,42,0.55)"
              strokeWidth="4"
              strokeLinecap="round"
              markerEnd="url(#arrowHead)"
            />
          </>
        ) : null}
      </svg>

      <div ref={b1Ref} className="flow-bubble flow-1">
        <div className="flow-num">1</div>
        <div className="flow-text">Create a task</div>
      </div>

      <div ref={b2Ref} className="flow-bubble flow-2">
        <div className="flow-num">2</div>
        <div className="flow-text">Scan QR</div>
      </div>

      <div ref={b3Ref} className="flow-bubble flow-3">
        <div className="flow-num">3</div>
        <div className="flow-text">Upload photo</div>
      </div>

      <div ref={b4Ref} className="flow-bubble flow-4">
        <div className="flow-num">4</div>
        <div className="flow-text">Select colors</div>
      </div>

      <div ref={b5Ref} className="flow-bubble flow-5">
        <div className="flow-num">5</div>
        <div className="flow-text">Let the magic happen</div>
      </div>
    </div>
  );
}

function friendlyRegisterError(status: number): string {
  if (status === 409) return "Email already exists";
  if (status === 401 || status === 403) return "Registration not allowed";
  if (status === 400) return "Invalid registration data";
  if (status === 500) return "Server error occurred during registration. Please check server logs.";
  return "Registration failed";
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && confirmPassword.length > 0 && !loading;
  }, [email, password, confirmPassword, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setErrorMsg(friendlyRegisterError(res.status));
        return;
      }

      // Same behavior you had before (no auto-login). Redirect to login.
      router.replace("/login");
    } catch (err) {
      console.error("Register network/unknown error:", err);
      setErrorMsg("Cannot reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="relative left-1/2 right-1/2 w-screen -ml-[50vw] -mr-[50vw] overflow-x-hidden">
        <div className="relative h-[calc(100vh-72px)] w-full overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="login-colorwash absolute inset-0" />

            <div className="login-circles absolute -left-[520px] top-[120px] h-[920px] w-[920px]" />
            <div className="login-circles2 absolute left-[140px] top-[40px] h-[560px] w-[560px]" />
            <div className="login-circles3 absolute left-[60px] bottom-[40px] h-[260px] w-[260px]" />

            <div className="login-blob absolute -left-64 top-0 h-[520px] w-[520px] rounded-full blur-3xl" />
            <div className="login-blob2 absolute -right-72 top-24 h-[640px] w-[640px] rounded-full blur-3xl" />
            <div className="login-blob3 absolute left-[35%] bottom-[-260px] h-[620px] w-[620px] rounded-full blur-3xl" />
          </div>

          <div className="relative mx-auto h-full w-full max-w-[1200px] px-8 py-10">
            <HowItWorksFlowFull />

            <div className="relative flex w-full items-start justify-between gap-10">
              <div className="min-w-0 flex-1">
                <div className="max-w-[640px]">
                  <h1 className="mt-1 text-5xl font-extrabold leading-tight">Easy previews</h1>
                </div>
              </div>

              <div className="w-[420px] shrink-0 mt-6">
                <Card className="rounded-2xl">
                  <div className="p-6">
                    <div className="mb-5 flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: "rgb(36,116,245)" }}
                      ></div>
                      <div className="leading-tight">
                        <div className="text-sm font-bold">&nbsp;&nbsp;&nbsp;&nbsp;Create Account</div>
                      </div>
                    </div>

                    {errorMsg ? (
                      <div className="mb-4">
                        <ErrorBanner message={errorMsg} />
                      </div>
                    ) : null}

                    <form onSubmit={onSubmit} className="space-y-3 flex flex-col items-center">
                      <div className="w-[90%]">
                        <FormField label="Email" required>
                          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                        </FormField>
                      </div>

                      <div className="w-[90%]">
                        <FormField label="Password" required>
                          <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                          />
                        </FormField>
                      </div>

                      <div className="w-[90%]">
                        <FormField label="Confirm Password" required>
                          <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                          />
                        </FormField>
                      </div>

                      <div className="w-[50%] pt-4">
                        <div>&nbsp;</div>
                        <Button type="submit" disabled={!canSubmit || loading} className="w-full">
                          {loading ? "Creating..." : "Create account"}
                        </Button>
                      </div>

                      <div className="mt-5 flex items-center justify-between text-sm">
                        <Link href="/login" className="underline opacity-80 hover:opacity-100">
                          Sign in
                        </Link>
                      </div>
                    </form>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        html,
        body {
          height: 100%;
          overflow: hidden;
          overflow-x: hidden;
        }

        .login-colorwash {
          background: radial-gradient(circle at 12% 18%, rgba(37, 99, 235, 0.18), transparent 46%),
            radial-gradient(circle at 78% 26%, rgba(6, 182, 212, 0.12), transparent 48%),
            radial-gradient(circle at 55% 86%, rgba(99, 102, 241, 0.1), transparent 46%),
            linear-gradient(to bottom, #f7f9fc, #f2f6ff);
          animation: loginHue 18s ease-in-out infinite;
          filter: saturate(1.03);
        }

        .login-circles {
          background: radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.14) 0 34%, transparent 34% 100%),
            radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.1) 0 52%, transparent 52% 100%),
            radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.07) 0 68%, transparent 68% 100%);
          animation: circleDrift 10s ease-in-out infinite;
          opacity: 1;
        }

        .login-circles2 {
          background: radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.12) 0 32%, transparent 32% 100%),
            radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.09) 0 48%, transparent 48% 100%),
            radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.06) 0 64%, transparent 64% 100%);
          animation: circleDrift2 12s ease-in-out infinite;
          opacity: 1;
        }

        .login-circles3 {
          background: radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.12) 0 36%, transparent 36% 100%),
            radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.08) 0 58%, transparent 58% 100%);
          animation: circleDrift3 9s ease-in-out infinite;
          opacity: 1;
        }

        .login-blob {
          background: rgba(37, 99, 235, 0.12);
          animation: loginFloat 12s ease-in-out infinite;
        }
        .login-blob2 {
          background: rgba(6, 182, 212, 0.1);
          animation: loginFloat2 14s ease-in-out infinite;
        }
        .login-blob3 {
          background: rgba(99, 102, 241, 0.09);
          animation: loginFloat3 16s ease-in-out infinite;
        }

        .flow-canvas {
          position: absolute;
          left: 0;
          right: 0;
          top: 72px;
          height: clamp(420px, 52vh, 560px);
          pointer-events: none;
        }

        .flow-arrows {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 1;
          filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.18));
        }

        .flow-bubble {
          position: absolute;
          width: clamp(200px, 18vw, 240px);
          height: clamp(140px, 13vw, 170px);
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;

          background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(242, 247, 255, 0.94));
          border: 1px solid rgba(15, 23, 42, 0.1);
          box-shadow: 0 22px 46px rgba(15, 23, 42, 0.18), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
        }

        .flow-num {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.88);
          background: rgba(37, 99, 235, 0.14);
          border: 1px solid rgba(37, 99, 235, 0.22);
          box-shadow: 0 12px 20px rgba(15, 23, 42, 0.14);
        }

        .flow-text {
          font-weight: 900;
          letter-spacing: 0.2px;
          color: rgba(15, 23, 42, 0.86);
          text-align: center;
          padding: 0 16px;
          line-height: 1.15;
          font-size: 15px;
        }

        .flow-1 {
          left: 180px;
          top: 0px;
        }
        .flow-2 {
          left: 550px;
          top: 110px;
        }
        .flow-3 {
          left: 100px;
          top: 250px;
        }
        .flow-4 {
          left: 460px;
          top: 320px;
        }
        .flow-5 {
          left: 840px;
          top: 220px;
          width: clamp(220px, 20vw, 270px);
        }

        @keyframes circleDrift {
          0% {
            transform: translate(0, 0) scale(0.5);
          }
          40% {
            transform: translate(26px, 18px) scale(1.25);
          }
          75% {
            transform: translate(10px, 30px) scale(0.92);
          }
          100% {
            transform: translate(0, 0) scale(0.5);
          }
        }

        @keyframes circleDrift2 {
          0% {
            transform: translate(0, 0) scale(0.95);
          }
          45% {
            transform: translate(-54px, 54px) scale(1.14);
          }
          80% {
            transform: translate(-14px, 18px) scale(0.91);
          }
          100% {
            transform: translate(0, 0) scale(0.95);
          }
        }

        @keyframes circleDrift3 {
          0% {
            transform: translate(0, 0) scale(0.92);
          }
          50% {
            transform: translate(16px, -12px) scale(1.18);
          }
          85% {
            transform: translate(-8px, 10px) scale(0.9);
          }
          100% {
            transform: translate(0, 0) scale(0.92);
          }
        }

        @keyframes loginFloat {
          0% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(16px, 10px) scale(1.05);
          }
          100% {
            transform: translate(0, 0) scale(1);
          }
        }

        @keyframes loginFloat2 {
          0% {
            transform: translate(0, 0) scale(0.8);
          }
          50% {
            transform: translate(-18px, 12px) scale(1.25);
          }
          100% {
            transform: translate(0, 0) scale(0.8);
          }
        }

        @keyframes loginFloat3 {
          0% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(10px, -18px) scale(1.25);
          }
          100% {
            transform: translate(0, 0) scale(1);
          }
        }

        @keyframes loginHue {
          0% {
            filter: hue-rotate(0deg) saturate(1.03);
          }
          50% {
            filter: hue-rotate(10deg) saturate(1.18);
          }
          100% {
            filter: hue-rotate(0deg) saturate(1.03);
          }
        }

        @media (max-width: 980px) {
          .flow-canvas {
            display: none;
          }
          html,
          body {
            overflow: auto;
          }
        }
      `}</style>
    </div>
  );
}