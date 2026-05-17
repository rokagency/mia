-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "reason" TEXT,
    "appointmentType" TEXT,
    "patientType" TEXT,
    "preferredTimes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "conversationId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
