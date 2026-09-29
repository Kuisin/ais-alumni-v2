import type { HomeLineBanner } from "@contract/home";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { LineOutcomeNotice } from "@/features/line/outcome-notice";
import { useLineLinkReturn, useLinkLine } from "@/features/line/use-link-line";
import { Button, colors, radius, space, Text } from "@/ui";
import { useDismissLineBanner } from "./api";

/**
 * 「LINEで最新情報を受け取る」 (the website's LineBanner): link LINE, or —
 * linked but not following — add the Official Account as a friend.
 * 「今はしない」 hides it for 30 days.
 */
export function LineBanner({ banner }: { banner: HomeLineBanner }) {
  const t = useTranslations("line");
  const tm = useTranslations("mobile.errors");
  const link = useLinkLine("/home");
  const returned = useLineLinkReturn();
  const outcome = link.data ?? returned;
  const dismiss = useDismissLineBanner();
  const addFriend = banner.linked ? banner.addFriendUrl : null;

  return (
    <View style={styles.card}>
      <Text variant="body" weight="semibold" accessibilityRole="header">
        {t("banner.title")}
      </Text>
      <Text variant="small" style={styles.body}>
        {banner.linked ? t("banner.bodyNotFollowing") : t("banner.body")}
      </Text>
      {outcome && outcome !== "linked" ? (
        <LineOutcomeNotice outcome={outcome} />
      ) : null}
      {link.isError ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {tm("generic")}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        {addFriend ? (
          <Button
            variant="line"
            label={t("addFriend")}
            onPress={() =>
              // The LINE app when installed, else the browser.
              void Linking.openURL(addFriend).catch(() =>
                WebBrowser.openBrowserAsync(addFriend),
              )
            }
          />
        ) : (
          <Button
            variant="line"
            label={t("linkButton")}
            loading={link.isPending}
            onPress={() => link.mutate()}
          />
        )}
        <Button
          variant="ghost"
          label={t("banner.dismiss")}
          disabled={dismiss.isPending}
          onPress={() => dismiss.mutate()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.green100,
    borderLeftWidth: 4,
    borderLeftColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  body: { color: colors.slate700 },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
});
