import type { Locale } from "@contract/core";
import { ChevronLeft, Search } from "lucide-react-native";
import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { colors, font, radius, space, Text, TOUCH } from "@/ui";
import data from "./emoji-data.json";

/**
 * A searchable emoji grid for reactions — any emoji, by category, with
 * English and Japanese names (emoji-data.json, made by
 * scripts/emoji-data.mjs from emojibase). Plain React Native: nothing
 * native, so it works in Expo Go and on the web.
 */

type Emoji = { emoji: string; en: string; ja: string; search: string };
type GroupKey =
  | "smileys"
  | "people"
  | "animals"
  | "food"
  | "travel"
  | "activities"
  | "objects"
  | "symbols"
  | "flags";
type Group = { key: GroupKey; items: Emoji[] };

let parsed: Group[] | null = null;

/** The bundled list, parsed on first use. */
function groups(): Group[] {
  if (parsed) return parsed;
  parsed = (data.groups as { key: GroupKey; items: string }[]).map((g) => ({
    key: g.key,
    items: g.items.split("\n").map((line) => {
      const [emoji = "", en = "", ja = "", words = ""] = line.split("\t");
      return {
        emoji,
        en,
        ja,
        search: `${en} ${ja} ${words}`.toLowerCase(),
      };
    }),
  }));
  return parsed;
}

const CELL = TOUCH;
const MAX_RESULTS = 400;

export function EmojiPicker({
  onPick,
  onBack,
}: {
  onPick: (emoji: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations("chat.reactions");
  const locale = useLocale() as Locale;
  const { width, height } = useWindowDimensions();
  const all = useMemo(groups, []);
  const [group, setGroup] = useState<GroupKey>("smileys");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!q) return all.find((g) => g.key === group)?.items ?? [];
    const out: Emoji[] = [];
    for (const g of all)
      for (const e of g.items) {
        if (e.search.includes(q) || e.emoji === q) out.push(e);
        if (out.length >= MAX_RESULTS) return out;
      }
    return out;
  }, [all, group, q]);

  // The sheet spans the screen (less its and the grid's padding).
  const columns = Math.max(
    6,
    Math.floor((width - space.sm * 2 - space.xs * 2) / CELL),
  );
  const renderItem = useCallback(
    ({ item }: { item: Emoji }) => (
      <EmojiCell
        item={item}
        label={locale === "ja" ? item.ja : item.en}
        onPick={onPick}
      />
    ),
    [locale, onPick],
  );

  return (
    <View style={{ height: Math.round(height * 0.6) }}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={onBack}
          style={({ pressed }) => [
            styles.iconButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <ChevronLeft size={22} color={colors.slate700} />
        </Pressable>
        <View style={styles.search}>
          <Search size={16} color={colors.slate400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search")}
            placeholderTextColor={colors.slate400}
            accessibilityLabel={t("search")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={styles.input}
          />
        </View>
      </View>

      {!q ? (
        <ScrollView
          // A horizontal ScrollView grows to fill the column otherwise.
          style={styles.tabRow}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.tabs}
          accessibilityRole="tablist"
        >
          {all.map((g) => {
            const on = g.key === group;
            return (
              <Pressable
                key={g.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`groups.${g.key}`)}
                onPress={() => setGroup(g.key)}
                style={({ pressed }) => [
                  styles.tab,
                  on ? styles.tabOn : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.tabEmoji}>{g.items[0]?.emoji}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <Text
        variant="caption"
        weight="semibold"
        tone="subtle"
        style={styles.heading}
        accessibilityRole="header"
      >
        {q ? t("search") : t(`groups.${group}`)}
      </Text>

      <FlatList
        key={`cols-${columns}`}
        data={shown}
        numColumns={columns}
        keyExtractor={(e) => e.emoji}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: CELL,
          offset: CELL * Math.floor(index / columns),
          index,
        })}
        initialNumToRender={columns * 8}
        maxToRenderPerBatch={columns * 6}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <Text variant="small" tone="muted" center style={styles.empty}>
            {t("noResults")}
          </Text>
        }
        style={styles.flex}
      />
    </View>
  );
}

const EmojiCell = memo(function EmojiCell({
  item,
  label,
  onPick,
}: {
  item: Emoji;
  label: string;
  onPick: (emoji: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPick(item.emoji)}
      style={({ pressed }) => [styles.cell, pressed ? styles.pressed : null]}
    >
      <Text style={styles.cellEmoji} allowFontScaling={false}>
        {item.emoji}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.xs,
    paddingBottom: space.sm,
  },
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flex: 1,
    minHeight: TOUCH - 4,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.slate100,
  },
  input: {
    flex: 1,
    minHeight: TOUCH - 4,
    fontSize: font.size.md,
    color: colors.text,
  },
  tabRow: { flexGrow: 0 },
  tabs: { gap: 2, paddingHorizontal: space.xs },
  tab: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.brand50 },
  tabEmoji: { fontSize: 22, lineHeight: 28 },
  heading: { paddingHorizontal: space.md, paddingVertical: space.xs },
  grid: { paddingHorizontal: space.xs, paddingBottom: space.sm },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cellEmoji: { fontSize: 28, lineHeight: 34 },
  empty: { paddingVertical: space.xl },
  pressed: { backgroundColor: colors.slate200 },
});
