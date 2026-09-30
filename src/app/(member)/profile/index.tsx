import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { PROFILE_KEY, useProfile, useRefetchOnFocus } from "@/features/me/api";
import { ProfileSections } from "@/features/me/profile-sections";
import { ErrorState, Loading, Screen } from "@/ui";

/**
 * マイプロフィール (the website's /app/profile): my profile section by
 * section, as other members see it, each one editable. Opened from マイページ
 * (and wherever a member taps themselves).
 */
export default function MyProfileScreen() {
  const t = useTranslations("common.nav");
  const profile = useProfile();
  useRefetchOnFocus(PROFILE_KEY);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await profile.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen options={{ title: t("profile") }} />
      {profile.data ? (
        <ProfileSections profile={profile.data} />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <Loading inline />
      )}
    </Screen>
  );
}
