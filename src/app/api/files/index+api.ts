import { getPrivate, verifySignedFile } from "@/server/lib/storage";

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
