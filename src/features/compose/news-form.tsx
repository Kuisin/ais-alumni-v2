import type {
  AudienceSpec,
  ComposeOptions,
  ComposeSaved,
  Delivery,
  HubValues,
  NewsFormValues,
  NewsStatus,
} from "@contract/compose";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  ImageIcon,
  ListChecks,
  Paperclip,
  Send,
  Type,
  Users,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, colors, radius, space, Text, TextField } from "@/ui";
import {
  appendFile,
  type PickedFile,
  type SaveError,
  saveError,
  useSaveCompose,
} from "./api";
import { AudiencePicker, EVERYONE } from "./audience-picker";
import { DateTimeField } from "./datetime-field";
import { AttachmentFields, EMPTY_HUB, ResponseFields } from "./hub-fields";
import { ChoiceCard, FieldError, FormSection, Notice } from "./parts";

export const EMPTY_NEWS: NewsFormValues = {
  titleJa: "",
  titleEn: "",
  bodyJa: "",
  bodyEn: "",
  status: null,
  sendAt: "",
  notifyOnPublish: true,
  pinned: false,
  audience: EVERYONE,
  audienceMembers: [],
  coverPreviewUrl: null,
  hub: EMPTY_HUB,
};

/** The 配信 option selected when the editor opens. */
function initialDelivery(status: NewsStatus | null): Delivery {
  if (status === "published") return "KEEP";
  if (status === "scheduled") return "SCHEDULE";
  if (status === "draft") return "DRAFT";
  return "NOW";
}

/**
 * The website's NewsForm: title / body in both languages, cover, files,
 * 回答・参加 (confirm, poll, 日程調整, deadline), 配信 and 受け取る人. Saved
 * as the website's form (multipart) by POST /compose/news, which checks
 * and stores everything as the website does. Used by /news/new and by
 * admin mode's edit screen (values from the server; `id` set).
 */
