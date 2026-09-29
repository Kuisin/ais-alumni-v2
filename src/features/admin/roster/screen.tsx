import type {
  AdminRoster,
  RosterDeleteResult,
  RosterImportResult,
} from "@contract/admin";
import * as DocumentPicker from "expo-document-picker";
import { Stack } from "expo-router";
import {
  FileSpreadsheet,
  Square,
  SquareCheck,
  Trash2,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { isApiError } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  colors,
  EmptyState,
  font,
  ListGroup,
  ListRow,
  QueryState,
  Screen,
  Section,
  Separator,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";
import { Notice } from "../parts";
import {
  type RosterFile,
  useAdminRoster,
  useRosterDelete,
  useRosterImport,
} from "./api";

/** CSV columns in order, with whether each is required (the website's page). */
const COLUMNS = [
  { key: "nameRomaji", required: true },
  { key: "nameKanji", required: false },
  { key: "dateOfBirth", required: false },
  { key: "yearsFrom", required: false },
  { key: "yearsTo", required: false },
  { key: "kind", required: false },
] as const;

/** The website's form's limit (roster-import-form.tsx). */
const MAX_FILE_BYTES = 5_000_000;

const MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

/**
 * 名簿 (the website's /app/admin/roster): what the roster holds, CSV import
 * with a preview, and deleting every row. Committee admins.
 */
export function RosterScreen() {
  const t = useTranslations("adminVerify");
  const query = useAdminRoster();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch().catch(() => {});
    setRefreshing(false);
  };
  return (
    <>
      <Stack.Screen options={{ title: t("roster.title") }} />
      <QueryState query={query}>
        {(roster) => (
          <Screen refreshing={refreshing} onRefresh={onRefresh}>
            <Text variant="small" tone="muted">
              {t("roster.description")}
            </Text>
            <Current roster={roster} />
            <ImportForm />
            {roster.total > 0 ? <DeleteForm /> : null}
          </Screen>
        )}
      </QueryState>
    </>
  );
}

function Current({ roster }: { roster: AdminRoster }) {
  const t = useTranslations("adminVerify");
  const tr = useTranslations("roles");
  return (
    <Section title={t("roster.current")}>
      {roster.total === 0 ? (
        <EmptyState
          icon={
            <FileSpreadsheet color={colors.slate400} size={28} aria-hidden />
          }
          title={t("roster.empty")}
          hint={t("roster.emptyHint")}
        />
      ) : (
        <>
          <ListGroup>
            {roster.byKind.map((k, i) => (
              <View key={k.kind}>
                {i > 0 ? <Separator /> : null}
                <ListRow
                  title={tr(`role.${k.kind}`)}
                  trailing={<Count n={k.count} />}
                />
              </View>
            ))}
            <Separator />
            <ListRow
              title={t("roster.total")}
              trailing={<Count n={roster.total} bold />}
            />
          </ListGroup>
          <Text variant="small" tone="muted">
            {t("roster.claimedCount", { count: roster.claimed })}
          </Text>
        </>
      )}
    </Section>
  );
}

function Count({ n, bold = false }: { n: number; bold?: boolean }) {
  return (
    <Text weight={bold ? "semibold" : "regular"} style={styles.num}>
      {n.toLocaleString()}
    </Text>
  );
}

type Picked = RosterFile & { label: string };

