import type { Locale } from "@contract/core";
import enAdminContent from "@messages/en/adminContent.json";
import enAuth from "@messages/en/auth.json";
import enBroadcast from "@messages/en/broadcast.json";
import enChat from "@messages/en/chat.json";
import enCohorts from "@messages/en/cohorts.json";
import enCommon from "@messages/en/common.json";
import enDashboard from "@messages/en/dashboard.json";
import enDirectory from "@messages/en/directory.json";
import enEvents from "@messages/en/events.json";
import enFamily from "@messages/en/family.json";
import enFollows from "@messages/en/follows.json";
import enHistory from "@messages/en/history.json";
import enHome from "@messages/en/home.json";
import enInvites from "@messages/en/invites.json";
import enLanding from "@messages/en/landing.json";
import enLine from "@messages/en/line.json";
import enMobile from "@messages/en/mobile.json";
import enNews from "@messages/en/news.json";
import enNotifications from "@messages/en/notifications.json";
import enOnboarding from "@messages/en/onboarding.json";
import enProfile from "@messages/en/profile.json";
import enRecords from "@messages/en/records.json";
import enRoles from "@messages/en/roles.json";
import enSettings from "@messages/en/settings.json";
import enSetup from "@messages/en/setup.json";
import enSupport from "@messages/en/support.json";
import enVerify from "@messages/en/verify.json";
import enVouch from "@messages/en/vouch.json";
import jaAdminContent from "@messages/ja/adminContent.json";
import jaAuth from "@messages/ja/auth.json";
import jaBroadcast from "@messages/ja/broadcast.json";
import jaChat from "@messages/ja/chat.json";
import jaCohorts from "@messages/ja/cohorts.json";
import jaCommon from "@messages/ja/common.json";
import jaDashboard from "@messages/ja/dashboard.json";
import jaDirectory from "@messages/ja/directory.json";
import jaEvents from "@messages/ja/events.json";
import jaFamily from "@messages/ja/family.json";
import jaFollows from "@messages/ja/follows.json";
import jaHistory from "@messages/ja/history.json";
import jaHome from "@messages/ja/home.json";
import jaInvites from "@messages/ja/invites.json";
import jaLanding from "@messages/ja/landing.json";
import jaLine from "@messages/ja/line.json";
import jaMobile from "@messages/ja/mobile.json";
import jaNews from "@messages/ja/news.json";
import jaNotifications from "@messages/ja/notifications.json";
import jaOnboarding from "@messages/ja/onboarding.json";
import jaProfile from "@messages/ja/profile.json";
import jaRecords from "@messages/ja/records.json";
import jaRoles from "@messages/ja/roles.json";
import jaSettings from "@messages/ja/settings.json";
import jaSetup from "@messages/ja/setup.json";
import jaSupport from "@messages/ja/support.json";
import jaVerify from "@messages/ja/verify.json";
import jaVouch from "@messages/ja/vouch.json";
import type { ReactNode } from "react";
import { type AbstractIntlMessages, IntlProvider } from "use-intl";
import { TIME_ZONE } from "./format";

/**
 * UI strings: the website's own messages/<locale>/<namespace>.json (ICU
 * syntax, used through use-intl — the core of next-intl), so the app and the
 * site always say the same thing. App-only strings are in the "mobile"
 * namespace. Add a namespace here when a screen needs one.
 */
const JA = {
  common: jaCommon,
  roles: jaRoles,
  landing: jaLanding,
  auth: jaAuth,
  onboarding: jaOnboarding,
  home: jaHome,
  dashboard: jaDashboard,
  events: jaEvents,
  news: jaNews,
  directory: jaDirectory,
  profile: jaProfile,
  records: jaRecords,
  history: jaHistory,
  follows: jaFollows,
  family: jaFamily,
  invites: jaInvites,
  vouch: jaVouch,
  chat: jaChat,
  notifications: jaNotifications,
  settings: jaSettings,
  setup: jaSetup,
  support: jaSupport,
  verify: jaVerify,
  line: jaLine,
  cohorts: jaCohorts,
  adminContent: jaAdminContent,
  broadcast: jaBroadcast,
  mobile: jaMobile,
};
const EN = {
  common: enCommon,
  roles: enRoles,
  landing: enLanding,
  auth: enAuth,
  onboarding: enOnboarding,
  home: enHome,
  dashboard: enDashboard,
  events: enEvents,
  news: enNews,
  directory: enDirectory,
  profile: enProfile,
  records: enRecords,
  history: enHistory,
  follows: enFollows,
  family: enFamily,
  invites: enInvites,
  vouch: enVouch,
  chat: enChat,
  notifications: enNotifications,
  settings: enSettings,
  setup: enSetup,
  support: enSupport,
  verify: enVerify,
  line: enLine,
  cohorts: enCohorts,
  adminContent: enAdminContent,
  broadcast: enBroadcast,
  mobile: enMobile,
};

// Some namespaces hold arrays (read with t.raw), which the type doesn't model.
const MESSAGES = { ja: JA, en: EN } as unknown as Record<
  Locale,
  AbstractIntlMessages
>;

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <IntlProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone={TIME_ZONE}
      onError={(e) => {
        if (__DEV__) console.warn(`[i18n] ${e.message}`);
      }}
      getMessageFallback={({ namespace, key }) =>
        [namespace, key].filter(Boolean).join(".")
      }
    >
      {children}
    </IntlProvider>
  );
}
