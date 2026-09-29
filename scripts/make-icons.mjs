#!/usr/bin/env node
/**
 * The AIS Alumni Committee logo — lucide's `graduation-cap` (ISC licence,
 * lucide v1.48.0, the icon the website's header already uses) in white on
 * the brand blue, with the tassel in the brand amber — and every image made
 * from it: the app icon, Android adaptive / monochrome icons and splash, the
 * notification icon, and the web build's PWA icons and favicon (public/).
 * Edit LOGO / the colors here, then:
 *
 *   pnpm icons
 *
 * Renders with playwright-core's Chromium (`npx playwright install chromium`
 * once).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright-core");

const BRAND = "#1e3a8a"; // brand-700
const WHITE = "#ffffff";
const AMBER = "#fbbf24"; // amber-400

/** lucide graduation-cap, 24×24 grid, stroke 2, round caps and joins */
const LOGO = [
  {
    d: "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",
    role: "cap",
  },
  { d: "M6 12.5V16a6 3 0 0 0 12 0v-3.5", role: "cap" },
  { d: "M22 10v6", role: "tassel" },
];
// Visual centre of the drawing incl. strokes (the tassel sits right).
const CENTER = { x: 12.3, y: 12.1 };

/**
 * The logo as SVG. `glyph`: share of the canvas the 24-unit grid spans;
 * `bg`: background (null = transparent); `radius`: corner radius as a share
 * of the size (0 = square, for icons the OS masks itself).
 */
export function logoSvg({
  size,
  glyph = 0.72,
  bg = BRAND,
  radius = 0,
  cap = WHITE,
  tassel = AMBER,
}) {
  const s = (size * glyph) / 24;
  const tx = size / 2 - CENTER.x * s;
  const ty = size / 2 - CENTER.y * s;
  const paths = LOGO.map(
    (p) => `<path d="${p.d}" stroke="${p.role === "tassel" ? tassel : cap}"/>`,
  ).join("");
  const rect = bg
    ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${bg}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rect}<g transform="translate(${tx} ${ty}) scale(${s})" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

/** Multi-size .ico with PNG entries (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const TARGETS = [
  // App (assets/images). iOS masks the corners itself.
  { file: "assets/images/icon.png", size: 1024, opaque: true },
  // Android adaptive icon: glyph inside the 66 % safe zone, background from app.config.ts.
  {
    file: "assets/images/adaptive-icon.png",
    size: 1024,
    glyph: 0.58,
    bg: null,
  },
  {
    file: "assets/images/monochrome-icon.png",
    size: 1024,
    glyph: 0.58,
    bg: null,
    tassel: WHITE,
  },
  // Splash: the mark on transparent, over the brand color (app.config.ts).
  {
    file: "assets/images/splash-icon.png",
    size: 512,
    glyph: 0.98,
    bg: null,
  },
  { file: "assets/images/favicon.png", size: 48, radius: 0.22 },
  // Android notification (status bar) icon: all white on transparent.
  {
    file: "assets/images/notification-icon.png",
    size: 96,
    glyph: 0.9,
    bg: null,
    tassel: WHITE,
  },
  // Web (PWA manifest + apple-touch icon): full-bleed, safe for maskable.
  { file: "public/icons/icon-192.png", size: 192, opaque: true },
  { file: "public/icons/icon-512.png", size: 512, opaque: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
async function render({ size, opaque, ...opts }) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${logoSvg({ size, ...opts })}</body></html>`,
  );
  return page.locator("svg").screenshot({ omitBackground: !opaque });
}

mkdirSync(path.join(root, "public/icons"), { recursive: true });
for (const t of TARGETS) {
  writeFileSync(path.join(root, t.file), await render(t));
  console.log(`wrote ${t.file}`);
}
const favicon = [];
for (const size of [16, 32, 48])
  favicon.push({ size, data: await render({ size, radius: 0.22 }) });
writeFileSync(path.join(root, "public/favicon.ico"), ico(favicon));
console.log("wrote public/favicon.ico");
writeFileSync(
  path.join(root, "assets/logo.svg"),
  `${logoSvg({ size: 1024, radius: 0.22 })}\n`,
);
console.log("wrote assets/logo.svg");
await browser.close();
