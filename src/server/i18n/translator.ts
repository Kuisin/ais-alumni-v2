import { createTranslator } from "next-intl";
import { loadMessages } from "./messages";
import type { AppLocale } from "./routing";

/**
 * Translator usable outside a request's locale (emails, LINE pushes, cron jobs),
 * where the recipient's locale differs from the current request.
 */
export async function getTranslatorFor(locale: AppLocale, namespace: string) {
  const messages = await loadMessages(locale);
  // biome-ignore lint/suspicious/noExplicitAny: namespaces are validated at runtime by next-intl
  return createTranslator({ locale, messages, namespace } as any) as (
    key: string,
    values?: Record<string, string | number | Date>,
  ) => string;
}
