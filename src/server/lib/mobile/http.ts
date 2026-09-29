import { z } from "zod";
import { AccountState } from "@/server/generated/prisma/enums";
import type { ApiErrorBody } from "@/server/lib/mobile/contract/core";
import { bearerToken } from "@/server/lib/mobile/tokens";
import {
  AuthError,
  type CurrentUser,
  getCurrentUser,
} from "@/server/lib/session";
import { setRequestLocale, withRequest } from "@/server/shims/context";

/**
 * JSON API for the app (/api/mobile/v1/*, Expo API routes under
 * src/app/api/mobile/v1). Every route runs inside the request context
 * (src/server/shims/context.ts, for code written against Next.js) and is
 * wrapped in mobileRoute(): it requires the bearer token (never the
 * website's cookie), resolves the member (getCurrentUser), checks their
 * account state, and turns thrown errors
 * into `{ error: "<code>" }` JSON with a matching status. Authorization
 * beyond "signed in" / "ACTIVE" stays in the shared lib code (src/lib/authz,
 * news-visibility, …) that the web pages use too — never re-implemented here.
 *
 * Responses carry machine-readable codes; the app translates them with the
 * same messages/*.json as the website. Dates are ISO strings.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export const notFound = () => new ApiError(404, "not_found");
export const forbidden = () => new ApiError(403, "forbidden");
export const invalid = (code = "invalid") => new ApiError(400, code);

export type Locale = "ja" | "en";

export type RouteCtx<P> = {
  request: Request;
  user: CurrentUser;
  params: P;
  /** the member's language (設定 → 言語), used for server-made text */
  locale: Locale;
};

type Access = "active" | "user";

/**
 * A route handler for signed-in members. `access`: "active" (default) for
 * approved members only — what every (member) page requires — or "user" for
 * any signed-in account (e.g. /me while an application is pending).
 */
export function mobileRoute<P = Record<string, never>>(
  handler: (ctx: RouteCtx<P>) => Promise<unknown>,
  access: Access = "active",
) {
  return (request: Request, params?: P): Promise<Response> =>
    withRequest(request, async () => {
      try {
        // The app's bearer token only — never the website's cookie, which a
        // page on the same site could make the member's browser send (CSRF).
        if (!bearerToken(request.headers.get("authorization")))
          throw new ApiError(401, "unauthenticated");
        const user = await getCurrentUser();
        if (!user) throw new ApiError(401, "unauthenticated");
        if (access === "active" && user.state !== AccountState.ACTIVE)
          throw new ApiError(403, "inactive", { state: user.state });
        // Server-made text follows the member's language (設定 → 言語).
        setRequestLocale(user.locale === "en" ? "en" : "ja");
        const result = await handler({
          request,
          user,
          params: (params ?? {}) as P,
          locale: user.locale === "en" ? "en" : "ja",
        });
        return result instanceof Response ? result : json(result);
      } catch (e) {
        return errorResponse(e);
      }
    });
}

/** A route anyone may call (sign-in). */
export function publicRoute(handler: (request: Request) => Promise<unknown>) {
  return (request: Request): Promise<Response> =>
    withRequest(request, async () => {
      try {
        const result = await handler(request);
        return result instanceof Response ? result : json(result);
      } catch (e) {
        return errorResponse(e);
      }
    });
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  // Member data: never cached by the platform or intermediaries.
  headers.set("Cache-Control", "private, no-store");
  return Response.json(data, { ...init, headers });
}

function errorBody(code: string, extra: Record<string, unknown> = {}) {
  return { error: code, ...extra } satisfies ApiErrorBody;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError)
    return json(errorBody(e.code, e.extra), { status: e.status });
  if (e instanceof AuthError) {
    const status = e.message === "unauthenticated" ? 401 : 403;
    return json(errorBody(e.message), { status });
  }
  if (e instanceof z.ZodError)
    return json(
      errorBody("invalid", {
        fields: [...new Set(e.issues.map((i) => i.path.join(".")))],
      }),
      { status: 400 },
    );
  // notFound() from shared page code.
  const digest = (e as { digest?: unknown } | null)?.digest;
  if (
    typeof digest === "string" &&
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")
  )
    return json(errorBody("not_found"), { status: 404 });
  console.error("[mobile-api]", e);
  return json(errorBody("server_error"), { status: 500 });
}

/** Parse a JSON body with a Zod schema (400 on anything else). */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw invalid("invalid_json");
  }
  return schema.parse(body);
}

/** Query parameters as a plain object, for Zod parsing. */
export function query(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

/** cuid-shaped ids from the URL (anything longer is not ours). */
export const IdParam = z.string().min(1).max(64);

/** Optional device description sent with every sign-in. */
export const DeviceSchema = z
  .object({
    platform: z.string().max(20).optional(),
    deviceName: z.string().max(100).optional(),
  })
  .optional()
  .catch(undefined);
