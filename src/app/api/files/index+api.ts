import { roundImagePng } from "@/server/lib/og/image-response";
import { getPrivate, verifySignedFile } from "@/server/lib/storage";

/** ?round=<px>: the image as a circle, that many pixels wide (32–256). */
const ROUND = { min: 32, max: 256 };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (
    !verifySignedFile(
      key,
      url.searchParams.get("exp"),
      url.searchParams.get("sig"),
    )
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  const name = url.searchParams.get("name")?.slice(0, 200) ?? null;
  const file = await getPrivate(key);
  if (!file) return new Response("Not found", { status: 404 });
  const round = Number(url.searchParams.get("round"));
  if (
    round &&
    (file.contentType === "image/jpeg" || file.contentType === "image/png")
  ) {
    const size = Math.round(Math.min(ROUND.max, Math.max(ROUND.min, round)));
    const bytes = new Uint8Array(
      await new Response(file.body as BodyInit).arrayBuffer(),
    );
    const png = await roundImagePng(bytes, file.contentType, size);
    return new Response(png as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=900",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return new Response(file.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=900",
      "X-Content-Type-Options": "nosniff",
      // Original name for downloads (only the header; the key is signed).
      "Content-Disposition": name
        ? `inline; filename*=UTF-8''${encodeURIComponent(name)}`
        : "inline",
    },
  });
}
