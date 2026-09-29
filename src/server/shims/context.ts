import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The request being handled, for code written against Next.js's request
 * APIs (`headers()`, `cookies()`, next-intl's `getLocale()`): API routes run
 * their handler inside `withRequest` (src/server/lib/mobile/http.ts).
 */
type Ctx = { request: Request; locale: "ja" | "en" };

const store = new AsyncLocalStorage<Ctx>();

export function withRequest<T>(
  request: Request,
  fn: () => Promise<T>,
): Promise<T> {
  const header = request.headers.get("x-next-intl-locale");
  const locale = header === "en" ? "en" : "ja";
  return store.run({ request, locale }, fn);
}

export function currentRequest(): Ctx | undefined {
  return store.getStore();
}

/** Set the locale for the rest of the request (e.g. the member's own). */
export function setRequestLocale(locale: "ja" | "en"): void {
  const ctx = store.getStore();
  if (ctx) ctx.locale = locale;
}
