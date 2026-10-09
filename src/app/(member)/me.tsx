import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { InstallButton } from "@/features/install/install-button";
import { AccountMenu, SignOutRow } from "@/features/me/account-menu";
import { PROFILE_KEY, useProfile, useRefetchOnFocus } from "@/features/me/api";
import { AppInfo } from "@/features/me/app-info";
import { ProfileHeader } from "@/features/me/profile-header";
import { useAuth, useMe } from "@/lib/auth";
import { Screen } from "@/ui";

/**
 * マイページ (opened from the photo at the top left of every tab): the top
 * of my profile (photo, names, follow counts), マイプロフィール (the full
 * profile, its own page) and the account menu (フォローリクエスト, 設定,
 * ログアウト). In a browser, also 「アプリをインストール」.
 */
export default function MeScreen() {
  const t = useTranslations("common.nav");
  const me = useMe();
  const { refreshMe } = useAuth();
  const profile = useProfile();
  useRefetchOnFocus(PROFILE_KEY);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([profile.refetch(), refreshMe()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen options={{ title: t("profileShort") }} />
      <ProfileHeader me={me} profile={profile.data} />
      <InstallButton />
      <AccountMenu />
      <SignOutRow />
      <AppInfo />
    </Screen>
  );
}
