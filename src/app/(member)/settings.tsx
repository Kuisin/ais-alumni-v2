import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  SETTINGS_KEY,
  useDevices,
  useRefetchOnFocus,
  useSettings,
} from "@/features/me/api";
import { DevicesSection } from "@/features/me/devices-section";
import {
  AdminModeSection,
  DangerSection,
  LanguageSection,
  LineSection,
  MoreSection,
  NotifySection,
} from "@/features/me/settings-sections";
import { PushSection } from "@/features/notifications/push-section";
import { QueryState, Screen, Text } from "@/ui";

/**
 * 設定 (the website's /app/settings): 言語, アプリの通知 (app only) and 通知
 * natively, LINE status,
 * the devices signed in to the app, 管理モード for staff, and the rest
 * (sign-in methods, email, data download) on the website's settings page —
 * as are deactivating and deleting the account (危険な操作, last).
 */
export default function SettingsScreen() {
  const t = useTranslations("settings");
  const settings = useSettings();
  const devices = useDevices();
  // ["settings"] also covers ["settings", "devices"].
  useRefetchOnFocus(SETTINGS_KEY);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([settings.refetch(), devices.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={settings}>
        {(s) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            <LanguageSection settings={s} />
            <PushSection />
            <NotifySection settings={s} />
            <LineSection settings={s} />
            <DevicesSection />
            {s.adminMode.length ? (
              <AdminModeSection areas={s.adminMode} />
            ) : null}
            <MoreSection settings={s} />
            <DangerSection />
          </Screen>
        )}
      </QueryState>
    </>
  );
}
