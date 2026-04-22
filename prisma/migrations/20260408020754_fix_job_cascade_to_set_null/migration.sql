/*
  Warnings:

  - You are about to drop the column `blockTree` on the `BuilderResume` table. All the data in the column will be lost.
  - You are about to drop the column `sourceFileId` on the `BuilderResume` table. All the data in the column will be lost.
  - You are about to drop the column `sourceFormat` on the `BuilderResume` table. All the data in the column will be lost.
  - You are about to drop the column `templateHtml` on the `BuilderResume` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuilderResume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "jobId" TEXT,
    "name" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "website" TEXT,
    "about" TEXT,
    "image" TEXT,
    "nameColor" TEXT,
    "font" TEXT,
    "layout" TEXT,
    "textSize" TEXT,
    "coverLetterDrafts" TEXT,
    "tailorSnapshot" TEXT,
    "tailorSnapshotDate" DATETIME,
    CONSTRAINT "BuilderResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuilderResume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BuilderResume" ("about", "coverLetterDrafts", "createdAt", "email", "font", "id", "image", "jobId", "layout", "location", "name", "nameColor", "phone", "role", "tailorSnapshot", "tailorSnapshotDate", "textSize", "updatedAt", "userId", "website") SELECT "about", "coverLetterDrafts", "createdAt", "email", "font", "id", "image", "jobId", "layout", "location", "name", "nameColor", "phone", "role", "tailorSnapshot", "tailorSnapshotDate", "textSize", "updatedAt", "userId", "website" FROM "BuilderResume";
DROP TABLE "BuilderResume";
ALTER TABLE "new_BuilderResume" RENAME TO "BuilderResume";
CREATE INDEX "BuilderResume_userId_idx" ON "BuilderResume"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
