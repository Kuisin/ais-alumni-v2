import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { LifeBuoy } from "lucide-react-native";
import { type ReactNode, type RefObject, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  type ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { DeleteAccount } from "@/features/me/account-sections";
import { useAuth } from "@/lib/auth";
import { Button, Card, colors, Screen, space, Text } from "@/ui";

/**
 * The frame of every onboarding screen (the website's onboarding layout):
 * the logo and who is signed in, the page, and at the bottom 「わからない
 * ことやエラーがありますか？」 with お問い合わせ (registration questions),
 * ログアウト and アカウントの削除 (an applicant can delete theirs too).
 */
export function OnboardingShell({
  title,
  description,
  children,
  onRefresh,
  refreshing,
  footer,
  scrollRef,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** sticky actions under the scrolling page (the application's 戻る / 次へ) */
  footer?: ReactNode;
  /** to scroll the page (the application's steps start at the top) */
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const tm = useTranslations("mobile.onboarding");
  const ts = useTranslations("support.dialog");
  const tc = useTranslations("common");
  const tset = useTranslations("settings");
  const router = useRouter();
  const { me, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen
          ref={scrollRef}
          contentStyle={styles.content}
          onRefresh={onRefresh}
          refreshing={refreshing}
        >
          <View style={styles.brand}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              accessibilityIgnoresInvertColors
            />
            {me ? (
              <Text variant="caption" tone="muted" center>
                {tm("signedInAs", { name: me.user.email ?? me.user.name })}
              </Text>
            ) : null}
          </View>
          {title ? (
            <View style={styles.header}>
              <Text variant="heading" accessibilityRole="header">
                {title}
              </Text>
              {description ? <Text tone="muted">{description}</Text> : null}
            </View>
          ) : null}
          {children}
          <View style={styles.help}>
            <Text variant="small" tone="muted" center>
              {ts("help")}
            </Text>
            <Button
              variant="secondary"
              compact
              label={ts("open")}
              icon={(c) => <LifeBuoy size={16} color={c} />}
              onPress={() =>
                router.push("/support?type=QUESTION&topic=REGISTRATION")
              }
            />
            <Button
              variant="ghost"
              compact
              label={tc("signOut")}
              onPress={() => void signOut()}
            />
            {deleting ? (
              <Card style={styles.delete}>
                <DeleteAccount onCancel={() => setDeleting(false)} />
              </Card>
            ) : (
              <Button
                variant="ghost"
                compact
                label={tset("delete.button")}
                onPress={() => setDeleting(true)}
              />
            )}
          </View>
        </Screen>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    gap: space.xl,
    paddingTop: space.lg,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  brand: { alignItems: "center", gap: space.sm },
  logo: { width: 48, height: 48, borderRadius: 12 },
  header: { gap: space.xs },
  help: {
    alignItems: "center",
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.xl,
    marginTop: space.lg,
  },
  delete: { alignSelf: "stretch", borderColor: colors.red100 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
