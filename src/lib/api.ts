import type { ApiErrorBody, Locale } from "@contract/core";
import { API_URL } from "./config";

/**
 * Client for the website's /api/mobile/v1 JSON API. The signed-in session
 * (bearer token) and the member's language are set by AuthProvider; every
 * request carries both. The language header is the one next-intl reads on
 * the server, so any text the server composes matches the app.
 */

type Session = { token: string | null; locale: Locale };
const session: Session = { token: null, locale: "ja" };
let onUnauthorized: (() => void) | null = null;

export function setApiSession(token: string | null, locale: Locale): void {
  session.token = token;
  session.locale = locale;
}

export function getApiToken(): string | null {
  return session.token;
}

/** Called when the server says the session is gone (401). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 = no response (offline, DNS, timeout) */
    readonly status: number,
    /** the server's error code (ApiErrorBody.error), or "network" */
    readonly code: string,
    readonly body: ApiErrorBody | null = null,
  ) {
    super(`${status} ${code}`);
  }
}

export function isApiError(e: unknown, code?: string): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/** `path` is relative to /api/mobile/v1, e.g. "/news?page=2". */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-NEXT-INTL-LOCALE": session.locale,
  };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/mobile/v1${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    throw new ApiError(0, "network");
  }
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const body =
      data && typeof data === "object" && "error" in data
        ? (data as ApiErrorBody)
        : null;
    if (res.status === 401 && session.token) onUnauthorized?.();
    throw new ApiError(res.status, body?.error ?? "server_error", body);
  }
  return data as T;
}
