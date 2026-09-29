import { Platform } from "react-native";

/**
 * Design tokens, matching the website (Tailwind slate + the brand blues in
 * src/app/globals.css) so both feel like one product.
 */
export const colors = {
  brand50: "#eff4ff",
  brand100: "#dbe6fe",
  brand200: "#bfd0fd",
  brand300: "#93b0f8",
  brand600: "#1e40af",
  brand700: "#1e3a8a",
  brand800: "#172e6e",
  brand900: "#0f1f4d",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  amber50: "#fffbeb",
  amber100: "#fef3c7",
  amber400: "#fbbf24",
  amber800: "#92400e",
  amber900: "#78350f",
  red50: "#fef2f2",
  red100: "#fee2e2",
  red600: "#dc2626",
  red700: "#b91c1c",
  green50: "#f0fdf4",
  green100: "#dcfce7",
  green600: "#16a34a",
  green700: "#15803d",
  line: "#06c755",
  white: "#ffffff",
  /** page background (slate-50) */
  background: "#f8fafc",
  /** cards, headers, tab bar */
  surface: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#475569",
  textSubtle: "#64748b",
  accent: "#1e3a8a",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

export const font = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
} as const;

/** Minimum touch target (as the website's min-h-11). */
export const TOUCH = 44;
