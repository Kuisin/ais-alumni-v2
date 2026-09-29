import { currentRequest } from "./context";

/** `next/headers` for Expo API routes: the current request's headers. */
export async function headers(): Promise<Headers> {
  return currentRequest()?.request.headers ?? new Headers();
}

type Cookie = { name: string; value: string };

/** Read-only cookies of the current request (API routes set none). */
export async function cookies() {
  const raw = currentRequest()?.request.headers.get("cookie") ?? "";
  const all: Cookie[] = raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf("=");
      return {
        name: decodeURIComponent(p.slice(0, i)),
        value: decodeURIComponent(p.slice(i + 1)),
      };
    });
  return {
    get: (name: string) => all.find((c) => c.name === name),
    getAll: () => all,
    has: (name: string) => all.some((c) => c.name === name),
    set: () => {},
    delete: () => {},
  };
}
