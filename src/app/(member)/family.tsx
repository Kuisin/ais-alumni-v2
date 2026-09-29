import { Stack } from "expo-router";
import { useRef, useState } from "react";
import { type ScrollView, type TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { useFamily } from "@/features/family/api";
import {
  ChildNameForm,
  FamilySearchForm,
  LinksCard,
  ManagedCard,
  MembersCard,
  RequestsCard,
} from "@/features/family/family";
import { SectionCard } from "@/features/family/parts";
import { QueryState, Screen, Text } from "@/ui";

/**
 * 家族 (the website's /app/family, §8): requests waiting for me, the child
 * accounts I manage (and handing them over), my family, pending links, and
 * adding a child / parent by search (or a child without an account).
 */
export default function FamilyScreen() {
  const t = useTranslations("family");
  const query = useFamily();
  const [refreshing, setRefreshing] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<"child" | "parent", number>>({
    child: 0,
    parent: 0,
  });
  const inputs = {
    child: useRef<TextInput>(null),
    parent: useRef<TextInput>(null),
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  // The empty state's 「子どもを検索」: jump to that search.
  const find = (direction: "child" | "parent") => {
    scroll.current?.scrollTo({ y: offsets.current[direction], animated: true });
    inputs[direction].current?.focus();
  };

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <QueryState query={query}>
        {(page) => (
          <Screen ref={scroll} refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("description")}
            </Text>
            {page.toConfirm.length ? (
              <RequestsCard requests={page.toConfirm} />
            ) : null}
            {page.managed.length ? (
              <ManagedCard managed={page.managed} />
            ) : null}
            <MembersCard page={page} onFind={find} />
            {page.links.length ? <LinksCard links={page.links} /> : null}
            {page.canClaimChild ? (
              <View
                onLayout={(e) => {
                  offsets.current.child = e.nativeEvent.layout.y;
                }}
              >
                <SectionCard
                  title={t("claimChild.title")}
                  description={t("claimChild.description")}
                >
                  <FamilySearchForm ref={inputs.child} direction="child" />
                  <ChildNameForm cohorts={page.cohorts} />
                </SectionCard>
              </View>
            ) : null}
            {page.canClaimParent ? (
              <View
                onLayout={(e) => {
                  offsets.current.parent = e.nativeEvent.layout.y;
                }}
              >
                <SectionCard
                  title={t("claimParent.title")}
                  description={t("claimParent.description")}
                >
                  <FamilySearchForm ref={inputs.parent} direction="parent" />
                </SectionCard>
              </View>
            ) : null}
          </Screen>
        )}
      </QueryState>
    </>
  );
}
