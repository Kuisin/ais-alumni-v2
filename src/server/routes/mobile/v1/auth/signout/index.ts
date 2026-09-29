import { json } from "@/server/lib/mobile/http";
import { bearerToken, revokeMobileSession } from "@/server/lib/mobile/tokens";

/** Sign this device out (idempotent). */
export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (token) await revokeMobileSession(token);
  return json({ ok: true });
}
