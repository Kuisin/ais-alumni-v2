-- AlterTable
ALTER TABLE "VerificationRequest" ADD COLUMN     "applicantReadAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VerificationMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "fromAdmin" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationMessage_requestId_createdAt_idx" ON "VerificationMessage"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationMessage_authorId_idx" ON "VerificationMessage"("authorId");

-- AddForeignKey
ALTER TABLE "VerificationMessage" ADD CONSTRAINT "VerificationMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationMessage" ADD CONSTRAINT "VerificationMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

