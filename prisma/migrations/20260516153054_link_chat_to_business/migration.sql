-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "businessId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "businessId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_businessId_createdAt_idx" ON "Conversation"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_businessId_createdAt_idx" ON "Lead"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
