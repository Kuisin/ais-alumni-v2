import { defineConfig } from "prisma/config";

/**
 * The database schema is owned by the API server's repo until it is retired
 * (Kuisin/ais-alumni-app: prisma/schema.prisma and its migrations) — this
 * copy only generates the client (`pnpm sync:server` refreshes it). Never
 * run `prisma migrate` from here.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
