import type {
  AttachmentItem,
  ComposeOptions,
  HubValues,
  PollValue,
  ScheduleValue,
} from "@contract/compose";
import * as DocumentPicker from "expo-document-picker";
import { FileText, Plus, Trash2, Upload, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError } from "@/lib/api";
import { Button, colors, radius, space, Text, TextField, TOUCH } from "@/ui";
import { type PickedFile, uploadAttachment } from "./api";
import { DateTimeField } from "./datetime-field";
import { ChoiceCard, FieldError } from "./parts";

export const EMPTY_HUB: HubValues = {
  requireConfirm: false,
  allowComments: true,
  deadline: "",
  poll: null,
  schedule: null,
  attachments: [],
};

const NEW_POLL: PollValue = {
  question: "",
  multiple: false,
  options: [{ label: "" }, { label: "" }],
};
const NEW_SCHEDULE: ScheduleValue = {
  question: "",
  options: [{ startsAt: "", label: "" }],
};

/** 回答・参加: confirm button, comments, deadline, poll and 日程調整. */
export function ResponseFields({
  value,
  onChange,
  options,
  err,
}: {
  value: HubValues;
  onChange: (patch: Partial<HubValues>) => void;
  options: ComposeOptions;
  err: (name: string) => string | null;
}) {
  const t = useTranslations("adminContent.hub");
  return (
    <View style={styles.stack}>
      <ChoiceCard
        label={t("requireConfirm")}
        hint={t("requireConfirmHint")}
        checked={value.requireConfirm}
        onChange={(requireConfirm) => onChange({ requireConfirm })}
      />
      <ChoiceCard
        label={t("allowComments")}
        checked={value.allowComments}
        onChange={(allowComments) => onChange({ allowComments })}
      />
      <DateTimeField
        label={t("deadline")}
        hint={t("deadlineHint")}
        error={err("deadline")}
        value={value.deadline}
        onChange={(deadline) => onChange({ deadline })}
      />
      {value.poll ? (
        <PollEditor
          value={value.poll}
          max={options.limits.maxPollOptions}
          onChange={(poll) => onChange({ poll })}
          error={err("poll")}
        />
      ) : (
        <Button
          variant="secondary"
          label={t("poll.add")}
          icon={(c) => <Plus size={18} color={c} aria-hidden />}
          onPress={() => onChange({ poll: NEW_POLL })}
        />
      )}
      {value.schedule ? (
        <ScheduleEditor
          value={value.schedule}
          max={options.limits.maxScheduleOptions}
          onChange={(schedule) => onChange({ schedule })}
          error={err("schedule")}
        />
      ) : (
        <Button
          variant="secondary"
          label={t("schedule.add")}
          icon={(c) => <Plus size={18} color={c} aria-hidden />}
          onPress={() => onChange({ schedule: NEW_SCHEDULE })}
        />
      )}
    </View>
  );
}

function Box({
  title,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.box}>
      <View style={styles.boxHead}>
        <Text weight="semibold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.ghost,
            pressed ? styles.pressed : null,
          ]}
        >
          <Trash2 size={16} color={colors.red700} aria-hidden />
          <Text variant="small" weight="semibold" tone="danger">
            {removeLabel}
          </Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function IconButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

function PollEditor({
  value,
  onChange,
  error,
  max,
}: {
  value: PollValue;
  onChange: (v: PollValue | null) => void;
  error: string | null;
  max: number;
}) {
  const t = useTranslations("adminContent.hub.poll");
  const set = (patch: Partial<PollValue>) => onChange({ ...value, ...patch });
  const hasSaved = value.options.some((o) => o.id);
  return (
    <Box
      title={t("title")}
      onRemove={() => onChange(null)}
      removeLabel={t("remove")}
    >
      <FieldError>{error}</FieldError>
      <TextField
        label={t("question")}
        value={value.question}
        maxLength={300}
        onChangeText={(question) => set({ question })}
      />
      {value.options.map((o, i) => (
        <View key={o.id ?? `new-${i}`} style={styles.optionRow}>
          <View style={styles.grow}>
            <TextField
              accessibilityLabel={t("option", { n: i + 1 })}
              placeholder={t("option", { n: i + 1 })}
              value={o.label}
              maxLength={200}
              onChangeText={(label) =>
                set({
                  options: value.options.map((x, j) =>
                    j === i ? { ...x, label } : x,
                  ),
                })
              }
            />
          </View>
          <IconButton
            label={t("removeOption", { n: i + 1 })}
            disabled={value.options.length <= 2}
            onPress={() =>
              set({ options: value.options.filter((_, j) => j !== i) })
            }
          >
            <X size={18} color={colors.slate600} aria-hidden />
          </IconButton>
        </View>
      ))}
      <Button
        variant="secondary"
        label={t("addOption")}
        icon={(c) => <Plus size={18} color={c} aria-hidden />}
        disabled={value.options.length >= max}
        onPress={() => set({ options: [...value.options, { label: "" }] })}
      />
      <ChoiceCard
        label={t("multiple")}
        checked={value.multiple}
        onChange={(multiple) => set({ multiple })}
      />
      {hasSaved ? (
        <Text variant="caption" tone="muted">
          {t("editWarn")}
        </Text>
      ) : null}
    </Box>
  );
}

