import type {
  AudienceSpec,
  ComposeOptions,
  ComposeSaved,
  EventFormValues,
} from "@contract/compose";
import { CalendarClock, MapPin, Type, Users } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button, space, Text, TextField } from "@/ui";
import { type SaveError, saveError, useSaveCompose } from "./api";
import { AudiencePicker, EVERYONE } from "./audience-picker";
import { DateTimeField } from "./datetime-field";
import { FormSection, Notice } from "./parts";

export const EMPTY_EVENT: EventFormValues = {
  titleJa: "",
  titleEn: "",
  bodyJa: "",
  bodyEn: "",
  startsAt: "",
  endsAt: "",
  rsvpDeadline: "",
  location: "",
  mapUrl: "",
  capacity: "",
  audience: EVERYONE,
  audienceMembers: [],
};

/**
 * The website's EventForm: title / details in both languages, when (Japan
 * time), where, capacity and RSVP deadline, and who is invited (the same
 * picker as ニュース). Saved by POST /compose/events (the website's action
 * checks everything). Used by /events/new and admin mode's edit screen.
 */
export function EventForm({
  values,
  options,
  onSaved,
  extraActions,
}: {
  values: EventFormValues;
  options: ComposeOptions;
  onSaved: (saved: ComposeSaved) => void;
  /** e.g. a delete button, under the save button */
  extraActions?: ReactNode;
}) {
  const t = useTranslations("adminContent");
  const tc = useTranslations("common");
  const tm = useTranslations("mobile.compose");
  const save = useSaveCompose("events");
  const [state, setState] = useState<SaveError | null>(null);
  const [saved, setSaved] = useState(false);
  const [v, setV] = useState(values);
  const [audience, setAudience] = useState<AudienceSpec>(values.audience);
  const set = (patch: Partial<EventFormValues>) =>
    setV((x) => ({ ...x, ...patch }));
  const err = (name: string) => {
    const key = state?.fieldErrors[name];
    return key ? t(`errors.${key}`) : null;
  };

  const submit = () => {
    setState(null);
    setSaved(false);
    const fd = new FormData();
    if (values.id) fd.append("id", values.id);
    for (const key of [
      "titleJa",
      "titleEn",
      "bodyJa",
      "bodyEn",
      "startsAt",
      "endsAt",
      "rsvpDeadline",
      "location",
      "mapUrl",
      "capacity",
    ] as const)
      fd.append(key, v[key]);
    fd.append("audience", JSON.stringify(audience));
    save.mutate(fd, {
      onSuccess: (r) => {
        setSaved(true);
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
      {options.scope.kind === "COMMITTEE" ? (
        <Notice tone="info">{t("approval.formHint")}</Notice>
      ) : null}

      <FormSection
        icon={(c) => <Type size={16} color={c} aria-hidden />}
        title={t("sections.content")}
        description={t("fields.titleHint")}
      >
        <TextField
          label={t("fields.titleJa")}
          value={v.titleJa}
          onChangeText={(titleJa) => set({ titleJa })}
          maxLength={200}
          error={err("titleJa")}
        />
        <TextField
          label={t("fields.titleEn")}
          value={v.titleEn}
          onChangeText={(titleEn) => set({ titleEn })}
          maxLength={200}
          error={err("titleEn")}
        />
        <TextField
          label={t("fields.bodyJa")}
          value={v.bodyJa}
          onChangeText={(bodyJa) => set({ bodyJa })}
          multiline
          textAlignVertical="top"
          style={styles.body}
          error={err("bodyJa")}
        />
        <TextField
          label={t("fields.bodyEn")}
          value={v.bodyEn}
          onChangeText={(bodyEn) => set({ bodyEn })}
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
        icon={(c) => <CalendarClock size={16} color={c} aria-hidden />}
        title={t("sections.when")}
        description={t("fields.jstHint")}
      >
        <DateTimeField
          label={t("fields.startsAt")}
          required
          value={v.startsAt}
          onChange={(startsAt) => set({ startsAt })}
          error={err("startsAt")}
        />
        <DateTimeField
          label={t("fields.endsAt")}
          value={v.endsAt}
          onChange={(endsAt) => set({ endsAt })}
          error={err("endsAt")}
        />
      </FormSection>

      <FormSection
        icon={(c) => <MapPin size={16} color={c} aria-hidden />}
        title={t("sections.where")}
      >
        <TextField
          label={t("fields.location")}
          value={v.location}
          onChangeText={(location) => set({ location })}
          maxLength={300}
          error={err("location")}
        />
        <TextField
          label={t("fields.mapUrl")}
          hint={t("fields.mapUrlHint")}
          value={v.mapUrl}
          onChangeText={(mapUrl) => set({ mapUrl })}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          error={err("mapUrl")}
        />
      </FormSection>

      <FormSection
        icon={(c) => <Users size={16} color={c} aria-hidden />}
        title={t("sections.rsvp")}
      >
        <TextField
          label={t("fields.capacity")}
          hint={t("fields.capacityHint")}
          value={v.capacity}
          onChangeText={(capacity) => set({ capacity })}
          keyboardType="number-pad"
          inputMode="numeric"
          error={err("capacity")}
        />
        <DateTimeField
          label={t("fields.rsvpDeadline")}
          hint={t("fields.rsvpDeadlineHint")}
          value={v.rsvpDeadline}
          onChange={(rsvpDeadline) => set({ rsvpDeadline })}
          error={err("rsvpDeadline")}
        />
        <AudiencePicker
          options={options}
          initialSpec={values.audience}
          initialMembers={values.audienceMembers}
          onChange={setAudience}
          error={err("audience")}
        />
      </FormSection>

      <Button
        label={
          save.isPending
            ? tc("saving")
            : options.scope.kind === "COMMITTEE"
              ? t("approval.submit")
              : values.id
                ? tc("save")
                : t("events.create")
        }
        loading={save.isPending}
        onPress={submit}
      />
      {extraActions}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  body: { minHeight: 160, paddingTop: space.sm },
});