export function NewsForm({
  values,
  options,
  onSaved,
  extraActions,
}: {
  values: NewsFormValues;
  options: ComposeOptions;
  onSaved: (saved: ComposeSaved) => void;
  /** e.g. a delete button, under the save button */
  extraActions?: ReactNode;
}) {
  const t = useTranslations("adminContent");
  const tc = useTranslations("common");
  const tm = useTranslations("mobile.compose");
  const save = useSaveCompose("news");
  const [state, setState] = useState<SaveError | null>(null);
  const [saved, setSaved] = useState(false);

  const [titleJa, setTitleJa] = useState(values.titleJa);
  const [titleEn, setTitleEn] = useState(values.titleEn);
  const [bodyJa, setBodyJa] = useState(values.bodyJa);
  const [bodyEn, setBodyEn] = useState(values.bodyEn);
  const [cover, setCover] = useState<PickedFile | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [hub, setHub] = useState<HubValues>(values.hub);
  const [delivery, setDelivery] = useState<Delivery>(() =>
    initialDelivery(values.status),
  );
  const [sendAt, setSendAt] = useState(values.sendAt);
  const [notify, setNotify] = useState(values.notifyOnPublish);
  const [pinned, setPinned] = useState(values.pinned);
  const [audience, setAudience] = useState<AudienceSpec>(values.audience);

  const scope = options.scope;
  const err = (name: string) => {
    const key = state?.fieldErrors[name];
    return key ? t(`errors.${key}`) : null;
  };

  const submitLabel =
    // 同窓会委員: nothing goes out until another 同窓会委員 approves.
    scope.kind === "COMMITTEE" && delivery !== "DRAFT"
      ? t("approval.submit")
      : delivery === "NOW"
        ? notify
          ? t("delivery.submitConfirm")
          : t("delivery.submitPublish")
        : delivery === "SCHEDULE"
          ? t("delivery.submitSchedule")
          : delivery === "DRAFT"
            ? t("delivery.submitDraft")
            : tc("save");

  const pickCover = async () => {
    setCoverError(null);
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    const type = a.mimeType ?? "image/jpeg";
    if (type !== "image/jpeg" && type !== "image/png") {
      setCoverError(t("errors.coverType"));
      return;
    }
    if (a.fileSize && a.fileSize > options.limits.coverMaxBytes) {
      setCoverError(t("errors.coverSize"));
      return;
    }
    const ext = type === "image/png" ? "png" : "jpg";
    setCover({
      uri: a.uri,
      name: a.fileName ?? `cover.${ext}`,
      type,
      size: a.fileSize,
      file: a.file,
    });
    setRemoveCover(false);
  };

  const submit = () => {
    setState(null);
    setSaved(false);
    const fd = new FormData();
    if (values.id) fd.append("id", values.id);
    fd.append("titleJa", titleJa);
    fd.append("titleEn", titleEn);
    fd.append("bodyJa", bodyJa);
    fd.append("bodyEn", bodyEn);
    fd.append("delivery", delivery);
    if (delivery === "SCHEDULE") fd.append("sendAt", sendAt);
    if (notify) fd.append("notifyOnPublish", "on");
    if (pinned) fd.append("pinned", "on");
    fd.append("audience", JSON.stringify(audience));
    if (hub.requireConfirm) fd.append("requireConfirm", "on");
    if (hub.allowComments) fd.append("allowComments", "on");
    fd.append("deadline", hub.deadline);
    fd.append("poll", JSON.stringify(hub.poll));
    fd.append("schedule", JSON.stringify(hub.schedule));
    fd.append("attachments", JSON.stringify(hub.attachments));
    if (cover) appendFile(fd, "cover", cover);
    if (removeCover) fd.append("removeCover", "on");
    save.mutate(fd, {
      onSuccess: (r) => {
        setSaved(true);
        setCover(null);
        onSaved(r);
      },
      onError: (e) => setState(saveError(e)),
    });
  };

  return (
    <View style={styles.form}>
      {state ? (
        <Notice tone="error">
          {state.error === "validation"
            ? tc("errors.validation")
            : state.error === "network"
              ? tm("network")
              : t.has(`errors.${state.error}`)
                ? t(`errors.${state.error}`)
                : tc("errors.generic")}
        </Notice>
      ) : null}
      {saved && values.id ? (
        <Notice tone="success">{tc("saved")}</Notice>
      ) : null}
      {scope.kind === "COMMITTEE" ? (
        <Notice tone="info">{t("approval.formHint")}</Notice>
      ) : null}

      <FormSection
        icon={(c) => <Type size={16} color={c} aria-hidden />}
        title={t("sections.content")}
        description={t("fields.titleHint")}
      >
        <TextField
          label={t("fields.titleJa")}
          value={titleJa}
          onChangeText={setTitleJa}
          maxLength={200}
          error={err("titleJa")}
        />
        <TextField
          label={t("fields.titleEn")}
          value={titleEn}
          onChangeText={setTitleEn}
          maxLength={200}
          error={err("titleEn")}
          autoCapitalize="sentences"
        />
        <TextField
          label={t("fields.bodyJa")}
          value={bodyJa}
          onChangeText={setBodyJa}
          multiline
          textAlignVertical="top"
          style={styles.body}
          error={err("bodyJa")}
        />
        <TextField
          label={t("fields.bodyEn")}
          value={bodyEn}
          onChangeText={setBodyEn}
          multiline
          textAlignVertical="top"
          style={styles.body}
          error={err("bodyEn")}
        />
        <Text variant="caption" tone="subtle">
          {t("fields.markdownHint")}
        </Text>
      </FormSection>

      <FormSection
        icon={(c) => <ImageIcon size={16} color={c} aria-hidden />}
        title={t("sections.cover")}
      >
        {cover || (values.coverPreviewUrl && !removeCover) ? (
          <Image
            source={{ uri: cover?.uri ?? values.coverPreviewUrl ?? undefined }}
            accessibilityLabel={t("fields.currentCover")}
            style={styles.cover}
            contentFit="cover"
          />
        ) : null}
        {values.coverPreviewUrl && !cover ? (
          <ChoiceCard
            label={t("fields.removeCover")}
            checked={removeCover}
            onChange={setRemoveCover}
          />
        ) : null}
        <Text variant="small" weight="semibold">
          {t("fields.cover")}
        </Text>
        <View style={styles.row}>
          <Button
            variant="secondary"
            label={cover ? tm("coverChange") : tm("coverPick")}
            icon={(c) => <ImageIcon size={18} color={c} aria-hidden />}
            onPress={() => void pickCover()}
            style={styles.grow}
          />
          {cover ? (
            <Button
              variant="ghost"
              label={tc("cancel")}
              onPress={() => setCover(null)}
            />
          ) : null}
        </View>
        <FieldError>{coverError ?? err("cover")}</FieldError>
        <Text variant="caption" tone="subtle">
          {t("fields.coverHint")}
        </Text>
      </FormSection>

      <FormSection
        icon={(c) => <Paperclip size={16} color={c} aria-hidden />}
        title={t("sections.attachments")}
      >
        <AttachmentFields
          items={hub.attachments}
          onChange={(attachments) => setHub((h) => ({ ...h, attachments }))}
          options={options}
          error={err("attachments")}
        />
      </FormSection>

      <FormSection
        icon={(c) => <ListChecks size={16} color={c} aria-hidden />}
        title={t("sections.responses")}
      >
        <ResponseFields
          value={hub}
          onChange={(patch) => setHub((h) => ({ ...h, ...patch }))}
          options={options}
          err={err}
        />
      </FormSection>

      <FormSection
        icon={(c) => <Send size={16} color={c} aria-hidden />}
        title={t("sections.delivery")}
      >
        <DeliveryField
          published={values.status === "published"}
          delivery={delivery}
          onDelivery={setDelivery}
          notify={notify}
          onNotify={setNotify}
          sendAt={sendAt}
          onSendAt={setSendAt}
          sendAtError={err("sendAt")}
        />
        <ChoiceCard
          label={t("fields.pinned")}
          checked={pinned}
          onChange={setPinned}
        />
      </FormSection>

      <FormSection
        icon={(c) => <Users size={16} color={c} aria-hidden />}
        title={t("sections.audience")}
      >
        <AudiencePicker
          options={options}
          initialSpec={values.audience}
          initialMembers={values.audienceMembers}
          onChange={setAudience}
          error={err("audience")}
        />
      </FormSection>

      <Button
        label={save.isPending ? tc("saving") : submitLabel}
        loading={save.isPending}
        onPress={submit}
      />
      {extraActions}
    </View>
  );
}

