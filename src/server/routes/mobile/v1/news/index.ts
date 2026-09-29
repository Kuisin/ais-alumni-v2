import { z } from "zod";
import { mobileRoute, query } from "@/server/lib/mobile/http";
import { listNews } from "@/server/lib/mobile/news";

/** ?page=N as the website's list (1…1000; anything else = 1). */
const Page = z.coerce.number().int().min(1).max(1000).catch(1);

/** ニュース list, one page (contract: NewsList). */
export const GET = mobileRoute(({ request, user, locale }) =>
  listNews(user, Page.parse(query(request).page), locale),
);
