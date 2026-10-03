import { webPathFor } from "@/lib/site-paths";
import type { LineButtonsMessage, LineMessage } from "@/server/lib/line";

/**
 * Welcome message sent when someone adds (or unblocks) the Official Account
 * (pure; unit-tested). Linked members get it in their language with their
 * name; unknown LINE users get Japanese then English, plus how to link.
 */

type T = (key: string, values?: Record<string, string>) => string;

export type WelcomeInput = {
  /** member linked to this LINE account, if any */
  member: { name: string | null; locale: "ja" | "en" } | null;
  /** re-follow after blocking */
  isUnblocked: boolean;
  appUrl: (path: string) => string;
};

/** LINE limits: text 5000 chars; buttons label 20, title 40, text 60. */
const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

export function welcomeText(
  t: T,
  input: WelcomeInput,
  _locale: "ja" | "en",
): string {
  const name = input.member?.name ?? null;
  const greeting = input.isUnblocked
    ? name
      ? t("greetingBackNamed", { name })
      : t("greetingBack")
    : name
      ? t("greetingNamed", { name })
      : t("greeting");
  const linked = input.member !== null;
  const sections = [
    `${t("title")}\n${greeting}`,
    t("about"),
    `${t("receiveTitle")}\n${t("receiveItems")}`,
    linked
      ? `${t("linkedTitle")}\n${t("linked")}`
      : `${t("notLinkedTitle")}\n${t("notLinked")}`,
    `${t("settingsTitle")}\n${t("settings")}`,
    `${t("privacyTitle")}\n${t("privacy", { url: input.appUrl("/privacy") })}`,
  ];
  return clip(sections.join("\n\n"), 5000);
}

export function welcomeButtons(
  t: T,
  input: WelcomeInput,
  _locale: "ja" | "en",
  labelFor: (key: string) => string = t,
): LineButtonsMessage {
  const url = (p: string) => input.appUrl(webPathFor(p));
  return {
    type: "template",
    altText: clip(t("buttonsAlt", { url: url("/app") }), 400),
    template: {
      type: "buttons",
      title: clip(t("buttonsTitle"), 40),
      text: clip(t("buttonsText"), 60),
      actions: [
        { type: "uri", label: clip(labelFor("openApp"), 20), uri: url("/app") },
        input.member
          ? {
              type: "uri",
              label: clip(labelFor("notifySettings"), 20),
              uri: url("/app/settings#notifications"),
            }
          : {
              type: "uri",
              label: clip(labelFor("linkLine"), 20),
              uri: url("/app/settings#line"),
            },
        {
          type: "uri",
          label: clip(labelFor("privacyButton"), 20),
          uri: url("/privacy"),
        },
      ],
    },
  };
}

/** Messages for the reply (≤ 5). */
export function welcomeMessages(
  tr: { ja: T; en: T },
  input: WelcomeInput,
): LineMessage[] {
  if (input.member) {
    const l = input.member.locale;
    return [
      { type: "text", text: welcomeText(tr[l], input, l) },
      welcomeButtons(tr[l], input, l),
    ];
  }
  // Unknown language: Japanese, then English; bilingual button labels.
  const both = (key: string) => `${tr.ja(key)} / ${tr.en(key)}`;
  return [
    { type: "text", text: welcomeText(tr.ja, input, "ja") },
    { type: "text", text: welcomeText(tr.en, input, "en") },
    welcomeButtons(tr.ja, input, "ja", (k) =>
      both(k).length <= 20 ? both(k) : tr.ja(k),
    ),
  ];
}
