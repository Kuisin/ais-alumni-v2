import { useRouter } from "expo-router";
import {
  HeartHandshake,
  LifeBuoy,
  LogOut,
  MailPlus,
  Settings,
  ShieldCheck,
  UserPlus,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTranslations } from "use-intl";
import { hasStaffAccess } from "@/features/admin/nav";
import { useAuth, useMe } from "@/lib/auth";
import { CountDot, colors, ListGroup, ListRow, Separator } from "@/ui";
import { confirmAction } from "./confirm";

const icon = (I: typeof Settings) => (
  <I color={colors.brand700} size={20} aria-hidden />
);

/**
 * The account menu (the website's app shell): 家族, フォローリクエスト
 * (with the count waiting), 同窓生を招待, 設定, お問い合わせ and, for
 * staff, 管理モード.
 */
export function AccountMenu() {
  const tc = useTranslations("common");
  const router = useRouter();
  const { badges, access } = useMe();
  return (
    <ListGroup>
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
