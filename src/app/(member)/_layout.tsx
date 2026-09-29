import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/navigation";

export const unstable_settings = { anchor: "(tabs)" };

/**
 * Approved members: the tab bar, and detail screens pushed over it
 * (news/[id], events/[id], chat/[id], members/[id] …).
 */
export default function MemberLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* 管理モード has its own stack (and headers) */}
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}
