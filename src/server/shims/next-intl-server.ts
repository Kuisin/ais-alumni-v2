import { createTranslator } from "use-intl/core";
import { loadMessages } from "../i18n/messages";
import { currentRequest } from "./context";

/** `next-intl/server` for Expo API routes: the request's locale. */
export async function getLocale(): Promise<"ja" | "en"> {
  return currentRequest()?.locale ?? "ja";
}

type Opts = { locale?: string; namespace?: string } | string | undefined;

export async function getTranslations(opts?: Opts) {
  const o = typeof opts === "string" ? { namespace: opts } : (opts ?? {});
  const locale =
    o.locale === "en" || o.locale === "ja" ? o.locale : await getLocale();
  const messages = await loadMessages(locale);
  // biome-ignore lint/suspicious/noExplicitAny: namespaces are checked at runtime
  return createTranslator({
    locale,
    messages,
    namespace: o.namespace,
  } as any) as any;
}
