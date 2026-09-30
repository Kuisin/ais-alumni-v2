import { demoMe, demoResponse } from "@/server/lib/demo/fixtures";
import { isDemoRequest, isDemoToken } from "@/server/lib/demo/session";
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
  pattern,
  parts: pattern.split("/"),
  mod,
}));

/**
 * Routes the App Review demo account reaches for real: signing in and out,
 * the app config and お問い合わせ. Everything else it asks is answered from fixtures
 * (src/server/lib/demo) — a route without one gets nothing, never data.
 */
const DEMO_REAL = new Set([
  "auth/email/request",
  "auth/email/verify",
  "auth/signout",
  "config",
  // お問い合わせ: only the account's own name / email; messages reach the
  // committee, so App Review can write to us.
  "support",
]);

const noStore = { "Cache-Control": "private, no-store" };

async function demoAnswer(
  method: string,
  route: string,
  params: Record<string, string>,
  request: Request,
): Promise<Response> {
  const data = await demoResponse(method, route, params, request);
  if (data !== undefined) return Response.json(data, { headers: noStore });
  if (method === "GET")
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: noStore },
    );
  return Response.json({ ok: true }, { headers: noStore });
}

/** Signing in as the demo account: its demo profile, not the real one. */
async function withDemoMe(response: Response): Promise<Response> {
  if (!response.ok) return response;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as {
    token?: string;
  } | null;
  if (!body?.token || !(await isDemoToken(body.token))) return response;
  return Response.json({ ...body, me: demoMe() }, { headers: noStore });
}

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
    if (ok) return { route: r.pattern, mod: r.mod, params };
  }
  return null;
}

function dispatch(method: string) {
  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const rest = pathname.startsWith(PREFIX)
      ? pathname.slice(PREFIX.length)
      : "";
    const found = match(rest.replace(/\/+$/, "").split("/"));
    if (!found) return Response.json({ error: "not_found" }, { status: 404 });
    const handler: Handler | undefined = found.mod[method];
    if (!handler)
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    if (!DEMO_REAL.has(found.route) && (await isDemoRequest(request)))
      return demoAnswer(method, found.route, found.params, request);
    const response = await handler(request, found.params);
    return found.route === "auth/email/verify"
      ? withDemoMe(response)
      : response;
  };
}

export const GET = dispatch("GET");
export const POST = dispatch("POST");
export const PUT = dispatch("PUT");
export const PATCH = dispatch("PATCH");
export const DELETE = dispatch("DELETE");
