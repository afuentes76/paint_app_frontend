// src/lib/auth.ts

export type AppRole = "USER" | "ADMIN";

const JWT_KEY = "jwt";
const ROLE_KEY = "role";
const USER_ID_KEY = "user_id";
const EMAIL_KEY = "email";

// same-tab event so persistent layouts can react immediately after login/logout
const AUTH_EVENT = "paintapp:auth";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notifyAuthChanged(): void {
  if (!isBrowser()) return;

  // Same-tab listeners
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    // ignore
  }

  // Cross-tab listeners (storage event)
  try {
    localStorage.setItem("auth_changed_at", String(Date.now()));
  } catch {
    // ignore
  }
}

export function getAuthEventName(): string {
  return AUTH_EVENT;
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(JWT_KEY);
}

export function getRole(): AppRole | null {
  if (!isBrowser()) return null;
  const role = localStorage.getItem(ROLE_KEY);
  if (role === "USER" || role === "ADMIN") return role;
  return null;
}

export function getEmail(): string | null {
  if (!isBrowser()) return null;
  const v = localStorage.getItem(EMAIL_KEY);
  return v && v.trim().length > 0 ? v : null;
}

export function isAuthenticated(): boolean {
  const token = getToken();
  return Boolean(token && token.trim().length > 0);
}

export function setAuth(params: { token: string; role: AppRole; userId?: string | null }): void {
  if (!isBrowser()) return;
  localStorage.setItem(JWT_KEY, params.token);
  localStorage.setItem(ROLE_KEY, params.role);
  if (params.userId) localStorage.setItem(USER_ID_KEY, params.userId);

  notifyAuthChanged();
}

export function setAuthEmail(email: string): void {
  if (!isBrowser()) return;
  const v = (email ?? "").trim();
  if (v.length === 0) localStorage.removeItem(EMAIL_KEY);
  else localStorage.setItem(EMAIL_KEY, v);

  notifyAuthChanged();
}

export function logout(redirectTo: string = "/login"): void {
  if (!isBrowser()) return;

  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(EMAIL_KEY);

  notifyAuthChanged();
  window.location.href = redirectTo;
}
