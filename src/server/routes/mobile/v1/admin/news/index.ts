import { adminNewsList } from "@/server/lib/mobile/admin/news";
import { mobileRoute, query } from "@/server/lib/mobile/http";

/** Parse ?page= as the website does (default 1, max 1000). */
function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}

/** ニュース管理: the posts the author may manage (?archived=1: archived ones). */
export const GET = mobileRoute(({ request, user, locale }) => {
  const q = query(request);
  return adminNewsList(
    user,
    { page: parsePage(q.page), archived: q.archived === "1" },
    locale,
  );
});
