import { type Handler, ROUTES } from "@/server/routes/table";

/**
 * The whole /api/mobile/v1 JSON API in one server bundle: Expo bundles every
 * API route file separately, each with its own copy of the database client
 * and shared code, so 50 route files made a ~450 MB server build (slow to
 * package and deploy). Handlers live in src/server/routes/mobile/v1
 * (<path>/index.ts, exporting GET / POST / …) and are found here by path.
 */

const PREFIX = "/api/mobile/v1/";

const COMPILED = ROUTES.map(([pattern, mod]) => ({
  parts: pattern.split("/"),
  mod,
}));

function match(segments: string[]) {
  for (const r of COMPILED) {
    if (r.parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const part = r.parts[i];
      const seg = segments[i];
      if (part.startsWith("[") && part.endsWith("]"))
        params[part.slice(1, -1)] = decodeURIComponent(seg);
      else if (part !== seg) {
        ok = false;
        break;
      }
    }
    if (ok) return { mod: r.mod, params };
  }
  return null;
}

function dispatch(method: string) {
  return (request: Request): Response | Promise<Response> => {
    const { pathname } = new URL(request.url);
    const rest = pathname.startsWith(PREFIX)
      ? pathname.slice(PREFIX.length)
      : "";
    const found = match(rest.replace(/\/+$/, "").split("/"));
    if (!found) return Response.json({ error: "not_found" }, { status: 404 });
    const handler: Handler | undefined = found.mod[method];
    if (!handler)
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    return handler(request, found.params);
  };
}

export const GET = dispatch("GET");
export const POST = dispatch("POST");
export const PUT = dispatch("PUT");
export const PATCH = dispatch("PATCH");
export const DELETE = dispatch("DELETE");
