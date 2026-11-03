#!/usr/bin/env node
/**
 * Sends a new iOS version to App Review through the App Store Connect API —
 * the step after `eas build -p ios --profile production --auto-submit` has
 * uploaded the build (docs/APP_STORE.md, "Releasing a new version").
 *
 *   node scripts/app-store-release.mjs            # prepare, show, don't submit
 *   node scripts/app-store-release.mjs --submit   # … and submit for review
 *
 * Options: --version 1.0.1 (default: app.config.ts's), --build 31 (default:
 * the newest build of that version), --wait (wait up to 30 min for Apple to
 * finish processing the build), --manual-release (release by hand after
 * approval; default: as soon as it's approved).
 *
 * It creates the App Store version if there isn't one, attaches the build,
 * sets "What's New" per language from store.config.json (releaseNotes), and
 * with --submit adds the version to a review submission and submits it.
 *
 * The API key (App Store Connect → Users and Access → Integrations → App
 * Store Connect API, role App Manager) comes from the environment, e.g. in
 * .env.local (git-ignored, like the .p8):
 *   ASC_KEY_ID=ABC123DEF4
 *   ASC_ISSUER_ID=69a6de7e-…
 *   ASC_KEY_PATH=/path/to/AuthKey_ABC123DEF4.p8
 */
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.appstoreconnect.apple.com/v1";

// ---- options ----
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*(ASC_[A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
  console.error(
    "Set ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH (e.g. in .env.local).",
  );
  process.exit(1);
}

const eas = JSON.parse(readFileSync(path.join(root, "eas.json"), "utf8"));
const APP_ID = eas.submit.production.ios.ascAppId;
const versionString =
  opt("version") ??
  readFileSync(path.join(root, "app.config.ts"), "utf8").match(
    /\bversion:\s*"([^"]+)"/,
  )?.[1];
const store = JSON.parse(
  readFileSync(path.join(root, "store.config.json"), "utf8"),
);
const notes = Object.fromEntries(
  Object.entries(store.apple.info).map(([locale, info]) => [
    locale,
    info.releaseNotes,
  ]),
);

// ---- the API ----
function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" })}.${b64({
    iss: ASC_ISSUER_ID,
    iat: now,
    exp: now + 15 * 60,
    aud: "appstoreconnect-v1",
  })}`;
  const sig = createSign("SHA256")
    .update(body)
    .sign(
      { key: readFileSync(ASC_KEY_PATH), dsaEncoding: "ieee-p1363" },
      "base64url",
    );
  return `${body}.${sig}`;
}

async function asc(method, url, data) {
  const res = await fetch(url.startsWith("http") ? url : API + url, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify({ data }) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors = (json.errors ?? [])
      .map((e) => `${e.code}: ${e.detail ?? e.title}`)
      .join("\n  ");
    throw new Error(`${method} ${url} → ${res.status}\n  ${errors}`);
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. the App Store version ----
async function appStoreVersion() {
  const found = await asc(
    "GET",
    `/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${versionString}`,
  );
  if (found.data[0]) return found.data[0];
  console.log(`Creating version ${versionString}…`);
  const created = await asc("POST", "/appStoreVersions", {
    type: "appStoreVersions",
    attributes: {
      platform: "IOS",
      versionString,
      releaseType: flag("manual-release") ? "MANUAL" : "AFTER_APPROVAL",
    },
    relationships: { app: { data: { type: "apps", id: APP_ID } } },
  });
  return created.data;
}

// ---- 2. the build ----
async function findBuild() {
  const number = opt("build");
  const query = [
    `filter[app]=${APP_ID}`,
    `filter[preReleaseVersion.version]=${versionString}`,
    number ? `filter[version]=${number}` : "",
    "sort=-uploadedDate",
    "limit=1",
  ]
    .filter(Boolean)
    .join("&");
  const deadline = Date.now() + (flag("wait") ? 30 * 60_000 : 0);
  for (;;) {
    const build = (await asc("GET", `/builds?${query}`)).data[0];
    const state = build?.attributes.processingState;
    if (state === "VALID") return build;
    if (state === "FAILED" || state === "INVALID")
      throw new Error(`Build ${build.attributes.version} is ${state}.`);
    if (Date.now() > deadline)
      throw new Error(
        build
          ? `Build ${build.attributes.version} is still ${state}: try again with --wait.`
          : `No build of ${versionString} on App Store Connect yet.`,
      );
    console.log(`Waiting for Apple to process the build (${state ?? "—"})…`);
    await sleep(60_000);
  }
}

async function main() {
  console.log(`App ${APP_ID}, version ${versionString}`);
  const version = await appStoreVersion();
  const state = version.attributes.appStoreState;
  console.log(`Version ${versionString}: ${state}`);
  const editable = [
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
  ].includes(state);
  if (!editable) {
    console.log("Nothing to do: it's already submitted or released.");
    return;
  }

  const build = await findBuild();
  console.log(`Build ${build.attributes.version} (${build.id})`);
  // app.config.ts sets ITSAppUsesNonExemptEncryption = false; older builds
  // without it need the answer here.
  if (build.attributes.usesNonExemptEncryption == null)
    await asc("PATCH", `/builds/${build.id}`, {
      type: "builds",
      id: build.id,
      attributes: { usesNonExemptEncryption: false },
    });
  await asc("PATCH", `/appStoreVersions/${version.id}/relationships/build`, {
    type: "builds",
    id: build.id,
  });

  // ---- 3. What's New ----
  const locs = await asc(
    "GET",
    `/appStoreVersions/${version.id}/appStoreVersionLocalizations`,
  );
  for (const loc of locs.data) {
    const text = notes[loc.attributes.locale];
    if (!text) continue;
    await asc("PATCH", `/appStoreVersionLocalizations/${loc.id}`, {
      type: "appStoreVersionLocalizations",
      id: loc.id,
      attributes: { whatsNew: text },
    });
    console.log(`What's New (${loc.attributes.locale}): ${text}`);
  }

  if (!flag("submit")) {
    console.log("\nReady. Run again with --submit to send it to App Review.");
    return;
  }

  // ---- 4. App Review ----
  const open = await asc(
    "GET",
    `/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW`,
  );
  const submission =
    open.data[0] ??
    (
      await asc("POST", "/reviewSubmissions", {
        type: "reviewSubmissions",
        attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: APP_ID } } },
      })
    ).data;
  await asc("POST", "/reviewSubmissionItems", {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: {
        data: { type: "reviewSubmissions", id: submission.id },
      },
      appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
    },
  }).catch((e) => {
    // Already in this submission (a second run): fine.
    if (!String(e.message).includes("409")) throw e;
  });
  await asc("PATCH", `/reviewSubmissions/${submission.id}`, {
    type: "reviewSubmissions",
    id: submission.id,
    attributes: { submitted: true },
  });
  console.log(`\nSubmitted ${versionString} for App Review.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