/**
 * 配信: 今すぐ送信 / 予約 / 下書き (and 公開中 for a live post), the reserved
 * time, and whether notifications go out.
 */
function DeliveryField({
  published,
  delivery,
  onDelivery,
  notify,
  onNotify,
  sendAt,
  onSendAt,
  sendAtError,
}: {
  published: boolean;
  delivery: Delivery;
  onDelivery: (d: Delivery) => void;
  notify: boolean;
  onNotify: (on: boolean) => void;
  sendAt: string;
  onSendAt: (v: string) => void;
  sendAtError: string | null;
}) {
  const t = useTranslations("adminContent");
  const options: Delivery[] = [
    ...(published ? (["KEEP"] as const) : []),
    "NOW",
    "SCHEDULE",
    "DRAFT",
  ];
  const withNotify = delivery === "NOW" || delivery === "SCHEDULE";
  return (
    <View style={styles.stack}>
      <Text variant="small" weight="medium">
        {t("delivery.legend")}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.stack}>
        {options.map((d) => (
          <ChoiceCard
            key={d}
            radio
            label={t(`delivery.${d}`)}
            hint={t(`delivery.${d}Hint`)}
            checked={delivery === d}
            onChange={() => onDelivery(d)}
          />
        ))}
      </View>
      {delivery === "SCHEDULE" ? (
        <DateTimeField
          label={t("delivery.sendAt")}
          hint={t("delivery.sendAtHint")}
          error={sendAtError}
          required
          value={sendAt}
          onChange={onSendAt}
          min={new Date()}
        />
      ) : null}
      {withNotify ? (
        <ChoiceCard
          label={t("delivery.notify")}
          hint={t("delivery.notifyHint")}
          checked={notify}
          onChange={onNotify}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  stack: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  body: { minHeight: 200, paddingTop: space.sm },
  cover: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate100,
  },
});
