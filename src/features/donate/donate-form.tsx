import type { AppConfig } from "@contract/core";
import type {
  DonationCheckout,
  DonationCheckoutRequest,
  DonationInterval,
} from "@contract/donations";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { SegmentedTabs } from "@/features/events/parts";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Button,
  Card,
  colors,
  radius,
  space,
  Text,
  TextField,
  TOUCH,
} from "@/ui";

const MIN = 500;
const MAX = 1_000_000;
const PRESETS = ["1000", "3000", "5000", "10000"] as const;
type Preset = (typeof PRESETS)[number] | "other";

export function yen(amount: number, locale: "ja" | "en"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}

/**
 * The donation form on the website's /donate: once or monthly, a preset or
 * custom amount, then Stripe Checkout (POST /donate/checkout → its URL).
 * Web only — in the iOS / Android app, donations happen in the browser
 * (App Store guideline 3.2.2), see app/donate.tsx.
 */
export function DonateForm({
  donations,
}: {
  donations: NonNullable<AppConfig["donations"]>;
}) {
  const t = useTranslations("mobile.donate");
  const { locale, status } = useAuth();
  const [interval, setInterval] = useState<DonationInterval>("once");
  const [preset, setPreset] = useState<Preset>("3000");
  const [custom, setCustom] = useState("");
  const amount = Number(
    preset === "other" ? custom.replace(/[^\d]/g, "") : preset,
  );
  const valid = Number.isInteger(amount) && amount >= MIN && amount <= MAX;

  const checkout = useMutation({
    mutationFn: () =>
      api<DonationCheckout>("/donate/checkout", {
        body: { amount, interval, locale } satisfies DonationCheckoutRequest,
      }),
    onSuccess: ({ url }) => {
      globalThis.location?.assign(url);
    },
  });

  return (
    <Card style={styles.card}>
      <View style={styles.group}>
        <Text weight="semibold">{t("interval.label")}</Text>
        <SegmentedTabs
          label={t("interval.label")}
          value={interval}
          onChange={setInterval}
          items={[
            { key: "once", label: t("interval.once") },
            { key: "month", label: t("interval.month") },
          ]}
        />
      </View>
      <View style={styles.group}>
        <Text weight="semibold">{t("amount.label")}</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t("amount.label")}
          style={styles.amounts}
        >
          {[...PRESETS, "other" as const].map((p) => {
            const selected = p === preset;
            return (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPreset(p)}
                style={({ pressed }) => [
                  styles.amount,
                  selected ? styles.amountOn : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text weight="semibold" tone={selected ? "brand" : undefined}>
                  {p === "other" ? t("amount.other") : yen(Number(p), locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {preset === "other" ? (
          <TextField
            label={t("amount.custom")}
            value={custom}
            onChangeText={setCustom}
            keyboardType="number-pad"
            inputMode="numeric"
            error={
              custom && !valid
                ? t("amount.range", {
                    min: MIN.toLocaleString(),
                    max: MAX.toLocaleString(),
                  })
                : undefined
            }
          />
        ) : null}
      </View>
      {status === "signedIn" ? (
        <Text variant="small" tone="muted">
          {t("member")}
        </Text>
      ) : null}
      {checkout.isError ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {t("failed")}
        </Text>
      ) : null}
      <Button
        label={
          checkout.isPending || checkout.isSuccess
            ? t("working")
            : !valid
              ? t("submitAny")
              : t(interval === "month" ? "submitMonthly" : "submit", {
                  amount: yen(amount, locale),
                })
        }
        loading={checkout.isPending || checkout.isSuccess}
        disabled={!valid}
        onPress={() => checkout.mutate()}
      />
      {donations.portalUrl ? (
        <Button
          variant="ghost"
          compact
          label={t("manage")}
          onPress={() =>
            void Linking.openURL(donations.portalUrl as string).catch(() => {})
          }
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  group: { gap: space.sm },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  amount: {
    minHeight: TOUCH,
    minWidth: 96,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  amountOn: { borderColor: colors.brand700, backgroundColor: colors.brand50 },
  pressed: { opacity: 0.7 },
});
