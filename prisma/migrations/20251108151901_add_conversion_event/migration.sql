-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "planTier" TEXT NOT NULL,
    "priceUsd" REAL NOT NULL,
    "tracked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ConversionEvent_userId_tracked_idx" ON "ConversionEvent"("userId", "tracked");
