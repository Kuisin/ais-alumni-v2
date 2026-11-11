import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
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
import { useAdminHome } from "./api";
import { adminSections } from "./nav";

/**
 * 管理モード's sections this member may use, grouped as the website's admin
 * sidebar, with the work waiting on each: admin/index on a phone, the left
 * column beside the sections on a wide window (src/features/admin/split.tsx).
 */
export function AdminSectionList({
  selected,
  onOpen,
}: {
  /** beside the sections: the href of the one shown (undefined: a phone) */
  selected?: string | null;
  onOpen: (href: string) => void;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("mobile.admin");
  const me = useMe();
  const home = useAdminHome();
  const [refreshing, setRefreshing] = useState(false);
  const groups = adminSections(me.access);
  const counts = home.data?.counts;
  const beside = selected !== undefined;

  const onRefresh = async () => {
    setRefreshing(true);
    await home.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
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
                const href = item.href ? String(item.href) : null;
                return (
                  <View key={item.webPath}>
                    {i > 0 ? <Separator /> : null}
                    <ListRow
                      leading={
                        <Icon color={colors.brand700} size={20} aria-hidden />
                      }
                      title={label}
                      trailing={<CountDot count={count} />}
                      chevron={!beside}
                      selected={beside ? href === selected : undefined}
                      accessibilityLabel={
                        count > 0
                          ? `${label}, ${tc("nav.pending", { count })}`
                          : undefined
                      }
                      onPress={() => href && onOpen(href)}
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
