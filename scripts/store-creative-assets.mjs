#!/usr/bin/env node
/**
 * The App Store's product page header (21:9, 3840 × 1646) and search results
 * asset (3:2, 3840 × 2560), per language, from the frameless screenshots in
 * store/ios/screenshots/plain — into store/ios/creative/<locale>/.
 *
 *   node scripts/store-creative-assets.mjs
 *
 * Focal content stays near the centre: the App Store crops the edges
 * differently per device. Uses playwright-core's Chromium.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright-core");

const COPY = {
  ja: {
    name: "AIS同窓会",
    head: "AISの仲間と、\nもう一度つながる",
    sub: "卒業生・保護者・教職員のための同窓会アプリ",
  },
  "en-US": {
    name: "AIS Alumni",
    head: "Stay connected with\nthe AIS community",
    sub: "The alumni app for graduates, parents and teachers",
  },
};
// [file, CSS width × height at 2x]
const ASSETS = {
  header: { w: 1920, h: 823, shots: ["3-directory", "1-home", "5-chat"] },
  "search-results": {
    w: 1920,
    h: 1280,
    shots: ["3-directory", "1-home", "5-chat"],
  },
};

const data = (file, type = "image/png") =>
  `data:${type};base64,${readFileSync(path.join(root, file)).toString("base64")}`;
const icon = data("store/ios/icon-1024.png");

function phone(src, width, style) {
  const r = width * 0.13;
  return `<div style="width:${width}px;border:${width * 0.022}px solid #0a1230;border-radius:${r}px;overflow:hidden;background:#fff;box-shadow:0 30px 70px rgba(0,0,0,.45),0 0 0 1.5px rgba(255,255,255,.16);flex:none;${style}"><img src="${src}" style="width:100%;display:block"/></div>`;
}

function html(locale, kind) {
  const c = COPY[locale];
  const { w, h, shots } = ASSETS[kind];
  const wide = kind === "header";
  const [a, b, d] = shots.map((s) =>
    data(`store/ios/screenshots/plain/${locale}/${s}.png`),
  );
  const pw = wide ? 250 : 290;
  const top = wide ? 120 : 560;
  const phones = [
    phone(a, pw * 0.9, `margin-top:${pw * 0.42}px;opacity:.96`),
    phone(b, pw, ""),
    phone(d, pw * 0.9, `margin-top:${pw * 0.42}px;opacity:.96`),
  ].join("");
  const text = `<div style="display:flex;align-items:center;gap:${wide ? 20 : 24}px">
      <img src="${icon}" style="width:${wide ? 84 : 76}px;border-radius:22%"/>
      <div style="font-size:${wide ? 44 : 42}px;font-weight:700">${c.name}</div></div>
    <div style="font-size:${wide ? 70 : 76}px;font-weight:800;line-height:1.2;white-space:pre-line;margin-top:${wide ? 34 : 30}px;letter-spacing:${locale === "ja" ? "0.01em" : "-0.02em"}">${c.head}</div>
    <div style="font-size:${wide ? 30 : 34}px;font-weight:500;color:#bfd0fd;margin-top:${wide ? 22 : 18}px">${c.sub}</div>`;
  const body = wide
    ? `<div style="position:absolute;left:330px;top:0;height:${h}px;width:720px;display:flex;flex-direction:column;justify-content:center">${text}</div>
    <div style="position:absolute;left:1010px;top:${top}px;display:flex;gap:28px;align-items:flex-start">${phones}</div>`
    : // 3:2: headline above, phones below, all inside the centre.
      `<div style="position:absolute;left:0;right:0;top:110px;display:flex;flex-direction:column;align-items:center;text-align:center">${text}</div>
    <div style="position:absolute;left:0;right:0;top:${top}px;display:flex;gap:34px;justify-content:center;align-items:flex-start">${phones}</div>`;
  return `<html lang="${locale}"><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;position:relative;background:linear-gradient(120deg,#1e40af 0%,#1e3a8a 45%,#0f1f4d 100%);font-family:-apple-system,'Hiragino Sans','Helvetica Neue',sans-serif;color:#fff">${body}</body></html>`;
}

const browser = await chromium.launch();
for (const locale of Object.keys(COPY)) {
  const dir = path.join(root, "store/ios/creative", locale);
  mkdirSync(dir, { recursive: true });
  for (const [kind, { w, h }] of Object.entries(ASSETS)) {
    const page = await (
      await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: 2,
      })
    ).newPage();
    await page.setContent(html(locale, kind));
    await page.waitForTimeout(400);
    // JPEG: no alpha channel (App Store Connect rejects transparency).
    await page.screenshot({
      path: path.join(dir, `${kind}.jpg`),
      type: "jpeg",
      quality: 95,
    });
    await page.close();
  }
}
await browser.close();
