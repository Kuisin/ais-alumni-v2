import type { MyProfile } from "@contract/account";
import type { Me } from "@contract/core";
import { type Href, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Avatar, Badge, Card, space, Text, TOUCH } from "@/ui";

const PHOTO = 96;

/**
 * The top of my profile — what other members see first — as on the
 * website: photo, names, roles and follow counts. Shown
 * from /me right away; roles and counts arrive with /profile.
 */
export function ProfileHeader({
  me,
  profile,
}: {
  me: Me;
  profile: MyProfile | undefined;
}) {
  const t = useTranslations("profile");
  const tf = useTranslations("follows");
  const router = useRouter();
  const name = profile?.name ?? me.user.name;
  const otherName = profile ? profile.otherName : me.user.otherName;
  const bold = (chunks: ReactNode) => (
    <Text variant="small" weight="semibold">
      {chunks}
    </Text>
  );
  const openFollows = (tab: "followers" | "following") =>
    router.push({ pathname: "/follows", params: { tab } } as Href);

  return (
    <Card style={styles.card}>
      <View style={styles.photo}>
        <Avatar uri={profile?.avatar ?? me.user.avatar} size={PHOTO} />
      </View>

      <View style={styles.names}>
        <Text variant="heading" center accessibilityRole="header">
          {name}
        </Text>
        {otherName ? (
          <Text tone="muted" center>
            {otherName}
          </Text>
        ) : null}
        {profile?.nameAtAis ? (
          <Text variant="small" tone="muted" center>
            {t("nameAtAisValue", { name: profile.nameAtAis })}
          </Text>
        ) : null}
      </View>

      {profile?.roles.length ? (
        <View style={styles.badges}>
          {profile.roles.map((r) => (
            <Badge key={r.role} tone="brand" label={r.label} />
          ))}
        </View>
      ) : null}

      {profile ? (
        <View style={styles.counts}>
          <Pressable
            accessibilityRole="link"
            onPress={() => openFollows("followers")}
            style={styles.count}
          >
            <Text variant="small" tone="muted">
              {tf.rich("counts.followers", {
                count: profile.follows.followers,
                b: bold,
              })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => openFollows("following")}
            style={styles.count}
          >
            <Text variant="small" tone="muted">
              {tf.rich("counts.following", {
                count: profile.follows.following,
                b: bold,
              })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: space.md },
  photo: { width: PHOTO, height: PHOTO },
  names: { alignItems: "center", gap: 2 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.xs,
  },
  counts: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: space.lg,
  },
  count: { minHeight: TOUCH, justifyContent: "center" },
});
