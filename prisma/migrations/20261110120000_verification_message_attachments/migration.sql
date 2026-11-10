-- AlterTable
ALTER TABLE "VerificationEvidence" ADD COLUMN     "messageId" TEXT;

-- CreateIndex
CREATE INDEX "VerificationEvidence_messageId_idx" ON "VerificationEvidence"("messageId");

-- AddForeignKey
ALTER TABLE "VerificationEvidence" ADD CONSTRAINT "VerificationEvidence_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "VerificationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

