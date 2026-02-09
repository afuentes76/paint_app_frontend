// src/lib/api.ts

import { getToken, logout } from "./auth";

type FetchInput = RequestInfo | URL;

export async function fetchWithAuth(input: FetchInput, init: RequestInit = {}): Promise<Response> {
  const token = getToken();

  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const finalInit: RequestInit = {
    ...init,
    headers,
  };

  let res: Response;
  try {
    res = await fetch(input, finalInit);
  } catch (err) {
    console.error("fetchWithAuth network error:", err);
    throw err;
  }

  if (res.status === 401 || res.status === 403) {
    logout("/login");
    throw new Error(`Unauthorized (${res.status})`);
  }

  return res;
}