function ScheduleEditor({
  value,
  onChange,
  error,
  max,
}: {
  value: ScheduleValue;
  onChange: (v: ScheduleValue | null) => void;
  error: string | null;
  max: number;
}) {
  const t = useTranslations("adminContent.hub.schedule");
  const set = (patch: Partial<ScheduleValue>) =>
    onChange({ ...value, ...patch });
  const setOption = (i: number, patch: Partial<ScheduleValue["options"][0]>) =>
    set({
      options: value.options.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    });
  return (
    <Box
      title={t("title")}
      onRemove={() => onChange(null)}
      removeLabel={t("remove")}
    >
      <Text variant="small" tone="muted">
        {t("hint")}
      </Text>
      <FieldError>{error}</FieldError>
      <TextField
        label={t("question")}
        value={value.question}
        maxLength={300}
        onChangeText={(question) => set({ question })}
      />
      {value.options.map((o, i) => (
        <View key={o.id ?? `new-${i}`} style={styles.candidate}>
          <DateTimeField
            label={t("candidate", { n: i + 1 })}
            value={o.startsAt}
            onChange={(startsAt) => setOption(i, { startsAt })}
          />
          <View style={styles.optionRow}>
            <View style={styles.grow}>
              <TextField
                label={t("note", { n: i + 1 })}
                value={o.label}
                maxLength={100}
                onChangeText={(label) => setOption(i, { label })}
              />
            </View>
            <IconButton
              label={t("removeCandidate", { n: i + 1 })}
              disabled={value.options.length <= 1}
              onPress={() =>
                set({ options: value.options.filter((_, j) => j !== i) })
              }
            >
              <X size={18} color={colors.slate600} aria-hidden />
            </IconButton>
          </View>
        </View>
      ))}
      <Button
        variant="secondary"
        label={t("addCandidate")}
        icon={(c) => <Plus size={18} color={c} aria-hidden />}
        disabled={value.options.length >= max}
        onPress={() =>
          set({ options: [...value.options, { startsAt: "", label: "" }] })
        }
      />
    </Box>
  );
}

type UploadError = "type" | "size" | "count" | "generic" | "forbidden";

/** Attachments: uploaded as soon as they're picked, saved with the post. */
export function AttachmentFields({
  items,
  onChange,
  options,
  error,
}: {
  items: AttachmentItem[];
  onChange: (items: AttachmentItem[]) => void;
  options: ComposeOptions;
  error: string | null;
}) {
  const t = useTranslations("adminContent.hub.files");
  const { maxAttachments, attachmentMaxBytes, attachmentTypes } =
    options.limits;
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<UploadError | null>(null);

  async function uploadOne(f: PickedFile): Promise<AttachmentItem | null> {
    if (!attachmentTypes.includes(f.type)) {
      setFailed("type");
      return null;
    }
    if (f.size !== undefined && (f.size <= 0 || f.size > attachmentMaxBytes)) {
      setFailed("size");
      return null;
    }
    setBusy(f.name);
    try {
      return await uploadAttachment(f);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "generic";
      setFailed(
        code === "type" || code === "size" || code === "forbidden"
          ? code
          : // The platform refuses bodies over 4.5 MB before the action runs.
            e instanceof ApiError && e.status === 413
            ? "size"
            : "generic",
      );
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function pick() {
    setFailed(null);
    const r = await DocumentPicker.getDocumentAsync({
      type: attachmentTypes,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    if (items.length + r.assets.length > maxAttachments) {
      setFailed("count");
      return;
    }
    let next = items;
    for (const a of r.assets) {
      const item = await uploadOne({
        uri: a.uri,
        name: a.name,
        type: a.mimeType ?? "",
        size: a.size,
        file: a.file,
      });
      if (!item) break;
      next = [...next, item];
      onChange(next);
    }
  }

  return (
    <View style={styles.stack}>
      <Text variant="small" tone="muted">
        {t("hint", { max: maxAttachments })}
      </Text>
      {items.map((a, i) => (
        <View key={a.id ?? a.key} style={styles.file}>
          <FileText size={16} color={colors.slate500} aria-hidden />
          <Text variant="small" numberOfLines={1} style={styles.grow}>
            {a.fileName}
          </Text>
          <IconButton
            label={t("remove", { name: a.fileName })}
            onPress={() => onChange(items.filter((_, j) => j !== i))}
          >
            <X size={18} color={colors.slate600} aria-hidden />
          </IconButton>
        </View>
      ))}
      <View accessibilityLiveRegion="polite">
        {busy ? (
          <Text variant="small" tone="muted">
            {t("uploading", { name: busy })}
          </Text>
        ) : null}
        {failed ? (
          <Text variant="small" tone="danger" accessibilityRole="alert">
            {t(`errors.${failed}`, { max: maxAttachments })}
          </Text>
        ) : null}
        <FieldError>{error}</FieldError>
      </View>
      <Button
        variant="secondary"
        label={t("add")}
        icon={(c) => <Upload size={18} color={c} aria-hidden />}
        loading={Boolean(busy)}
        disabled={Boolean(busy) || items.length >= maxAttachments}
        onPress={() => void pick()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  grow: { flex: 1 },
  box: {
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    backgroundColor: colors.slate50,
    padding: space.md,
  },
  boxHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  ghost: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.slate100 },
  disabled: { opacity: 0.4 },
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  optionRow: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  candidate: {
    gap: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slate200,
  },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingLeft: space.md,
  },
});
