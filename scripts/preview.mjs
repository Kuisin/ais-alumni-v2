#!/usr/bin/env node
/**
 * Local testing only: screenshot app screens from the web build, phone-sized,
 * signed in as a member of the LOCAL database.
 *
 *   node scripts/preview.mjs --path /news --out /tmp/news.png \
 *     [--email hanako@example.com | --token aism_… | --signed-out] \
 *     [--click "text=送信"]… [--fill "placeholder=value"]… [--wait 1500] [--full]
 *
 * Needs the website (`next dev`, e.g. on :3187) and the app's web build
 * (`EXPO_PUBLIC_API_URL=http://localhost:3187 npx expo start --web --port 8087`).
 * Chromium runs with web security off because the two are on different
 * ports (the native app isn't subject to CORS). Uses playwright-core's
 * Chromium and the API server's scripts/mobile-dev-token.ts (SERVER_DIR, a
 * checkout of ais-alumni-app; default ../ais-alumni-app).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SERVER = path.resolve(
  process.env.SERVER_DIR ?? path.join(root, "../ais-alumni-app"),
);
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright-core");

const WEB = process.env.EXPO_WEB_URL ?? "http://localhost:8087";
const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3187";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const many = (name) =>
  args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const flag = (name) => args.includes(`--${name}`);

const target = opt("path", "/");
const out = opt("out", "/tmp/ais-preview.png");
const email = opt("email", "hanako@example.com");
const cacheFile = "/tmp/ais-preview-tokens.json";

async function valid(token) {
  const res = await fetch(`${API}/api/mobile/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  return res?.ok ?? false;
}

async function tokenFor(address) {
  const cache = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, "utf8"))
    : {};
  if (cache[address] && (await valid(cache[address]))) return cache[address];
  const token = execFileSync(
    "pnpm",
    ["exec", "tsx", "--env-file=.env", "scripts/mobile-dev-token.ts", address],
    { cwd: SERVER, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .pop();
  cache[address] = token;
  writeFileSync(cacheFile, JSON.stringify(cache));
  return token;
}

const token = flag("signed-out")
  ? null
  : (opt("token") ?? (await tokenFor(email)));

const browser = await chromium.launch({
  args: ["--disable-web-security", "--disable-site-isolation-trials"],
});
const context = await browser.newContext({
  viewport: {
    width: Number(opt("width", 390)),
    height: Number(opt("height", 844)),
  },
  deviceScaleFactor: 2,
  hasTouch: true,
  locale: opt("locale", "ja-JP"),
});
const page = await context.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    console.log(`[console.${m.type()}] ${m.text().slice(0, 500)}`);
});
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
await page.addInitScript((t) => {
  if (t) localStorage.setItem("ais.session", t);
  else localStorage.removeItem("ais.session");
}, token);

await page.goto(`${WEB}${target}`, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(opt("wait", 1200)));
for (const step of many("fill")) {
  const [sel, ...rest] = step.split("=>");
  await page.locator(sel.trim()).first().fill(rest.join("=>").trim());
}
for (const sel of many("click")) {
  await page.locator(sel).first().click();
  await page.waitForTimeout(Number(opt("wait", 1200)));
}
await page.screenshot({ path: out, fullPage: flag("full") });
console.log(`url: ${page.url()}\nsaved: ${out}`);
await browser.close();
