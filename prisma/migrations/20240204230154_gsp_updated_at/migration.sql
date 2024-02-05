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
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "GettingStartedProgress_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GettingStartedProgress" ("hasGeneratedResume", "hasSavedJob", "hasSavedResume", "hasTailoredResume", "id", "ownerId") SELECT "hasGeneratedResume", "hasSavedJob", "hasSavedResume", "hasTailoredResume", "id", "ownerId" FROM "GettingStartedProgress";
DROP TABLE "GettingStartedProgress";
ALTER TABLE "new_GettingStartedProgress" RENAME TO "GettingStartedProgress";
CREATE UNIQUE INDEX "GettingStartedProgress_id_key" ON "GettingStartedProgress"("id");
CREATE UNIQUE INDEX "GettingStartedProgress_ownerId_key" ON "GettingStartedProgress"("ownerId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
