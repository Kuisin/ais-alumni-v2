import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/server/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({
    // DATABASE_URL is Supabase's transaction pooler (Tokyo). Supavisor does the
    // real pooling, so keep each function instance's local pool small.
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }),
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
