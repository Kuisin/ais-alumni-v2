#!/usr/bin/env node
/**
 * App notifications from a local website, delivered to the iOS Simulator.
 *
 * With EXPO_PUSH_OUTBOX=1 the website writes every push to
 * .data/dev-push/<token>.jsonl instead of sending it to Expo, and accepts
 * made-up "development" tokens (ExponentPushToken[dev-…]) — which a
 * development build without an EAS project registers (src/lib/push.tsx).
 * This script follows those files and hands each new message to the
 * Simulator with `xcrun simctl push`, shaped the way Expo's push service
 * shapes it for APNs (data under "body"), so taps, quick actions, badges
 * and grouping behave as they would on a phone.
 *
 *   node scripts/sim-push.mjs [--udid <UDID>] [--bundle <id>] [--all]
 *
 * --udid defaults to $UDID, else the booted simulator; --bundle to the
 * app's bundle identifier (app.config.ts); --all also delivers what is
 * already in the files (default: only messages written from now on).
 * The outbox is the API server's (SERVER_DIR, a checkout of ais-alumni-app;
 * default ../ais-alumni-app).
 * Needs a development build on the Simulator (`npx expo run:ios`): Expo Go
 * can't receive notifications.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(
  process.env.SERVER_DIR ?? path.join(here, "../../ais-alumni-app"),
);
const OUTBOX = path.join(SERVER, ".data", "dev-push");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const udid = flag("udid") ?? process.env.UDID ?? "booted";
const all = args.includes("--all");

function bundleId() {
  const given = flag("bundle") ?? process.env.BUNDLE;
  if (given) return given;
  const config = readFileSync(path.join(here, "..", "app.config.ts"), "utf8");
  const m = /const IDENTIFIER = "([^"]+)"/.exec(config);
  if (!m) throw new Error("No IDENTIFIER in app.config.ts; pass --bundle");
  return m[1];
}
const bundle = bundleId();

/** An Expo push message (src/lib/push/expo.ts) as APNs gets it from Expo. */
function apnsPayload(m) {
  const aps = {
    alert: {
      ...(m.title ? { title: m.title } : {}),
      ...(m.subtitle ? { subtitle: m.subtitle } : {}),
      body: m.body ?? "",
    },
    ...(m.sound ? { sound: m.sound } : {}),
    ...(typeof m.badge === "number" ? { badge: m.badge } : {}),
    ...(m.threadId ? { "thread-id": m.threadId } : {}),
    ...(m.categoryId ? { category: m.categoryId } : {}),
  };
  return {
    aps,
    body: m.data ?? {},
    experienceId: "@local/ais-alumni",
    scopeKey: "@local/ais-alumni",
  };
}

const dir = mkdtempSync(path.join(tmpdir(), "ais-sim-push-"));
let n = 0;
function deliver(m) {
  const file = path.join(dir, `${++n}.apns`);
  writeFileSync(file, JSON.stringify(apnsPayload(m)));
  try {
    execFileSync("xcrun", ["simctl", "push", udid, bundle, file], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    console.log(`→ ${m.title ?? ""} — ${m.body ?? ""}`);
  } catch (e) {
    console.error(`✗ simctl push failed: ${e.stderr?.toString().trim() ?? e}`);
  }
}

/** Bytes already handled, per outbox file. */
const offsets = new Map();
function poll(first) {
  if (!existsSync(OUTBOX)) return;
  for (const name of readdirSync(OUTBOX)) {
    if (!name.startsWith("ExponentPushToken_dev-") || !name.endsWith(".jsonl"))
      continue;
    const file = path.join(OUTBOX, name);
    const size = statSync(file).size;
    const from = offsets.get(file) ?? (first && !all ? size : 0);
    offsets.set(file, size);
    if (size <= from) continue;
    const text = readFileSync(file).subarray(from, size).toString("utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        deliver(JSON.parse(line));
      } catch {
        console.error(`✗ unreadable line in ${name}`);
      }
    }
  }
}

console.log(
  `Delivering ${path.relative(process.cwd(), OUTBOX) || OUTBOX} to ${udid} (${bundle}). Ctrl-C to stop.`,
);
poll(true);
setInterval(() => poll(false), 500);
