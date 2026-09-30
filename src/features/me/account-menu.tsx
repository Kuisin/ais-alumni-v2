import type { AppConfig } from "@contract/core";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  HandCoins,
  HeartHandshake,
  LifeBuoy,
  LogOut,
  MailPlus,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";
import { useTranslations } from "use-intl";
import { hasStaffAccess } from "@/features/admin/nav";
import { api } from "@/lib/api";
import { useAuth, useMe } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { CountDot, colors, ListGroup, ListRow, Separator } from "@/ui";
import { confirmAction } from "./confirm";

const icon = (I: typeof Settings) => (
  <I color={colors.brand700} size={20} aria-hidden />
);

/**
 * The account menu (the website's app shell): マイプロフィール, 家族, フォローリクエスト
 * (with the count waiting), 同窓生を招待, 設定, お問い合わせ, 寄付 (in the
 * browser, when the server takes donations) and, for
 * staff, 管理モード.
 */
export function AccountMenu() {
  const tc = useTranslations("common");
  const td = useTranslations("mobile.donate");
  const router = useRouter();
  const { badges, access } = useMe();
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<AppConfig>("/config"),
    staleTime: 5 * 60_000,
  });
  // In the app, donations happen in the browser (App Store 3.2.2).
  const donate = () =>
    Platform.OS === "web"
      ? router.push("/donate")
      : void Linking.openURL(`${API_URL}/donate`).catch(() => {});
  return (
    <ListGroup>
      <ListRow
        leading={icon(UserRound)}
        title={tc("nav.profile")}
        onPress={() => router.push("/profile")}
      />
      <Separator />
      <ListRow
        leading={icon(HeartHandshake)}
        title={tc("nav.family")}
        onPress={() => router.push("/family")}
      />
      <Separator />
      <ListRow
        leading={icon(UserPlus)}
        title={tc("nav.follows")}
        trailing={<CountDot count={badges.follows} />}
        accessibilityLabel={
          badges.follows > 0
            ? `${tc("nav.follows")}, ${tc("nav.pending", { count: badges.follows })}`
            : undefined
        }
        onPress={() => router.push("/follows")}
      />
      <Separator />
      <ListRow
        leading={icon(MailPlus)}
        title={tc("nav.invite")}
        onPress={() => router.push("/invite")}
      />
      <Separator />
      <ListRow
        leading={icon(Settings)}
        title={tc("nav.settings")}
        onPress={() => router.push("/settings")}
      />
      <Separator />
      <ListRow
        leading={icon(LifeBuoy)}
        title={tc("nav.support")}
        onPress={() => router.push("/support")}
      />
      {config.data?.donations ? (
        <>
          <Separator />
          <ListRow
            leading={icon(HandCoins)}
            title={td("menu")}
            onPress={donate}
          />
        </>
      ) : null}
      {hasStaffAccess(access) ? (
        <>
          <Separator />
          <ListRow
            leading={icon(ShieldCheck)}
            title={tc("nav.adminMode")}
            onPress={() => router.push("/admin")}
          />
        </>
      ) : null}
    </ListGroup>
  );
}

/** ログアウト (this device), after a confirmation. */
export function SignOutRow() {
  const tc = useTranslations("common");
  const tm = useTranslations("mobile.me.signOutConfirm");
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const onPress = async () => {
    const ok = await confirmAction({
      title: tm("title"),
      message: tm("body"),
      confirm: tc("signOut"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    await signOut();
  };
  return (
    <ListGroup>
      <ListRow
        leading={<LogOut color={colors.red700} size={20} aria-hidden />}
        title={tc("signOut")}
        destructive
        chevron={false}
        trailing={busy ? <ActivityIndicator color={colors.red700} /> : null}
        onPress={busy ? undefined : onPress}
      />
    </ListGroup>
  );
}
