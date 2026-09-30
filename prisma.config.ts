import { defineConfig } from "prisma/config";

/**
 * This repo owns the database schema and its migrations (prisma/migrations,
 * applied by scripts/migrate.mjs in the Vercel build). The CLI connects
 * with DIRECT_URL (direct / session-mode Postgres): `prisma migrate` can't
 * work through DATABASE_URL, the transaction pooler the app uses.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
