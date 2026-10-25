import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { ProfileButton } from "@/features/me/profile-button";
import { stackScreenOptions } from "@/lib/navigation";

/**
 * A tab's own stack (src/app/(member)/(tabs)/(<tab>)/_layout.tsx): it draws
 * the tab's header — iOS's native tabs have none — with マイページ's photo at
 * the top left. The screen can add header buttons with <Stack.Screen>.
 */
export function TabStack({
  name,
  title,
  headerRight,
}: {
  /** the tab's screen file, e.g. "home" */
  name: string;
  title: string;
  headerRight?: () => ReactNode;
}) {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name={name}
        options={{
          title,
          headerLeft: () => <ProfileButton />,
          headerRight,
        }}
      />
    </Stack>
  );
}
