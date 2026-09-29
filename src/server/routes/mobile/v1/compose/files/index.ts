import { uploadNewsFileAction } from "@/server/app/actions/news-hub";
import { readForm } from "@/server/lib/mobile/compose";
import { json, mobileRoute } from "@/server/lib/mobile/http";

/**
 * Upload one ニュース attachment (multipart `file`) before the post is saved
 * — the website's uploadNewsFileAction (authors only; type sniffed, ≤ 10 MB;
 * the platform caps request bodies at 4.5 MB).
 */
export const POST = mobileRoute(async ({ request }) => {
  const r = await uploadNewsFileAction(await readForm(request));
  if (r.ok) return { ok: true, item: r.item };
  const status =
    r.error === "forbidden" ? 403 : r.error === "generic" ? 500 : 400;
  return json({ error: r.error }, { status });
});
