import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  AdminModeSection,
  DangerSection,
  EmailSection,
  ExportSection,
  SchoolEmailSection,
  SignInMethodsSection,
} from "@/features/me/account-sections";
import {
  SETTINGS_KEY,
  useDevices,
  useRefetchOnFocus,
  useSettings,
} from "@/features/me/api";
import { DevicesSection } from "@/features/me/devices-section";
import {
  LanguageSection,
  LineSection,
  NotifySection,
} from "@/features/me/settings-sections";
import { PushSection } from "@/features/notifications/push-section";
import { QueryState, Screen, Text } from "@/ui";

/**
 * 設定 (the website's /app/settings), in its order: 言語, アプリの通知 (app
 * only), 通知, LINE, ログイン方法, メールアドレス, 学校のメールアドレス
 * (teachers), データのダウンロード, ログイン中の端末 (app only), 管理モード
 * (staff) and 危険な操作 (deactivate / delete, last).
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
            <SignInMethodsSection settings={s} />
            <EmailSection settings={s} />
            {s.schoolEmail ? (
              <SchoolEmailSection school={s.schoolEmail} />
            ) : null}
            <ExportSection />
            <DevicesSection />
            {s.adminMode.length ? (
              <AdminModeSection areas={s.adminMode} />
            ) : null}
            <DangerSection />
          </Screen>
        )}
      </QueryState>
    </>
  );
}
