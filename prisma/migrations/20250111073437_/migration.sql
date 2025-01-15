/*
  Warnings:

  - You are about to drop the column `description` on the `BuilderExperience` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "BuilderExperienceDescription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT,
    "order" INTEGER NOT NULL,
    "experienceId" TEXT NOT NULL,
    CONSTRAINT "BuilderExperienceDescription_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "BuilderExperience" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuilderExperience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT,
    "company" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "BuilderExperience_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BuilderExperience" ("company", "endDate", "id", "resumeId", "role", "startDate") SELECT "company", "endDate", "id", "resumeId", "role", "startDate" FROM "BuilderExperience";
DROP TABLE "BuilderExperience";
ALTER TABLE "new_BuilderExperience" RENAME TO "BuilderExperience";
CREATE INDEX "BuilderExperience_resumeId_idx" ON "BuilderExperience"("resumeId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "BuilderExperienceDescription_experienceId_idx" ON "BuilderExperienceDescription"("experienceId");
