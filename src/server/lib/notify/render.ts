import type { Locale } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { formatDateTime } from "@/server/lib/format";
import { NOTIFY_KINDS, type NotifyCategory, type NotifyKind } from "./catalog";

export type NotifyParams = Record<
  string,
  string | number | Date | null | undefined
>;

export type RenderedNotification = {
  kind: NotifyKind;
  category: NotifyCategory;
  emoji: string;
  /** push headline */
  title: string;
  /** one sentence: who / what */
  body: string;
  /**
   * What it's about, when the kind carries it ("" otherwise): a news
   * post's title and summary, a message's text. Shown in the push, on
   * LINE and in the email, shortened to fit each (clip()).
   */
  content: string;
  /** email only: what to do next */
  detail: string;
  /** button label ("" = no button) */
  cta: string;
  subject: string;
  categoryLabel: string;
};

/** Texts for a notification in one language (messages: notifications). */
export async function renderNotification(
  kind: NotifyKind,
  locale: Locale,
  params: NotifyParams = {},
  content: string | null = null,
): Promise<RenderedNotification> {
  const t = await getTranslatorFor(locale, "notifications");
  const spec = NOTIFY_KINDS[kind];
  const values: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    values[k] = v instanceof Date ? formatDateTime(v, locale) : v;
  }
  // Optional parts filled in by rule, so every template has its values.
  values.place =
    typeof params.location === "string" && params.location
      ? t("email.place", { location: params.location })
      : "";
  values.years =
    typeof params.years === "string" && params.years
      ? t("vouchYears", { years: params.years })
      : "";
  const title = t(`kinds.${kind}.title`, values);
  return {
    kind,
    category: spec.category,
    emoji: spec.emoji,
    title,
    body: t(`kinds.${kind}.body`, values),
    content: content?.trim() ?? "",
    detail: t(`kinds.${kind}.detail`, values),
    cta: t(`kinds.${kind}.cta`, values),
    subject: `${t("email.subjectPrefix")}${title}`,
    categoryLabel: t(`categories.${spec.category}`),
  };
}

/** Content lengths per channel (characters). */
export const CONTENT_MAX = { push: 180, line: 400, email: 1200 } as const;

/** Shorten to `max` characters, ending with "…" when cut. */
export function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`
    : text;
}

/**
 * LINE push text: headline, one sentence, the content if any, then the
 * button and short link.
 */
export function lineText(r: RenderedNotification, url: string | null): string {
  const content = r.content ? `\n\n${clip(r.content, CONTENT_MAX.line)}` : "";
  const head = `${r.emoji} ${r.title}\n${r.body}${content}`;
  return url ? `${head}\n\n${r.cta ? `${r.cta} ▶ ` : ""}${url}` : head;
}
