-- A family link claimed by an already-approved member grants nothing until
-- confirmed (src/server/lib/family-trust.ts). Existing links stay as they are.
-- AlterTable
ALTER TABLE "FamilyLink" ADD COLUMN     "unreviewed" BOOLEAN NOT NULL DEFAULT false;

