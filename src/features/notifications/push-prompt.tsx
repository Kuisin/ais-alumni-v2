import { BellRing } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { getDeviceItem, setDeviceItem } from "@/lib/device-store";
import { usePush } from "@/lib/push";
import { isInstalledWebApp } from "@/lib/web-push";
import { Button, colors, radius, space, Text } from "@/ui";

const LATER_KEY = "ais.pushPromptLater";
/** 「あとで」 hides the card this long. */
const LATER_MS = 30 * 86_400_000;

/**
 * 「アプリで通知を受け取りませんか？」 on Home (and, worded for applicants,
 * on onboarding): turns app notifications on in one tap. Shown while this
 * device could get them but doesn't, unless the member turned them off in
 * settings or chose 「あとで」 (30 days). When the phone's settings block
 * them, the button opens those settings instead.
 */
export function PushPrompt({
  variant = "home",
}: {
  variant?: "home" | "onboarding";
}) {
  const t = useTranslations("mobile.push");
  const push = usePush();
  // undefined = not read yet
  const [laterUntil, setLaterUntil] = useState<number | null | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getDeviceItem(LATER_KEY).then((v) =>
      setLaterUntil(v ? Number(v) : null),
    );
  }, []);

  if (
    push.blocker !== null ||
    push.enabled ||
    push.optedOut ||
    push.state === null ||
    push.permission === null ||
    laterUntil === undefined ||
    (laterUntil !== null && laterUntil > Date.now())
  )
    return null;

  const blockedByPhone =
    push.permission === "denied" ||
    (push.permission === "undetermined" && !push.canAskAgain);
  // The web app: suggested once it's on the home screen (in a browser tab
  // it's in settings only), and not when the browser blocks them — there
  // are no settings this button could open.
  if (Platform.OS === "web" && (!isInstalledWebApp() || blockedByPhone))
    return null;

  const later = () => {
    const until = Date.now() + LATER_MS;
    setLaterUntil(until);
    void setDeviceItem(LATER_KEY, String(until));
  };

  const enable = async () => {
    setFailed(false);
    if (blockedByPhone) {
      push.openSettings();
      return;
    }
    const result = await push.enable();
    if (result === "failed") setFailed(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <BellRing size={20} color={colors.brand700} aria-hidden />
        <Text
          variant="body"
          weight="semibold"
          accessibilityRole="header"
          style={styles.flex}
        >
          {t(
            variant === "onboarding"
              ? "prompt.onboardingTitle"
              : "prompt.title",
          )}
        </Text>
      </View>
      <Text variant="small" style={styles.body}>
        {t(variant === "onboarding" ? "prompt.onboardingBody" : "prompt.body")}
      </Text>
      {blockedByPhone ? (
        <Text variant="small" tone="muted">
          {t("prompt.denied")}
        </Text>
      ) : null}
      {failed ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {t("settings.enableFailed")}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label={t("prompt.enable")}
          loading={push.busy}
          onPress={() => void enable()}
        />
        <Button variant="ghost" label={t("prompt.later")} onPress={later} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brand100,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand700,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  body: { color: colors.slate700 },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
});
