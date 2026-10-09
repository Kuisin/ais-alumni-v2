import { BellRing, Settings2 } from "lucide-react-native";
import { useState } from "react";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { Notice } from "@/features/me/parts";
import { ToggleRow } from "@/features/me/rows";
import { usePush } from "@/lib/push";
import { Button, ListGroup, Section, Text } from "@/ui";

type Note = { tone: "success" | "danger" | "muted"; text: string };

/**
 * 設定 → アプリの通知: notifications on this device (the apps, and the web
 * app in a browser that supports Web Push). While
 * they're on, the server sends everything here instead of LINE / email
 * (src/lib/notify/route.ts), so the section says so; the categories below
 * (受け取る通知) apply to the app too. Explains what's in the way when this
 * build or the phone's settings don't allow them.
 */
export function PushSection() {
  const t = useTranslations("mobile.push.settings");
  const push = usePush();
  const [note, setNote] = useState<Note | null>(null);
  const [testing, setTesting] = useState(false);

  const deniedByPhone =
    push.permission === "denied" ||
    (push.permission === "undetermined" && !push.canAskAgain);
  const others = push.state?.otherDevices ?? 0;

  const toggle = async (on: boolean) => {
    setNote(null);
    if (!on) {
      await push.disable();
      return;
    }
    const result = await push.enable();
    if (result === "failed")
      setNote({ tone: "danger", text: t("enableFailed") });
  };

  const test = async () => {
    setNote(null);
    setTesting(true);
    const result = await push.sendTest();
    setTesting(false);
    setNote(
      result === "ok"
        ? { tone: "success", text: t("testSent") }
        : result === "too_soon"
          ? { tone: "muted", text: t("testTooSoon") }
          : { tone: "danger", text: t("testFailed") },
    );
  };

  return (
    <Section title={t("title")}>
      <Text variant="small" tone="muted">
        {t("description")}
      </Text>
      {push.blocker ? (
        <Notice>
          {t(
            push.blocker === "expo-go"
              ? "expoGo"
              : push.blocker === "web"
                ? "web"
                : "notConfigured",
          )}
        </Notice>
      ) : (
        <>
          <ListGroup>
            <ToggleRow
              title={t("toggle")}
              value={push.enabled}
              disabled={push.busy || push.state === null}
              onChange={(on) => void toggle(on)}
            />
          </ListGroup>
          {push.enabled ? (
            <Text variant="small" tone="success">
              {t("on")}
            </Text>
          ) : null}
          {push.state?.device?.failed && !push.enabled ? (
            <Text variant="small" tone="danger" accessibilityRole="alert">
              {t("failed")}
            </Text>
          ) : null}
          {deniedByPhone ? (
            <>
              <Text variant="small" tone="danger" accessibilityRole="alert">
                {t(Platform.OS === "web" ? "deniedWeb" : "denied")}
              </Text>
              {Platform.OS === "web" ? null : (
                <Button
                  variant="secondary"
                  label={t("openSettings")}
                  icon={(c) => <Settings2 color={c} size={18} aria-hidden />}
                  onPress={push.openSettings}
                />
              )}
            </>
          ) : null}
          {others > 0 ? (
            <Text variant="small" tone="subtle">
              {t("others", { count: others })}
            </Text>
          ) : null}
          {push.enabled ? (
            <Button
              variant="secondary"
              label={t("test")}
              icon={(c) => <BellRing color={c} size={18} aria-hidden />}
              loading={testing}
              onPress={() => void test()}
            />
          ) : null}
          {note ? (
            <Text
              variant="small"
              tone={note.tone}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {note.text}
            </Text>
          ) : null}
          <Text variant="small" tone="subtle">
            {t("categories")}
          </Text>
        </>
      )}
    </Section>
  );
}
