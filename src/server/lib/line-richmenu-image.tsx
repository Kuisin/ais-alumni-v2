import type { Locale } from "@/server/generated/prisma/enums";
import { getTranslatorFor } from "@/server/i18n/translator";
import { loadNotoSansJp } from "@/server/lib/og/font";
import { OG_ICONS, type OgIconName } from "@/server/lib/og/icons";
import { imageResponse } from "@/server/lib/og/image-response";
import {
  NO_BADGES,
  RICH_MENU_ITEMS,
  RICH_MENU_REPLIES,
  RICH_MENU_SIZE,
  type RichMenuBadges,
  type RichMenuKey,
  replyBounds,
  tileBounds,
} from "./line-richmenu";

const BRAND = "#1e3a8a";
const BRAND_50 = "#eff4ff";
const DOT = "#ef4444";

/** Buttons and tiles that get the red dot, by what is unread. */
const DOTTED: Record<keyof RichMenuBadges, RichMenuKey[]> = {
  chats: ["chats", "chat"],
  news: ["newsList", "news"],
};

function dotted(key: RichMenuKey, badges: RichMenuBadges): boolean {
  return (Object.keys(DOTTED) as (keyof RichMenuBadges)[]).some(
    (k) => badges[k] && DOTTED[k].includes(key),
  );
}

/** The unread dot, on the icon's top-right corner (ring = background). */
function Dot({ size, ring }: { size: number; ring: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        background: DOT,
        border: `${Math.round(size / 7)}px solid ${ring}`,
      }}
    />
  );
}

const ICONS: Record<RichMenuKey, OgIconName> = {
  chats: "bell-dot",
  newsList: "list",
  dashboard: "house",
  news: "newspaper",
  events: "calendar-days",
  chat: "messages-square",
  directory: "users",
  settings: "settings",
};

/** A lucide icon as inline SVG (stroke, like the app's icons). */
function Icon({
  name,
  size,
  color = BRAND,
}: {
  name: OgIconName;
  size: number;
  color?: string;
}) {
  return (
    // Drawn into a PNG (the label is next to it), not rendered as HTML.
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {OG_ICONS[name].map(([tag, attrs], i) => {
        const Tag = tag as "path";
        // biome-ignore lint/suspicious/noArrayIndexKey: static icon parts
        return <Tag key={i} {...attrs} />;
      })}
    </svg>
  );
}

/** Menu labels in one language (the app's own nav words). */
export async function richMenuLabels(
  locale: Locale,
): Promise<{ labels: Record<RichMenuKey, string>; chatBar: string }> {
  const t = await getTranslatorFor(locale, "common");
  const tl = await getTranslatorFor(locale, "line");
  const labels = Object.fromEntries([
    ...RICH_MENU_REPLIES.map((i) => [i.key, tl(`richMenu.replies.${i.key}`)]),
    ...RICH_MENU_ITEMS.map((i) => [i.key, t(`nav.${i.key}`)]),
  ]) as Record<RichMenuKey, string>;
  return { labels, chatBar: tl("richMenu.chatBar") };
}

/**
 * The 2500×1686 menu image: the two reply buttons across the top (brand
 * blue), then six page tiles (icon + label). `badges` puts a red dot on the
 * chat and news buttons when something is unread.
 */
export async function richMenuImage(
  locale: Locale,
  badges: RichMenuBadges = NO_BADGES,
): Promise<Response> {
  const { labels } = await richMenuLabels(locale);
  const font = await loadNotoSansJp(Object.values(labels).join(""));
  return imageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#ffffff",
        fontFamily: font ? "NotoSansJP" : "sans-serif",
      }}
    >
      {RICH_MENU_REPLIES.map((item, i) => {
        const b = replyBounds(i);
        return (
          <div
            key={item.key}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.width,
              height: b.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 40,
              background: BRAND,
              borderRight: i === 0 ? "4px solid #ffffff" : "none",
            }}
          >
            <div style={{ display: "flex", position: "relative" }}>
              <Icon name={ICONS[item.key]} size={150} color="#ffffff" />
              {dotted(item.key, badges) ? <Dot size={70} ring={BRAND} /> : null}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 96,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {labels[item.key]}
            </div>
          </div>
        );
      })}
      {RICH_MENU_ITEMS.map((item, i) => {
        const b = tileBounds(i);
        return (
          <div
            key={item.key}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.width,
              height: b.height,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              borderRight: i % 3 < 2 ? "4px solid #e2e8f0" : "none",
              borderBottom: i < 3 ? "4px solid #e2e8f0" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                width: 240,
                height: 240,
                borderRadius: 120,
                background: BRAND_50,
              }}
            >
              <Icon name={ICONS[item.key]} size={136} />
              {dotted(item.key, badges) ? (
                <Dot size={84} ring="#ffffff" />
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 84,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {labels[item.key]}
            </div>
          </div>
        );
      })}
    </div>,
    {
      ...RICH_MENU_SIZE,
      fonts: font
        ? [{ name: "NotoSansJP", data: font, weight: 700, style: "normal" }]
        : undefined,
    },
  );
}
