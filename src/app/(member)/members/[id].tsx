import type { ProfileAudience } from "@contract/people";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { MoreHorizontal } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { useMember } from "@/features/people/api";
import { MemberMenu } from "@/features/people/member-menu";
import {
  AboutSection,
  ContactSection,
  HistorySection,
  PreviewBanner,
  ProfileHeader,
  RecordSection,
  StageSection,
} from "@/features/people/profile";
import { useMe } from "@/lib/auth";
import { colors, QueryState, radius, Screen, TOUCH } from "@/ui";

const AUDIENCES: readonly string[] = ["members", "followers", "family"];

function audience(v: string | undefined): ProfileAudience | null {
  return v && AUDIENCES.includes(v) ? (v as ProfileAudience) : null;
}

/**
 * A member's profile (the website's /app/members/[id]), exactly what the
 * website shows this member: the server projects it (getProfileForViewer)
 * and decides every button. ?as=members|followers|family previews my own
 * profile; my profile itself is the マイページ tab.
 */
export default function MemberScreen() {
  const params = useLocalSearchParams<{ id: string; as?: string }>();
  const id = params.id ?? "";
  const preview = audience(params.as);
  const t = useTranslations("profile");
  const tf = useTranslations("follows");
  const me = useMe();
  const router = useRouter();
  const self = id === me.user.id && !preview;
  const query = useMember(id, preview, !self);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState(false);
  const profile = query.data;

  if (self) return <Redirect href={"/me"} />;

  const refresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("title"),
          headerRight: profile?.relationship.menu
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tf("menu.label")}
                  onPress={() => setMenu(true)}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.menu,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <MoreHorizontal
                    size={22}
                    color={colors.brand700}
                    aria-hidden
                  />
                </Pressable>
              )
            : undefined,
        }}
      />
      <QueryState query={query}>
        {(p) => (
          <Screen refreshing={refreshing} onRefresh={refresh}>
            {p.preview ? (
              <PreviewBanner
                preview={p.preview}
                onView={(as) => router.setParams({ as })}
                onBack={() => router.navigate("/me")}
              />
            ) : null}
            <ProfileHeader profile={p} />
            {p.bio ? <AboutSection bio={p.bio} /> : null}
            <RecordSection profile={p} />
            {p.currentStage ? <StageSection stage={p.currentStage} /> : null}
            {p.history ? <HistorySection history={p.history} /> : null}
            <ContactSection profile={p} />
          </Screen>
        )}
      </QueryState>
      {profile?.relationship.menu ? (
        <MemberMenu
          visible={menu}
          onClose={() => setMenu(false)}
          memberId={profile.id}
          name={profile.name}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  pressed: { backgroundColor: colors.brand50 },
});
