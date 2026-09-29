import en_adminContent from "@messages/en/adminContent.json";
import en_adminMembers from "@messages/en/adminMembers.json";
import en_adminStats from "@messages/en/adminStats.json";
import en_adminVerify from "@messages/en/adminVerify.json";
import en_audit from "@messages/en/audit.json";
import en_auth from "@messages/en/auth.json";
import en_broadcast from "@messages/en/broadcast.json";
import en_chat from "@messages/en/chat.json";
import en_cohorts from "@messages/en/cohorts.json";
import en_common from "@messages/en/common.json";
import en_dashboard from "@messages/en/dashboard.json";
import en_destinations from "@messages/en/destinations.json";
import en_directory from "@messages/en/directory.json";
import en_email from "@messages/en/email.json";
import en_events from "@messages/en/events.json";
import en_family from "@messages/en/family.json";
import en_follows from "@messages/en/follows.json";
import en_history from "@messages/en/history.json";
import en_home from "@messages/en/home.json";
import en_invites from "@messages/en/invites.json";
import en_landing from "@messages/en/landing.json";
import en_line from "@messages/en/line.json";
import en_news from "@messages/en/news.json";
import en_notifications from "@messages/en/notifications.json";
import en_onboarding from "@messages/en/onboarding.json";
import en_organizations from "@messages/en/organizations.json";
import en_profile from "@messages/en/profile.json";
import en_records from "@messages/en/records.json";
import en_roles from "@messages/en/roles.json";
import en_settings from "@messages/en/settings.json";
import en_setup from "@messages/en/setup.json";
import en_support from "@messages/en/support.json";
import en_teachers from "@messages/en/teachers.json";
import en_verify from "@messages/en/verify.json";
import en_vouch from "@messages/en/vouch.json";
import ja_adminContent from "@messages/ja/adminContent.json";
import ja_adminMembers from "@messages/ja/adminMembers.json";
import ja_adminStats from "@messages/ja/adminStats.json";
import ja_adminVerify from "@messages/ja/adminVerify.json";
import ja_audit from "@messages/ja/audit.json";
import ja_auth from "@messages/ja/auth.json";
import ja_broadcast from "@messages/ja/broadcast.json";
import ja_chat from "@messages/ja/chat.json";
import ja_cohorts from "@messages/ja/cohorts.json";
import ja_common from "@messages/ja/common.json";
import ja_dashboard from "@messages/ja/dashboard.json";
import ja_destinations from "@messages/ja/destinations.json";
import ja_directory from "@messages/ja/directory.json";
import ja_email from "@messages/ja/email.json";
import ja_events from "@messages/ja/events.json";
import ja_family from "@messages/ja/family.json";
import ja_follows from "@messages/ja/follows.json";
import ja_history from "@messages/ja/history.json";
import ja_home from "@messages/ja/home.json";
import ja_invites from "@messages/ja/invites.json";
import ja_landing from "@messages/ja/landing.json";
import ja_line from "@messages/ja/line.json";
import ja_news from "@messages/ja/news.json";
import ja_notifications from "@messages/ja/notifications.json";
import ja_onboarding from "@messages/ja/onboarding.json";
import ja_organizations from "@messages/ja/organizations.json";
import ja_profile from "@messages/ja/profile.json";
import ja_records from "@messages/ja/records.json";
import ja_roles from "@messages/ja/roles.json";
import ja_settings from "@messages/ja/settings.json";
import ja_setup from "@messages/ja/setup.json";
import ja_support from "@messages/ja/support.json";
import ja_teachers from "@messages/ja/teachers.json";
import ja_verify from "@messages/ja/verify.json";
import ja_vouch from "@messages/ja/vouch.json";
import type { AppLocale } from "./routing";

/**
 * Every namespace, both languages, bundled statically (Metro can't load
 * JSON by a computed path). Same list as the website's src/i18n/messages.ts.
 */
export type Messages = Record<string, Record<string, unknown>>;

const JA = {
  common: ja_common,
  roles: ja_roles,
  email: ja_email,
  home: ja_home,
  landing: ja_landing,
  auth: ja_auth,
  onboarding: ja_onboarding,
  line: ja_line,
  verify: ja_verify,
  vouch: ja_vouch,
  adminVerify: ja_adminVerify,
  dashboard: ja_dashboard,
  events: ja_events,
  news: ja_news,
  adminContent: ja_adminContent,
  directory: ja_directory,
  profile: ja_profile,
  records: ja_records,
  broadcast: ja_broadcast,
  cohorts: ja_cohorts,
  history: ja_history,
  organizations: ja_organizations,
  follows: ja_follows,
  family: ja_family,
  chat: ja_chat,
  invites: ja_invites,
  notifications: ja_notifications,
  support: ja_support,
  settings: ja_settings,
  adminMembers: ja_adminMembers,
  adminStats: ja_adminStats,
  setup: ja_setup,
  teachers: ja_teachers,
  destinations: ja_destinations,
  audit: ja_audit,
} as unknown as Messages;
const EN = {
  common: en_common,
  roles: en_roles,
  email: en_email,
  home: en_home,
  landing: en_landing,
  auth: en_auth,
  onboarding: en_onboarding,
  line: en_line,
  verify: en_verify,
  vouch: en_vouch,
  adminVerify: en_adminVerify,
  dashboard: en_dashboard,
  events: en_events,
  news: en_news,
  adminContent: en_adminContent,
  directory: en_directory,
  profile: en_profile,
  records: en_records,
  broadcast: en_broadcast,
  cohorts: en_cohorts,
  history: en_history,
  organizations: en_organizations,
  follows: en_follows,
  family: en_family,
  chat: en_chat,
  invites: en_invites,
  notifications: en_notifications,
  support: en_support,
  settings: en_settings,
  adminMembers: en_adminMembers,
  adminStats: en_adminStats,
  setup: en_setup,
  teachers: en_teachers,
  destinations: en_destinations,
  audit: en_audit,
} as unknown as Messages;

export async function loadMessages(locale: AppLocale): Promise<Messages> {
  return locale === "en" ? EN : JA;
}
