import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/navigation";
import { useTabHeaderOptions } from "./tab-header";

/**
 * A tab's own stack (src/app/(member)/(tabs)/(<tab>)/_layout.tsx): it draws
 * the tab's header — iOS's native tabs have none — with マイページ's photo at
 * the top left and お知らせ's bell at the top right (tab-header.tsx). The
 * tab's "create" actions are buttons in the page, not in the header.
 */
export function TabStack({
  name,
  title,
}: {
  /** the tab's screen file, e.g. "home" */
  name: string;
  title: string;
}) {
  const header = useTabHeaderOptions();
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name={name} options={{ title, ...header }} />
    </Stack>
  );
}
