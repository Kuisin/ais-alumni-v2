import type { MySettings } from "@contract/account";
import type { Locale } from "@contract/core";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Fragment, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { LineOutcomeNotice } from "@/features/line/outcome-notice";
import { useLineLinkReturn, useLinkLine } from "@/features/line/use-link-line";
import { isApiError } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ListGroup,
  Section,
  Separator,
  space,
  Text,
} from "@/ui";
import { SETTINGS_KEY, useSaveLanguage, useSaveNotify } from "./api";
import { Notice } from "./parts";
import { ChoiceRow, ToggleRow } from "./rows";

/**
 * 設定 (the website's /app/settings): language, notifications and LINE.
 * The account sections are in ./account-sections.tsx.
 */

/** A failed save, in the member's language. */
export function ErrorLine({ error }: { error: unknown }) {
  const t = useTranslations("mobile.errors");
  return (
    <Text variant="small" tone="danger" accessibilityRole="alert">
      {isApiError(error, "network") ? t("network") : t("generic")}
    </Text>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <Text variant="small" tone="muted">
      {children}
    </Text>
  );
}

export function LanguageSection({ settings }: { settings: MySettings }) {
  const t = useTranslations("settings.language");
  const tb = useTranslations("settings.banner");
  const save = useSaveLanguage();
  const [saved, setSaved] = useState(false);
  const shown = save.isPending ? save.variables : settings.locale;

  const choose = (locale: Locale) => {
    if (save.isPending || locale === settings.locale) return;
    setSaved(false);
    save.mutate(locale, { onSuccess: () => setSaved(true) });
  };

  return (
    <Section title={t("title")}>
      <Hint>{t("description")}</Hint>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("label")}>
        <ListGroup>
          {(["ja", "en"] as const).map((l, i) => (
            <Fragment key={l}>
              {i ? <Separator /> : null}
              <ChoiceRow
                title={t(l)}
                selected={shown === l}
                busy={save.isPending && save.variables === l}
                disabled={save.isPending}
                onPress={() => choose(l)}
              />
            </Fragment>
          ))}
        </ListGroup>
      </View>
      {saved ? (
        <Text
          variant="small"
          tone="success"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {tb("languageSaved")}
        </Text>
      ) : null}
      {save.isError ? <ErrorLine error={save.error} /> : null}
    </Section>
  );
}

export function NotifySection({ settings }: { settings: MySettings }) {
  const t = useTranslations("settings.notifications");
  const tn = useTranslations("notifications");
  const queryClient = useQueryClient();
  const save = useSaveNotify();
  const { notify } = settings;

  const setVia = (via: MySettings["notify"]["via"]) => {
    if (via !== notify.via) save.mutate({ via });
  };
  // Send every category to receive, from the latest (optimistic) state.
  const toggle = (key: string, on: boolean) => {
    const latest =
      queryClient.getQueryData<MySettings>(SETTINGS_KEY)?.notify.categories ??
      notify.categories;
    save.mutate({
      on: latest
        .filter((c) => !c.locked && (c.key === key ? on : c.on))
        .map((c) => c.key),
    });
  };

  const options = [
    { value: "AUTO", label: t("auto"), hint: t("autoHint") },
    { value: "EMAIL_ONLY", label: t("emailOnly"), hint: t("emailOnlyHint") },
  ] as const;

  return (
    <Section title={t("title")}>
      <Hint>{t("description")}</Hint>
      <Text variant="small" weight="medium">
        {t("current", { channel: t(`channel.${notify.route}`) })}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("title")}>
        <ListGroup>
          {options.map((o, i) => (
            <Fragment key={o.value}>
              {i ? <Separator /> : null}
              <ChoiceRow
                title={o.label}
                hint={o.hint}
                selected={notify.via === o.value}
                onPress={() => setVia(o.value)}
              />
            </Fragment>
          ))}
        </ListGroup>
      </View>
      <Text weight="semibold" style={styles.subTitle}>
        {t("categories")}
      </Text>
      <ListGroup>
        {notify.categories.map((c, i) => (
          <Fragment key={c.key}>
            {i ? <Separator /> : null}
            <ToggleRow
              title={tn(`categories.${c.key}`)}
              hint={tn(`categoryHints.${c.key}`)}
              value={c.on}
              disabled={c.locked}
              onChange={(on) => toggle(c.key, on)}
            />
          </Fragment>
        ))}
      </ListGroup>
      {save.isError ? <ErrorLine error={save.error} /> : null}
      <Hint>{t("rule")}</Hint>
    </Section>
  );
}

export function LineSection({ settings }: { settings: MySettings }) {
  const t = useTranslations("settings");
  const tl = useTranslations("line");
  const { line, notify } = settings;
  const channel = t(`notifications.channel.${notify.route}`);
  const name = line.displayName;
  const link = useLinkLine("/settings");
  const returned = useLineLinkReturn();
  const outcome = link.data ?? returned;

  return (
    <Section title={t("line.title")}>
      <Hint>{t("line.description")}</Hint>
      <Card style={styles.card}>
        {outcome !== "linked" || line.linked ? (
          <LineOutcomeNotice outcome={outcome} />
        ) : null}
        <View style={styles.badges} accessibilityLabel={t("line.status")}>
          <Badge
            tone={line.linked ? "green" : "slate"}
            label={line.linked ? `${t("line.linked")} ✓` : t("line.notLinked")}
          />
          {line.linked ? (
            <Badge
              tone={line.following ? "green" : "amber"}
              label={
                line.following
                  ? `${t("line.following")} ✓`
                  : t("line.notFollowing")
              }
            />
          ) : null}
          <Badge tone="brand" label={t("line.notificationsVia", { channel })} />
        </View>
        {line.linked && line.following && notify.via === "EMAIL_ONLY" ? (
          <Hint>{t("line.emailOnlyNote")}</Hint>
        ) : null}
        {!line.linked ? <Hint>{t("line.linkPrompt")}</Hint> : null}

        {line.linked && line.following ? (
          <Text variant="small">
            {name
              ? tl("panel.linkedFollowingAs", { name })
              : tl("panel.linkedFollowing")}
          </Text>
        ) : line.linked ? (
          <>
            <Text variant="small">
              {name
                ? tl("panel.linkedNotFollowingAs", { name })
                : tl("panel.linkedNotFollowing")}
            </Text>
            {line.addFriendUrl ? (
              <Button
                variant="line"
                label={tl("addFriend")}
                onPress={() =>
                  void Linking.openURL(line.addFriendUrl as string).catch(
                    () => {},
                  )
                }
              />
            ) : null}
          </>
        ) : line.linkReady ? (
          <Button
            variant="line"
            label={tl("linkButton")}
            loading={link.isPending}
            onPress={() => link.mutate()}
          />
        ) : (
          <Notice>{tl("panel.notReady")}</Notice>
        )}
        {link.isError ? <ErrorLine error={link.error} /> : null}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  subTitle: { marginTop: space.sm },
  gapXs: { gap: space.xs },
  check: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
});
