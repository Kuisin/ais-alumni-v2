import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text,
} from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  font,
  foregroundStyle,
  frame,
  listRowBackground,
  listStyle,
  monospacedDigit,
  padding,
  refreshable,
  scrollContentBackground,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/lib/auth";
import { colors, EmptyState, ScreenView } from "@/ui";
import { useAdminHome } from "./api";
import { adminSections } from "./nav";

/**
 * 管理モード's sections on iOS: the system's own list (SwiftUI `List`,
 * inset grouped, as in the Settings app) — a section per group, a row per
 * section with its SF Symbol, the work waiting and, on a phone, the
 * disclosure chevron. Beside the sections (a wide window) the shown one is
 * highlighted. Android and the web: section-list.tsx.
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
  const groups = adminSections(me.access);
  const counts = home.data?.counts;
  const beside = selected !== undefined;

  if (groups.length === 0) {
    return (
      <ScreenView>
        <EmptyState title={t("empty")} />
      </ScreenView>
    );
  }

  return (
    <ScreenView>
      <Host style={styles.fill}>
        <List
          modifiers={[
            listStyle("insetGrouped"),
            // The app's page background, as beside the other screens.
            scrollContentBackground("hidden"),
            refreshable(async () => {
              await home.refetch().catch(() => {});
            }),
          ]}
        >
          {groups.map(({ group, items }) => (
            <Section key={group} title={tc(`adminGroups.${group}`)}>
              {items.map((item) => {
                const label = tc(item.label);
                const count = item.count && counts ? counts[item.count] : 0;
                const href = item.href ? String(item.href) : null;
                const current = beside && href === selected;
                return (
                  <Button
                    key={item.webPath}
                    onPress={() => href && onOpen(href)}
                    modifiers={[
                      accessibilityLabel(
                        count > 0
                          ? `${label}, ${tc("nav.pending", { count })}`
                          : label,
                      ),
                      ...(current
                        ? [
                            listRowBackground(colors.brand100),
                            accessibilityAddTraits(["isSelected"]),
                          ]
                        : []),
                    ]}
                  >
                    <HStack spacing={12}>
                      <Image
                        systemName={item.symbol}
                        color={colors.brand700}
                        size={18}
                        modifiers={[frame({ width: 28 })]}
                      />
                      <Text modifiers={[foregroundStyle(colors.text)]}>
                        {label}
                      </Text>
                      <Spacer />
                      {count > 0 ? (
                        <Text
                          modifiers={[
                            font({ textStyle: "footnote", weight: "semibold" }),
                            monospacedDigit(),
                            foregroundStyle(colors.white),
                            padding({ horizontal: 7, vertical: 2 }),
                            background(colors.red600, shapes.capsule()),
                          ]}
                        >
                          {count > 99 ? "99+" : String(count)}
                        </Text>
                      ) : null}
                      {beside ? null : (
                        <Image
                          systemName="chevron.right"
                          color={colors.slate400}
                          modifiers={[
                            font({ textStyle: "footnote", weight: "semibold" }),
                          ]}
                        />
                      )}
                    </HStack>
                  </Button>
                );
              })}
            </Section>
          ))}
        </List>
      </Host>
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
