#!/usr/bin/env node
/**
 * Copy the database schema from a checkout of the old website
 * (github.com/Kuisin/ais-alumni-app), which still owns the migrations:
 * prisma/schema.prisma, with the client generated into this repo's
 * src/server/generated (run `npx prisma generate` afterwards).
 *
 * The API contract (src/contract) and the UI strings (messages/) are this
 * repo's own now; they are no longer copied.
 *
 *   pnpm sync:server            # SERVER_DIR defaults to ../ais-alumni-app
 *   pnpm sync:server --check    # exit 1 if the schema differs; copies nothing
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = path.resolve(
  process.env.SERVER_DIR ?? path.join(root, "../ais-alumni-app"),
);
const check = process.argv.includes("--check");

const schemaPath = path.join(server, "prisma/schema.prisma");
if (!existsSync(schemaPath)) {
  console.error(
    `No schema at ${schemaPath} (set SERVER_DIR to your ais-alumni-app clone).`,
  );
  process.exit(2);
}

const schemaFrom = readFileSync(schemaPath, "utf8").replace(
  'output   = "../src/generated/prisma"',
  'output   = "../src/server/generated/prisma"',
);
const schemaTo = path.join(root, "prisma/schema.prisma");
if (existsSync(schemaTo) && readFileSync(schemaTo, "utf8") === schemaFrom)
  console.log(`In step with ${server}.`);
else if (check) {
  console.log("differs: prisma/schema.prisma");
  process.exit(1);
} else {
  writeFileSync(schemaTo, schemaFrom);
  console.log("updated prisma/schema.prisma (run npx prisma generate)");
}