function ImportForm() {
  const t = useTranslations("adminVerify");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const mutation = useRosterImport();
  const [csv, setCsv] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [fileError, setFileError] = useState(false);
  const [result, setResult] = useState<RosterImportResult | null>(null);
  const [intent, setIntent] = useState<"preview" | "import" | null>(null);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "text/plain"],
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (!asset) return;
    setFileError(false);
    if ((asset.size ?? asset.file?.size ?? 0) > MAX_FILE_BYTES) {
      setPicked(null);
      setFileError(true);
      return;
    }
    setPicked(
      asset.file
        ? { file: asset.file, label: asset.name }
        : {
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType,
            label: asset.name,
          },
    );
  };

  const submit = (which: "preview" | "import") => {
    setIntent(which);
    mutation.mutate(
      { intent: which, file: picked, csv },
      {
        onSuccess: setResult,
        onError: (e) => {
          if (isApiError(e, "file_too_large")) {
            setResult(null);
            setFileError(true);
          } else
            setResult({
              ok: false,
              message: isApiError(e, "forbidden") ? "forbidden" : "generic",
            });
        },
      },
    );
  };

  const busy = mutation.isPending;
  return (
    <Section title={t("roster.importTitle")}>
      <Card style={styles.gap}>
        <Text variant="small" weight="semibold">
          {t("roster.spec.title")}
        </Text>
        {COLUMNS.map((c) => (
          <View key={c.key} style={styles.spec}>
            <View style={styles.specHead}>
              <Text variant="small" weight="medium" style={styles.mono}>
                {c.key}
              </Text>
              {c.required ? (
                <Badge tone="red" label={t("roster.spec.required")} />
              ) : null}
            </View>
            <Text variant="small" tone="muted">
              {t(`roster.spec.cols.${c.key}`)}
            </Text>
          </View>
        ))}
        <Text variant="caption" tone="subtle">
          {t("roster.spec.note")}
        </Text>
      </Card>

      <Card style={styles.gap}>
        <Text variant="small" weight="semibold">
          {t("roster.file")}
        </Text>
        <View style={styles.fileRow}>
          <Button
            variant="secondary"
            compact
            label={t("roster.chooseFile")}
            icon={(c) => <FileSpreadsheet color={c} size={16} aria-hidden />}
            onPress={() => void pick()}
            disabled={busy}
          />
          <Text
            variant="small"
            tone="muted"
            numberOfLines={1}
            style={styles.flex}
            accessibilityLiveRegion="polite"
          >
            {picked?.label ?? t("roster.noFile")}
          </Text>
          {picked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc("clear")}
              onPress={() => setPicked(null)}
              style={styles.clear}
            >
              <X color={colors.slate500} size={18} aria-hidden />
            </Pressable>
          ) : null}
        </View>
        {fileError ? (
          <Text variant="small" tone="danger">
            {t("roster.fileTooLarge")}
          </Text>
        ) : null}
        {picked ? null : (
          <TextField
            label={t("roster.paste")}
            hint={t("roster.columnsHint")}
            value={csv}
            onChangeText={setCsv}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
            style={styles.csv}
          />
        )}
        <View style={styles.buttons}>
          <Button
            variant="secondary"
            label={
              busy && intent === "preview" ? t("saving") : t("roster.preview")
            }
            loading={busy && intent === "preview"}
            disabled={busy}
            onPress={() => submit("preview")}
          />
          <Button
            label={
              busy && intent === "import" ? t("saving") : t("roster.import")
            }
            loading={busy && intent === "import"}
            disabled={busy}
            onPress={() => submit("import")}
          />
        </View>
        {result?.message ? (
          <Notice tone={result.ok ? "success" : "error"}>
            {t(`roster.messages.${result.message}`, {
              total: result.total ?? 0,
              imported: result.imported ?? 0,
              errors: result.errorCount ?? 0,
            })}
          </Notice>
        ) : null}
        {result?.byKind && Object.keys(result.byKind).length ? (
          <View>
            {Object.entries(result.byKind).map(([kind, n]) => (
              <Text key={kind} variant="small">
                {tr(`role.${kind}`)}: {n}
              </Text>
            ))}
          </View>
        ) : null}
        {result?.errors?.length ? (
          <View>
            {result.errors.map((e) => (
              <Text key={`${e.line}-${e.error}`} variant="small" tone="danger">
                •{" "}
                {t("roster.lineError", {
                  line: e.line,
                  error: t(`roster.rowErrors.${e.error}`),
                })}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

function DeleteForm() {
  const t = useTranslations("adminVerify");
  const mutation = useRosterDelete();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<RosterDeleteResult | null>(null);
  const Box = confirm ? SquareCheck : Square;
  return (
    <Section title={t("roster.deleteTitle")}>
      <Card style={styles.gap}>
        <Text variant="small" tone="muted">
          {t("roster.deleteDescription")}
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirm }}
          onPress={() => setConfirm((v) => !v)}
          style={styles.check}
        >
          <Box
            color={confirm ? colors.brand700 : colors.slate500}
            size={22}
            aria-hidden
          />
          <Text variant="small" style={styles.flex}>
            {t("roster.deleteConfirm")}
          </Text>
        </Pressable>
        <Button
          variant="danger"
          label={mutation.isPending ? t("saving") : t("roster.deleteAll")}
          icon={(c) => <Trash2 color={c} size={16} aria-hidden />}
          loading={mutation.isPending}
          onPress={() =>
            mutation.mutate(confirm, {
              onSuccess: (r) => {
                setResult(r);
                if (r.ok) setConfirm(false);
              },
              onError: (e) =>
                setResult({
                  ok: false,
                  message: isApiError(e, "forbidden") ? "forbidden" : undefined,
                }),
            })
          }
        />
        {result?.message ? (
          <Notice tone={result.ok ? "success" : "error"}>
            {t(`roster.messages.${result.message}`, {
              deleted: result.deleted ?? 0,
            })}
          </Notice>
        ) : null}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  flex: { flex: 1 },
  num: { fontVariant: ["tabular-nums"] },
  mono: { fontFamily: MONO },
  spec: { gap: 2 },
  specHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  fileRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  clear: {
    minWidth: TOUCH,
    minHeight: TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  csv: {
    minHeight: 160,
    fontFamily: MONO,
    fontSize: font.size.sm,
  },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  check: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
});
