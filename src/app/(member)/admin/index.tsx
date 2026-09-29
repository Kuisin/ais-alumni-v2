import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import { useAdminHome } from "@/features/admin/api";
import { LeaveAdminButton } from "@/features/admin/leave-button";
import { adminSections } from "@/features/admin/nav";
import { useMe } from "@/lib/auth";
import {
  CountDot,
  colors,
  EmptyState,
  ListGroup,
  ListRow,
  Screen,
  Section,
  Separator,
} from "@/ui";

/**
 * 管理モード home: the sections this member may use, grouped as the
 * website's admin sidebar, with the work waiting on each. (The website
 * opens the first one instead; a phone needs the list.)
 */
export default function AdminHomeScreen() {
  const tc = useTranslations("common");
  const t = useTranslations("mobile.admin");
  const router = useRouter();
  const me = useMe();
  const home = useAdminHome();
  const [refreshing, setRefreshing] = useState(false);
  const groups = adminSections(me.access);
  const counts = home.data?.counts;

  const onRefresh = async () => {
    setRefreshing(true);
    await home.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen
        options={{
          title: tc("nav.adminMode"),
          headerLeft: () => <LeaveAdminButton />,
        }}
      />
      {groups.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        groups.map(({ group, items }) => (
          <Section key={group} title={tc(`adminGroups.${group}`)}>
            <ListGroup>
              {items.map((item, i) => {
                const label = tc(item.label);
                const count = item.count && counts ? counts[item.count] : 0;
                const Icon = item.icon;
                return (
                  <View key={item.webPath}>
                    {i > 0 ? <Separator /> : null}
                    <ListRow
                      leading={
                        <Icon color={colors.brand700} size={20} aria-hidden />
                      }
                      title={label}
                      trailing={<CountDot count={count} />}
                      accessibilityLabel={
                        count > 0
                          ? `${label}, ${tc("nav.pending", { count })}`
                          : undefined
                      }
                      onPress={() => item.href && router.push(item.href)}
                    />
                  </View>
                );
              })}
            </ListGroup>
          </Section>
        ))
      )}
    </Screen>
  );
}
