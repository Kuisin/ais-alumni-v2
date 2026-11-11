import { type Href, Stack, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { LeaveAdminButton } from "@/features/admin/leave-button";
import { AdminSectionList } from "@/features/admin/section-list";
import { useAdminSplit } from "@/features/admin/split";
import { EmptyState, Screen } from "@/ui";

/**
 * 管理モード home: on a phone, the sections this member may use (the website
 * opens the first one instead; a phone needs the list). On a wide window
 * the list is beside the stack already (src/features/admin/split.tsx), so
 * this — the right pane before a section is chosen — only says to pick one.
 */
export default function AdminHomeScreen() {
  const tc = useTranslations("common");
  const t = useTranslations("mobile.admin");
  const router = useRouter();
  const { wide, setHeaderHeight } = useAdminSplit();
  // The list column's header matches the stack's (this screen is always at
  // the bottom of the stack, so it's there to measure).
  const headerHeight = useHeaderHeight();
  useEffect(
    () => setHeaderHeight(headerHeight),
    [headerHeight, setHeaderHeight],
  );

  return (
    <>
      <Stack.Screen
        options={
          wide
            ? { title: "", headerLeft: () => null }
            : {
                title: tc("nav.adminMode"),
                headerLeft: () => <LeaveAdminButton />,
              }
        }
      />
      {wide ? (
        <Screen>
          <EmptyState title={t("pickSection")} />
        </Screen>
      ) : (
        <AdminSectionList onOpen={(href) => router.push(href as Href)} />
      )}
    </>
  );
}
