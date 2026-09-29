import type { ComposeSaved } from "@contract/compose";
import { type Href, useRouter } from "expo-router";
import { hrefFor } from "@/lib/links";

/**
 * Where the website goes after creating a post / event: admin mode's page
 * for it (?created=1), or the 「通知を送る」 confirm step (?notify=1). Without
 * that screen in the app, back to the list the form was opened from.
 */
export function useAfterCreate(kind: "news" | "events") {
  const router = useRouter();
  return (saved: ComposeSaved) => {
    const next = saved.next ? `?${saved.next}=1` : "";
    const admin = hrefFor(`/app/admin/${kind}/${saved.id}${next}`);
    if (admin) {
      router.replace(admin);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(`/${kind}` as Href);
  };
}
