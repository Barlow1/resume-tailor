-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN "userId" TEXT;

-- CreateIndex (optional, for query performance)
CREATE INDEX "Analysis_userId_idx" ON "Analysis"("userId");
