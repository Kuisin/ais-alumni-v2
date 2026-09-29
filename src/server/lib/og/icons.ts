/**
 * Lucide icons (ISC licence, lucide-react v1.48.0) as plain SVG nodes, for
 * images made with next/og (lucide-react components are client-only).
 */
export const OG_ICONS = {
  house: [
    [
      "path",
      {
        d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
      },
    ],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      },
    ],
  ],
  newspaper: [
    [
      "path",
      {
        d: "M15 18h-5",
      },
    ],
    [
      "path",
      {
        d: "M18 14h-8",
      },
    ],
    [
      "path",
      {
        d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2",
      },
    ],
    [
      "rect",
      {
        width: "8",
        height: "4",
        x: "10",
        y: "6",
        rx: "1",
      },
    ],
  ],
  "calendar-days": [
    [
      "path",
      {
        d: "M8 2v3",
      },
    ],
    [
      "path",
      {
        d: "M16 2v3",
      },
    ],
    [
      "rect",
      {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2",
      },
    ],
    [
      "path",
      {
        d: "M3 9h18",
      },
    ],
    [
      "path",
      {
        d: "M8 13h.01",
      },
    ],
    [
      "path",
      {
        d: "M12 13h.01",
      },
    ],
    [
      "path",
      {
        d: "M16 13h.01",
      },
    ],
    [
      "path",
      {
        d: "M8 17h.01",
      },
    ],
    [
      "path",
      {
        d: "M12 17h.01",
      },
    ],
    [
      "path",
      {
        d: "M16 17h.01",
      },
    ],
  ],
  "messages-square": [
    [
      "path",
      {
        d: "M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
      },
    ],
    [
      "path",
      {
        d: "M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1",
      },
    ],
  ],
  users: [
    [
      "path",
      {
        d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
      },
    ],
    [
      "path",
      {
        d: "M16 3.128a4 4 0 0 1 0 7.744",
      },
    ],
    [
      "path",
      {
        d: "M22 21v-2a4 4 0 0 0-3-3.87",
      },
    ],
    [
      "circle",
      {
        cx: "9",
        cy: "7",
        r: "4",
      },
    ],
  ],
  settings: [
    [
      "path",
      {
        d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
      },
    ],
    [
      "circle",
      {
        cx: "12",
        cy: "12",
        r: "3",
      },
    ],
  ],
  "bell-dot": [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
    [
      "path",
      {
        d: "M11.68 2.009A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673c-.824-.85-1.678-1.731-2.21-3.348",
      },
    ],
    ["circle", { cx: "18", cy: "5", r: "3" }],
  ],
  list: [
    ["path", { d: "M3 5h.01" }],
    ["path", { d: "M3 12h.01" }],
    ["path", { d: "M3 19h.01" }],
    ["path", { d: "M8 5h13" }],
    ["path", { d: "M8 12h13" }],
    ["path", { d: "M8 19h13" }],
  ],
} as const satisfies Record<
  string,
  readonly (readonly [string, Record<string, string>])[]
>;

export type OgIconName = keyof typeof OG_ICONS;
