import type {
  AdminTeacher,
  AdminTeacherCandidate,
  AdminTeachers,
} from "@contract/admin";
import { Stack } from "expo-router";
import {
  GraduationCap,
  Search,
  UserMinus,
  UserPlus,
} from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { confirmAction } from "@/features/me/confirm";
import { useAuth } from "@/lib/auth";
import { joinList } from "@/lib/format";
import {
  Avatar,
  Badge,
  Button,
  colors,
  EmptyState,
  ListGroup,
  QueryState,
  Screen,
  Separator,
  space,
  Text,
  TextField,
} from "@/ui";
import { Notice } from "../parts";
import { useAdminTeachers, useSetTeacher } from "./api";

/**
 * 教職員 (the website's /app/admin/teachers): current teachers (現職), and
 * finding a member to make one. Admins and 教職員登録担当. Being a current
 * teacher opens children's profiles, so the server audits every change.
 */
export function TeachersScreen() {
  const t = useTranslations("teachers");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const query = useAdminTeachers(q);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  const search = () => setQ(input.trim().slice(0, 60));
  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Text variant="small" tone="muted">
          {t("description")}
        </Text>
        <Heading icon={UserPlus} title={t("add.title")} />
        <View style={styles.searchRow}>
          <View style={styles.flex}>
            <TextField
              value={input}
              onChangeText={setInput}
              placeholder={t("add.placeholder")}
              accessibilityLabel={t("add.search")}
              returnKeyType="search"
              onSubmitEditing={search}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={60}
            />
          </View>
          <Button
            variant="secondary"
            label={t("add.search")}
            icon={(c) => <Search color={c} size={16} aria-hidden />}
            onPress={search}
          />
        </View>
        <QueryState query={query}>{(data) => <Body data={data} />}</QueryState>
      </Screen>
    </>
  );
}

function Body({ data }: { data: AdminTeachers }) {
  const t = useTranslations("teachers");
  const [error, setError] = useState(false);
  return (
    <>
      {error ? (
        <Notice tone="error">
          <ErrorText />
        </Notice>
      ) : null}
      {data.q ? (
        data.results.length ? (
          <ListGroup>
            {data.results.map((u, i) => (
              <View key={u.id}>
                {i > 0 ? <Separator /> : null}
                <CandidateRow u={u} onError={setError} />
              </View>
            ))}
          </ListGroup>
        ) : (
          <EmptyState title={t("add.none")} />
        )
      ) : (
        <Text variant="small" tone="muted">
          {t("add.hint")}
        </Text>
      )}

      <Heading
        icon={GraduationCap}
        title={t("current.title")}
        count={data.current.length}
      />
      <Text variant="small" tone="muted">
        {t("current.hint")}
      </Text>
      {data.current.length ? (
        <ListGroup>
          {data.current.map((u, i) => (
            <View key={u.id}>
              {i > 0 ? <Separator /> : null}
              <TeacherRow u={u} onError={setError} />
            </View>
          ))}
        </ListGroup>
      ) : (
        <EmptyState title={t("current.none")} />
      )}
    </>
  );
}

function ErrorText() {
  const te = useTranslations("mobile.errors");
  return (
    <Text variant="small" tone="danger">
      {te("generic")}
    </Text>
  );
}

function Heading({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof UserPlus;
  title: string;
  count?: number;
}) {
  return (
    <View style={styles.heading}>
      <Icon color={colors.brand700} size={20} aria-hidden />
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      {count !== undefined ? (
        <Badge tone="brand" label={String(count)} />
      ) : null}
    </View>
  );
}

function CandidateRow({
  u,
  onError,
}: {
  u: AdminTeacherCandidate;
  onError: (e: boolean) => void;
}) {
  const t = useTranslations("teachers");
  const tr = useTranslations("roles");
  const { locale } = useAuth();
  const set = useSetTeacher();
  return (
    <View style={styles.row}>
      <Avatar uri={null} size={36} />
      <View style={styles.flex}>
        <Text weight="medium" numberOfLines={1}>
          {u.name}
        </Text>
        {u.roles.length ? (
          <Text variant="caption" tone="subtle">
            {joinList(
              u.roles.map((r) => tr(`role.${r}`)),
              locale,
            )}
          </Text>
        ) : null}
      </View>
      <Button
        compact
        label={t("add.button")}
        icon={(c) => <UserPlus color={c} size={16} aria-hidden />}
        loading={set.isPending}
        onPress={() => {
          onError(false);
          set.mutate(
            { userId: u.id, current: true },
            { onError: () => onError(true) },
          );
        }}
      />
    </View>
  );
}

function TeacherRow({
  u,
  onError,
}: {
  u: AdminTeacher;
  onError: (e: boolean) => void;
}) {
  const t = useTranslations("teachers");
  const tc = useTranslations("common");
  const set = useSetTeacher();
  const remove = async () => {
    const ok = await confirmAction({
      title: t("current.removeConfirm"),
      confirm: t("current.remove"),
      cancel: tc("cancel"),
      destructive: true,
    });
    if (!ok) return;
    onError(false);
    set.mutate(
      { userId: u.id, current: false },
      { onError: () => onError(true) },
    );
  };
  const meta = [
    u.yearsFrom ? t("current.since", { year: u.yearsFrom }) : null,
    u.subjects,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.row}>
      <Avatar uri={null} size={36} />
      <View style={styles.flex}>
        <Text weight="medium" numberOfLines={1}>
          {u.name}
        </Text>
        {u.schoolEmailVerified ? (
          <Badge tone="green" label={t("current.schoolEmail")} />
        ) : (
          <Badge tone="amber" label={t("current.schoolEmailMissing")} />
        )}
        {u.schoolEmail ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {u.schoolEmail}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" tone="subtle">
            {meta}
          </Text>
        ) : null}
      </View>
      <Button
        compact
        variant="secondary"
        label={t("current.remove")}
        icon={(c) => <UserMinus color={c} size={16} aria-hidden />}
        loading={set.isPending}
        onPress={() => void remove()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  searchRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
  },
});
