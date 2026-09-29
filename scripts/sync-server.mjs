#!/usr/bin/env node
/**
 * Copy what the app shares with the API server (github.com/Kuisin/
 * ais-alumni-app) from a checkout of it:
 *  - the API contract types: src/lib/mobile/contract/*.ts → src/contract/
 *  - the UI strings the app and its API use: messages/<locale>/<namespace>.json,
 *    for every namespace imported from "@messages/…" under src/
 *  - the database schema: prisma/schema.prisma (client generated into
 *    src/server/generated; migrations stay with the server)
 *
 *   pnpm sync:server            # SERVER_DIR defaults to ../ais-alumni-app
 *   pnpm sync:server --check    # exit 1 if anything differs; copies nothing
 *
 * The server is the source of truth for both until they move here (see
 * docs/MIGRATION.md): change them there, then sync.
 */
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = path.resolve(
  process.env.SERVER_DIR ?? path.join(root, "../ais-alumni-app"),
);
const check = process.argv.includes("--check");

if (!existsSync(path.join(server, "src/lib/mobile/contract"))) {
  console.error(
    `No API server checkout at ${server} (set SERVER_DIR to your ais-alumni-app clone).`,
  );
  process.exit(2);
}

/** Every file under src/ (the namespaces are read from the imports). */
function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const namespaces = new Set();
for (const file of sources(path.join(root, "src"))) {
  for (const m of readFileSync(file, "utf8").matchAll(
    /@messages\/(?:ja|en)\/([A-Za-z]+)\.json/g,
  ))
    namespaces.add(m[1]);
}
// The app's own strings live here now.
namespaces.delete("mobile");

const pairs = [];
const contract = path.join(server, "src/lib/mobile/contract");
for (const name of readdirSync(contract).filter((n) => n.endsWith(".ts")))
  pairs.push([
    path.join(contract, name),
    path.join(root, "src/contract", name),
  ]);
for (const locale of ["ja", "en"])
  for (const ns of [...namespaces].sort())
    pairs.push([
      path.join(server, "messages", locale, `${ns}.json`),
      path.join(root, "messages", locale, `${ns}.json`),
    ]);

// The schema, with the client generated into this repo's src/server.
const schemaFrom = readFileSync(
  path.join(server, "prisma/schema.prisma"),
  "utf8",
).replace(
  'output   = "../src/generated/prisma"',
  'output   = "../src/server/generated/prisma"',
);
const schemaTo = path.join(root, "prisma/schema.prisma");
if (!existsSync(schemaTo) || readFileSync(schemaTo, "utf8") !== schemaFrom) {
  if (check) console.log("differs: prisma/schema.prisma");
  else {
    writeFileSync(schemaTo, schemaFrom);
    console.log("updated prisma/schema.prisma (run npx prisma generate)");
  }
  if (check) process.exitCode = 1;
}

const differ = pairs.filter(
  ([from, to]) =>
    !existsSync(to) || !readFileSync(from).equals(readFileSync(to)),
);
for (const [from, to] of differ) {
  const rel = path.relative(root, to);
  if (check) console.log(`differs: ${rel}`);
  else {
    copyFileSync(from, to);
    console.log(`updated ${rel}`);
  }
}
if (differ.length === 0)
  console.log(`In step with ${server} (${pairs.length} files).`);
else if (check) process.exit(1);
