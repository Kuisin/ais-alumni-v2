import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { colors, font } from "./theme";

type Variant =
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "small"
  | "caption";
type Tone =
  | "default"
  | "muted"
  | "subtle"
  | "brand"
  | "danger"
  | "success"
  | "inverse";

const VARIANT: Record<Variant, TextStyle> = {
  title: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    lineHeight: 34,
  },
  heading: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    lineHeight: 28,
  },
  subheading: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    lineHeight: 24,
  },
  body: { fontSize: font.size.md, lineHeight: 24 },
  small: { fontSize: font.size.sm, lineHeight: 20 },
  caption: { fontSize: font.size.xs, lineHeight: 16 },
};

const TONE: Record<Tone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  subtle: colors.textSubtle,
  brand: colors.brand700,
  danger: colors.red700,
  success: colors.green700,
  inverse: colors.white,
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  weight?: keyof typeof font.weight;
  center?: boolean;
};

/** Text in the app's type scale (always use this instead of RN's Text). */
export function Text({
  variant = "body",
  tone = "default",
  weight,
  center,
  style,
  ...props
}: AppTextProps) {
  return (
    <RNText
      {...props}
      style={[
        VARIANT[variant],
        { color: TONE[tone] },
        weight ? { fontWeight: font.weight[weight] } : null,
        center ? { textAlign: "center" } : null,
        style,
      ]}
    />
  );
}
