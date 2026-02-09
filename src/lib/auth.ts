// src/lib/auth.ts

export type AppRole = "USER" | "ADMIN";

const JWT_KEY = "jwt";
const ROLE_KEY = "role";
const USER_ID_KEY = "user_id";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
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

export function isAuthenticated(): boolean {
  const token = getToken();
  return Boolean(token && token.trim().length > 0);
}

export function setAuth(params: { token: string; role: AppRole; userId?: string | null }): void {
  if (!isBrowser()) return;
  localStorage.setItem(JWT_KEY, params.token);
  localStorage.setItem(ROLE_KEY, params.role);
  if (params.userId) localStorage.setItem(USER_ID_KEY, params.userId);
}

export function logout(redirectTo: string = "/login"): void {
  if (isBrowser()) {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_ID_KEY);
    window.location.href = redirectTo;
  }
}
