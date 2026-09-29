import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { useTranslations } from "use-intl";
import { WebPage } from "@/features/web/web-page";
import { colors } from "@/ui";

/**
 * A website screen inside the app (`/web?path=/app/family&title=…`), for
 * everything the app doesn't have natively: onboarding, admin mode, family,
 * invites, profile editing, … See src/lib/links.ts.
 */
export default function WebScreen() {
  const t = useTranslations("mobile.web");
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const path = params.path?.startsWith("/") ? params.path : "/app/dashboard";
  const [pageTitle, setPageTitle] = useState<string | null>(null);

  // Whatever was done on the website may show up in the app's screens.
  useEffect(() => () => void queryClient.invalidateQueries(), [queryClient]);

  return (
    <>
      <Stack.Screen
        options={{
          title: params.title ?? pageTitle ?? t("title"),
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("close")}
              onPress={() => router.back()}
              hitSlop={12}
            >
              <X color={colors.brand700} size={24} />
            </Pressable>
          ),
        }}
      />
      <WebPage path={path} onTitle={setPageTitle} />
    </>
  );
}
