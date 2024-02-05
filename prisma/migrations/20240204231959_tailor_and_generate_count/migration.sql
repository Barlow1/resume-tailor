-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GettingStartedProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasSavedJob" BOOLEAN NOT NULL,
    "hasSavedResume" BOOLEAN NOT NULL,
    "hasTailoredResume" BOOLEAN NOT NULL,
    "hasGeneratedResume" BOOLEAN NOT NULL,
    "tailorCount" INTEGER NOT NULL DEFAULT 0,
    "generateCount" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "GettingStartedProgress_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GettingStartedProgress" ("createdAt", "hasGeneratedResume", "hasSavedJob", "hasSavedResume", "hasTailoredResume", "id", "ownerId", "updatedAt") SELECT "createdAt", "hasGeneratedResume", "hasSavedJob", "hasSavedResume", "hasTailoredResume", "id", "ownerId", "updatedAt" FROM "GettingStartedProgress";
DROP TABLE "GettingStartedProgress";
ALTER TABLE "new_GettingStartedProgress" RENAME TO "GettingStartedProgress";
CREATE UNIQUE INDEX "GettingStartedProgress_id_key" ON "GettingStartedProgress"("id");
CREATE UNIQUE INDEX "GettingStartedProgress_ownerId_key" ON "GettingStartedProgress"("ownerId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
