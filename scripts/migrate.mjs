/**
 * Database migrations, run by the Vercel build (vercel.json) before the web
 * export. This repo owns the schema (prisma/schema.prisma) and its
 * migrations (prisma/migrations) — the old website no longer migrates.
 *
 *   node scripts/migrate.mjs
 *
 * Needs DIRECT_URL: a direct / session-mode Postgres URL (Supabase: the
 * "Session pooler" string). DATABASE_URL is the transaction pooler, which
 * `prisma migrate` can't use. Without DIRECT_URL nothing runs (a warning).
 *
 * The first run on the existing database baselines it: the database was
 * built by the old website's migrations, so 0_init (the schema as this
 * repo took it over) is recorded as applied instead of run — but only if
 * the live database is exactly that schema: the difference between it and
 * prisma/schema.prisma must be precisely the migrations that haven't run
 * yet. Anything else stops the build before a single change is made.
 * Then `prisma migrate deploy` applies what's pending.
 *
 * Staging and production share one database, and both builds run this:
 * migrations must be backward compatible (add, don't drop or rename, until
 * no deployed code uses the old shape).
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const MIGRATIONS = path.join(root, "prisma/migrations");
const BASELINE = "0_init";

const url = process.env.DIRECT_URL?.trim();
if (!url) {
  console.warn(
    "[migrate] DIRECT_URL is not set: database migrations skipped. " +
      "Set it (Supabase → Session pooler) so pending migrations apply.",
  );
  process.exit(0);
}

function prisma(args, { capture = false } = {}) {
  return execFileSync("npx", ["prisma", ...args], {
    cwd: root,
    env: { ...process.env, DIRECT_URL: url },
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}

/** SQL statements without comments / blank lines, for comparing scripts. */
function statements(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .sort();
}

const local = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const { Client } = require("pg");
const client = new Client({ connectionString: url });
await client.connect();
let applied = null;
try {
  const table = await client.query(
    "select to_regclass('public._prisma_migrations') is not null as exists",
  );
  if (table.rows[0].exists) {
    const rows = await client.query(
      "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null",
    );
    applied = new Set(rows.rows.map((r) => r.migration_name));
  }
} finally {
  await client.end();
}

// An existing database this repo hasn't baselined yet.
if (applied && !applied.has(BASELINE)) {
  const pending = local.filter((m) => m !== BASELINE && !applied.has(m));
  const expected = statements(
    pending
      .map((m) =>
        readFileSync(path.join(MIGRATIONS, m, "migration.sql"), "utf8"),
      )
      .join("\n"),
  );
  const actual = statements(
    prisma(
      [
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--script",
      ],
      { capture: true },
    ),
  );
  const same =
    expected.length === actual.length &&
    expected.every((s, i) => s === actual[i]);
  if (!same) {
    const extra = actual.filter((s) => !expected.includes(s));
    const missing = expected.filter((s) => !actual.includes(s));
    console.error(
      "[migrate] The database doesn't match prisma/schema.prisma + the " +
        "pending migrations, so it can't be baselined. Nothing was changed.",
    );
    if (extra.length)
      console.error("Needed but not in any pending migration:\n", extra);
    if (missing.length)
      console.error("In a pending migration but not needed:\n", missing);
    process.exit(1);
  }
  console.log(`[migrate] Baselining: recording ${BASELINE} as applied.`);
  prisma(["migrate", "resolve", "--applied", BASELINE]);
}

prisma(["migrate", "deploy"]);
