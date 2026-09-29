import type { AdminLine, RichMenuResult } from "@contract/admin-manage";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Notice } from "@/features/events/parts";
import { confirmAction } from "@/features/me/confirm";
import { getApiToken } from "@/lib/api";
import { API_URL } from "@/lib/config";
import {
  Badge,
  Button,
  Card,
  colors,
  font,
  QueryState,
  radius,
  Screen,
  space,
  Text,
  TOUCH,
} from "@/ui";
import { adminManageApi, useAdminLine, useRefreshAdmin } from "./api";
import { Meter } from "./parts";

/** LINE Official Account: the rich menu (the website's /app/admin/line). */
export function AdminLineScreen() {
  const t = useTranslations("line.richMenu.admin");
  const query = useAdminLine();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(d) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("intro")}
            </Text>
            {!d.configured ? (
              <Notice tone="warning">{t("errors.notConfigured")}</Notice>
            ) : null}
            <UsageCard usage={d.usage} />
            <Card style={styles.card}>
              <View style={styles.head}>
                <Text variant="subheading" accessibilityRole="header">
                  {t("status")}
                </Text>
                {d.installed ? (
                  <Badge
                    label={d.isDefault ? t("installed") : t("notDefault")}
                    tone={d.isDefault ? "green" : "amber"}
                  />
                ) : (
                  <Badge label={t("notInstalled")} />
                )}
              </View>
              <Text variant="small" tone="muted">
                {t("how")}
              </Text>
              {d.configured ? <Install installed={d.installed} /> : null}
            </Card>
            {d.previews.map((p) => (
              <Preview key={p.locale} preview={p} />
            ))}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

/**
 * This month's LINE messages: LINE's own count against the plan's limit,
 * and what this app sent them for.
 */
function UsageCard({ usage }: { usage: AdminLine["usage"] }) {
  const t = useTranslations("line.usage");
  const tc = useTranslations("notifications.categories");
  const { quota, byCategory } = usage;
  const logged = byCategory.reduce((n, r) => n + r.count, 0);
  const share =
    quota?.limit && quota.limit > 0 ? quota.used / quota.limit : null;
  const tone =
    share === null
      ? colors.brand700
      : share >= 0.9
        ? colors.red600
        : share >= 0.7
          ? colors.amber400
          : colors.green600;
  return (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {t("title")}
      </Text>
      {quota ? (
        <View style={styles.usage}>
          <Text>
            <Text variant="title">{quota.used.toLocaleString()}</Text>{" "}
            <Text tone="muted">
              {quota.limit !== null
                ? t("ofLimit", { limit: quota.limit.toLocaleString() })
                : t("noLimit")}
            </Text>
          </Text>
          {share !== null ? (
            <>
              <Meter share={share} color={tone} />
              <Text variant="small" tone="muted">
                {t("remaining", {
                  count: Math.max(0, (quota.limit ?? 0) - quota.used),
                })}
              </Text>
            </>
          ) : null}
          {share !== null && share >= 0.9 ? (
            <Notice tone="warning">{t("nearLimit")}</Notice>
          ) : null}
        </View>
      ) : (
        <Text variant="small" tone="muted">
          {t("unavailable")}
        </Text>
      )}
      <View style={styles.breakdown}>
        <Text variant="small" weight="semibold">
          {t("byCategory", { count: logged })}
        </Text>
        {byCategory.length ? (
          byCategory.map((r) => (
            <View key={r.category} style={styles.breakdownRow}>
              <Text variant="small" style={styles.flex}>
                {r.category === "other" ? t("other") : tc(r.category)}
              </Text>
              <Text variant="small">{r.count.toLocaleString()}</Text>
            </View>
          ))
        ) : (
          <Text variant="small" tone="subtle">
            {t("none")}
          </Text>
        )}
      </View>
      <Text variant="caption" tone="subtle">
        {t("hint")}
      </Text>
    </Card>
  );
}

/** Build the menu images and install them on the Official Account. */
function Install({ installed }: { installed: boolean }) {
  const t = useTranslations("line.richMenu.admin");
  const tc = useTranslations("common");
  const refresh = useRefreshAdmin();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<RichMenuResult>({});
  const install = async () => {
    const ok = await confirmAction({
      title: t("installConfirm"),
      confirm: installed ? t("update") : t("install"),
      cancel: tc("cancel"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      setState(await adminManageApi.installRichMenu());
      await refresh("line");
    } catch {
      setState({ error: "failed" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.install}>
      {state.ok ? (
        <Notice tone="success">
          {t("done", {
            linked: state.linked ?? 0,
            removed: state.removed ?? 0,
          })}
        </Notice>
      ) : null}
      {state.error ? (
        <Notice tone="error">
          {t(`errors.${state.error}`)}
          {state.detail ? `\n${state.detail}` : ""}
        </Notice>
      ) : null}
      <Button
        label={busy ? t("installing") : installed ? t("update") : t("install")}
        loading={busy}
        onPress={install}
      />
    </View>
  );
}

/** The generated PNG, fetched with the session (it is admin-only here). */
function useMenuImage(path: string) {
  return useQuery({
    queryKey: ["admin", "line", "image", path],
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const token = getApiToken();
      const res = await fetch(`${API_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    },
  });
}

function Preview({ preview: p }: { preview: AdminLine["previews"][number] }) {
  const t = useTranslations("line.richMenu.admin");
  const [dots, setDots] = useState(false);
  const image = useMenuImage(dots ? p.imageDots : p.image);
  return (
    <Card style={styles.card}>
      <Text variant="subheading" accessibilityRole="header">
        {p.locale === "ja" ? t("previewJa") : t("previewEn")}
      </Text>
      <View style={styles.imageBox}>
        {image.data ? (
          <Image
            source={{ uri: image.data }}
            accessibilityLabel={t("previewAlt")}
            style={styles.image}
            contentFit="contain"
          />
        ) : image.isError ? null : (
          <ActivityIndicator color={colors.brand700} />
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: dots }}
        onPress={() => setDots((v) => !v)}
        style={styles.dotsToggle}
      >
        <Text variant="small" tone="brand" style={styles.underline}>
          {t("previewDots")}
        </Text>
      </Pressable>
      <View style={styles.items}>
        {p.replies.map((i) => (
          <Text key={i.key} variant="small">
            {i.label}{" "}
            <Text variant="caption" tone="subtle">
              {t("replyNote")}
            </Text>
          </Text>
        ))}
        {p.items.map((i) => (
          <Text key={i.key} variant="small">
            {i.label}{" "}
            <Text
              variant="caption"
              tone="subtle"
              style={{ fontFamily: font.mono }}
            >
              {i.path}
            </Text>
          </Text>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space.md },
  head: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  usage: { gap: space.sm },
  breakdown: {
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate100,
    paddingTop: space.md,
  },
  breakdownRow: { flexDirection: "row", gap: space.md },
  install: { gap: space.sm },
  imageBox: {
    aspectRatio: 1250 / 843,
    width: "100%",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  dotsToggle: {
    minHeight: TOUCH,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  underline: { textDecorationLine: "underline" },
  items: { gap: space.xs },
});
