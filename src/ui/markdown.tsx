import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Fragment } from "react";
import { StyleSheet, View } from "react-native";
import { hrefFor, siteUrl } from "@/lib/links";
import { type Inline, parseBlocks, parseInline } from "@/lib/markdown";
import { Text } from "./text";
import { colors, font, space } from "./theme";

/**
 * Admin-authored news / event bodies, with the same small Markdown subset
 * as the website: paragraphs (single newlines kept), # headings, - / 1.
 * lists, **bold**, *italic*, `code`, [text](url) and bare URLs (http(s) and
 * mailto only). Text only — nothing is ever run as HTML. Parsing is in
 * src/lib/markdown.ts.
 */

/** Open a link from content: app screens natively, the rest in the browser. */
export function useOpenLink(): (url: string) => void {
  const router = useRouter();
  return (url: string) => {
    if (/^mailto:/i.test(url)) {
      void Linking.openURL(url).catch(() => {});
      return;
    }
    if (siteUrl(url)) {
      // A page of the site: its app screen, if the app has one yet.
      const href = hrefFor(url);
      if (href) router.push(href);
      return;
    }
    void WebBrowser.openBrowserAsync(url);
  };
}

function Runs({ runs, open }: { runs: Inline[]; open: (u: string) => void }) {
  return runs.map((r, i) => (
    <Text
      // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional
      key={i}
      style={[
        r.bold ? styles.bold : null,
        r.italic ? styles.italic : null,
        r.code ? styles.code : null,
        r.href ? styles.link : null,
      ]}
      onPress={r.href ? () => open(r.href as string) : undefined}
      accessibilityRole={r.href ? "link" : undefined}
    >
      {r.text}
    </Text>
  ));
}

export function Markdown({ source }: { source: string | null | undefined }) {
  const open = useOpenLink();
  if (!source?.trim()) return null;
  const blocks = parseBlocks(source);
  return (
    <View style={styles.body}>
      {blocks.map((b, i) => {
        const key = `${b.kind}${i}`;
        if (b.kind === "h")
          return (
            <Text
              key={key}
              variant={
                b.level <= 1 ? "heading" : b.level === 2 ? "subheading" : "body"
              }
              weight="bold"
              accessibilityRole="header"
              selectable
            >
              <Runs runs={parseInline(b.text)} open={open} />
            </Text>
          );
        if (b.kind === "p")
          return (
            <Text key={key} selectable style={styles.p}>
              {b.lines.map((line, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
                <Fragment key={j}>
                  {j > 0 ? "\n" : null}
                  <Runs runs={parseInline(line)} open={open} />
                </Fragment>
              ))}
            </Text>
          );
        return (
          <View key={key} style={styles.list}>
            {b.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: items are positional
              <View key={j} style={styles.item}>
                <Text style={styles.marker}>
                  {b.kind === "ul" ? "•" : `${j + 1}.`}
                </Text>
                <Text selectable style={styles.itemText}>
                  <Runs runs={parseInline(item)} open={open} />
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  p: { color: colors.slate800, lineHeight: 26 },
  bold: { fontWeight: font.weight.bold },
  italic: { fontStyle: "italic" },
  code: {
    fontFamily: font.mono,
    backgroundColor: colors.slate100,
    fontSize: font.size.sm,
  },
  link: { color: colors.brand700, textDecorationLine: "underline" },
  list: { gap: space.xs },
  item: { flexDirection: "row", gap: space.sm, paddingLeft: space.xs },
  marker: { color: colors.slate600, minWidth: 18 },
  itemText: { flex: 1, color: colors.slate800, lineHeight: 24 },
});
