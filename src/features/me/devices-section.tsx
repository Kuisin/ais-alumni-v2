import type { SignedInDevice } from "@contract/account";
import { Monitor, Smartphone } from "lucide-react-native";
import { Fragment } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  colors,
  ErrorState,
  ListGroup,
  Loading,
  Section,
  Separator,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { useDevices, useSignOutDevice, useSignOutOtherDevices } from "./api";
import { confirmAction } from "./confirm";
import { ErrorLine } from "./settings-sections";

const PLATFORMS = new Set(["ios", "android", "web"]);

/**
 * 設定 → ログイン中の端末 (app only): the devices signed in to the app with
 * this account (MobileSession), this one first; any other can be signed out.
 */
export function DevicesSection() {
  const t = useTranslations("mobile.me.devices");
  const tc = useTranslations("common");
  const devices = useDevices();
  const signOut = useSignOutDevice();
  const signOutOthers = useSignOutOtherDevices();
  const list = devices.data?.devices ?? [];
  const others = list.filter((d) => !d.current);

  const platformLabel = (p: string | null) =>
    p && PLATFORMS.has(p) ? t(`platform.${p}`) : p;
  const deviceTitle = (d: SignedInDevice) =>
    d.deviceName ?? platformLabel(d.platform) ?? t("unknown");

  const confirmOne = async (d: SignedInDevice) => {
    const ok = await confirmAction({
      title: t("signOutTitle", { device: deviceTitle(d) }),
      message: t("signOutBody"),
      confirm: t("signOut"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) signOut.mutate(d.id);
  };
  const confirmOthers = async () => {
    const ok = await confirmAction({
      title: t("signOutOthersTitle"),
      message: t("signOutOthersBody"),
      confirm: t("signOut"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (ok) signOutOthers.mutate();
  };

  return (
    <Section title={t("title")}>
      <Text variant="small" tone="muted">
        {t("description")}
      </Text>
      {devices.data ? (
        <ListGroup>
          {list.map((d, i) => (
            <Fragment key={d.id}>
              {i ? <Separator /> : null}
              <DeviceRow
                device={d}
                title={deviceTitle(d)}
                platform={d.deviceName ? platformLabel(d.platform) : null}
                busy={signOut.isPending && signOut.variables === d.id}
                disabled={signOutOthers.isPending}
                onSignOut={() => void confirmOne(d)}
              />
            </Fragment>
          ))}
        </ListGroup>
      ) : devices.isError ? (
        <ErrorState error={devices.error} onRetry={() => devices.refetch()} />
      ) : (
        <Loading inline />
      )}
      {devices.data && others.length === 0 ? (
        <Text variant="small" tone="subtle">
          {t("noOthers")}
        </Text>
      ) : null}
      {others.length > 1 ? (
        <Button
          variant="secondary"
          label={t("signOutOthers")}
          loading={signOutOthers.isPending}
          disabled={signOut.isPending}
          onPress={() => void confirmOthers()}
        />
      ) : null}
      {signOut.isError ? <ErrorLine error={signOut.error} /> : null}
      {signOutOthers.isError ? <ErrorLine error={signOutOthers.error} /> : null}
    </Section>
  );
}

function DeviceRow({
  device,
  title,
  platform,
  busy,
  disabled,
  onSignOut,
}: {
  device: SignedInDevice;
  title: string;
  /** shown next to the date when the title is the device's name */
  platform: string | null;
  busy: boolean;
  disabled: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations("mobile.me.devices");
  const { locale } = useAuth();
  const Icon = device.platform === "web" ? Monitor : Smartphone;
  return (
    <View style={styles.row}>
      <Icon color={colors.slate600} size={22} aria-hidden />
      <View style={styles.text}>
        <Text weight="medium" numberOfLines={2}>
          {title}
        </Text>
        {platform ? (
          <Text variant="small" tone="subtle">
            {platform}
          </Text>
        ) : null}
        <Text variant="small" tone="subtle">
          {t("used", { date: formatDate(device.lastUsedAt, locale) })}
        </Text>
        <Text variant="caption" tone="subtle">
          {t("since", { date: formatDate(device.createdAt, locale) })}
        </Text>
      </View>
      <View style={styles.trailing}>
        {device.current ? (
          <Badge tone="green" label={t("current")} />
        ) : (
          <Button
            variant="secondary"
            compact
            hitSlop={4}
            label={t("signOut")}
            accessibilityLabel={`${t("signOut")}: ${title}`}
            loading={busy}
            disabled={disabled}
            onPress={onSignOut}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: TOUCH + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, gap: 2 },
  trailing: { justifyContent: "center" },
});
