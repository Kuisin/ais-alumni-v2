import type { OrgSearch } from "@contract/profile";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, radius, space, Text, TextField, TOUCH } from "@/ui";
import { profileApi } from "./api";

type Option = OrgSearch["options"][number];

/** The website's orgNameKey: the same organization written differently. */
function orgNameKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[\s.,・･'’"“”()（）\-‐―—_/]/g, "");
}

/**
 * School / company search-as-you-type (the website's OrgCombobox): pick an
 * existing one (its id is sent), or keep the typed name and the server
 * creates it once.
 */
export function OrgPicker({
  kind,
  label,
  name,
  id,
  onChange,
  error,
}: {
  kind: "school" | "company";
  label: string;
  name: string;
  id: string;
  onChange: (value: { name: string; id: string }) => void;
  error?: string | null;
}) {
  const t = useTranslations("history");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const seq = useRef(0);

  // Debounced search while typing (stale answers are ignored).
  useEffect(() => {
    if (!open) return;
    const q = name.trim();
    if (!q) {
      setOptions([]);
      return;
    }
    const n = ++seq.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await profileApi.searchOrgs(kind, q, controller.signal);
        if (n === seq.current) setOptions(found.options);
      } catch {
        // Suggestions are optional; the typed name still works.
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [name, kind, open]);

  const typedKey = orgNameKey(name);
  const exact = options.some((o) => orgNameKey(o.name) === typedKey);
  const showNew = name.trim() !== "" && !exact;
  const hint = id
    ? t("orgPicked")
    : name.trim()
      ? t("orgWillAdd")
      : t(`orgHint.${kind}`);

  return (
    <View style={styles.wrap}>
      <TextField
        label={`${label} *`}
        value={name}
        onChangeText={(v) => {
          onChange({ name: v, id: "" });
          setOpen(true);
        }}
        onFocus={() => name && setOpen(true)}
        maxLength={120}
        autoCorrect={false}
        error={error}
        hint={hint}
      />
      {open && (options.length || showNew) ? (
        <View style={styles.list} accessibilityRole="list">
          {options.map((o, i) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              onPress={() => {
                onChange({ name: o.name, id: o.id });
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                i > 0 ? styles.border : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.name}>{o.name}</Text>
              <Text variant="caption" tone="subtle">
                {t("orgMembers", { count: o.count })}
              </Text>
            </Pressable>
          ))}
          {showNew ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onChange({ name, id: "" });
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                options.length ? styles.border : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text tone="brand" weight="medium" style={styles.name}>
                {t("orgAddNew", { name: name.trim() })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  option: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  border: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: { backgroundColor: colors.slate100 },
  name: { flex: 1 },
});
