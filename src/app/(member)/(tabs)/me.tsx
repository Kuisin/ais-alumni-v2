import { useState } from "react";
import { AccountMenu, SignOutRow } from "@/features/me/account-menu";
import { PROFILE_KEY, useProfile, useRefetchOnFocus } from "@/features/me/api";
import { AppInfo } from "@/features/me/app-info";
import { ProfileHeader } from "@/features/me/profile-header";
import { ProfileSections } from "@/features/me/profile-sections";
import { useAuth, useMe } from "@/lib/auth";
import { ErrorState, Loading, Screen } from "@/ui";

/**
 * マイページ: my profile as others see it (the website's /app/profile,
 * read-only — each section opens its website form) and the account menu
 * (家族, フォローリクエスト, 招待, 設定, お問い合わせ, 管理モード, ログアウト).
 */
export default function MeTab() {
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
      <ProfileHeader me={me} profile={profile.data} />
      <AccountMenu />
      {profile.data ? (
        <ProfileSections profile={profile.data} />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <Loading inline />
      )}
      <SignOutRow />
      <AppInfo />
    </Screen>
  );
}
