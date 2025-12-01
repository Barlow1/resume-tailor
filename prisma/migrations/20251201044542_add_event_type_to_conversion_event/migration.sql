-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConversionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "planTier" TEXT NOT NULL,
    "priceUsd" REAL NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'purchase_completed',
    "tracked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ConversionEvent" ("createdAt", "id", "planTier", "priceUsd", "subscriptionId", "tracked", "userId") SELECT "createdAt", "id", "planTier", "priceUsd", "subscriptionId", "tracked", "userId" FROM "ConversionEvent";
DROP TABLE "ConversionEvent";
ALTER TABLE "new_ConversionEvent" RENAME TO "ConversionEvent";
CREATE INDEX "ConversionEvent_userId_tracked_idx" ON "ConversionEvent"("userId", "tracked");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
