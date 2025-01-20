-- CreateTable
CREATE TABLE "BuilderVisibleSections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "about" BOOLEAN NOT NULL,
    "experience" BOOLEAN NOT NULL,
    "education" BOOLEAN NOT NULL,
    "skills" BOOLEAN NOT NULL,
    "hobbies" BOOLEAN NOT NULL,
    "personalDetails" BOOLEAN NOT NULL,
    "photo" BOOLEAN NOT NULL,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "BuilderVisibleSections_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    CONSTRAINT "BuilderResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuilderResume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BuilderResume" ("about", "createdAt", "email", "id", "image", "jobId", "location", "name", "nameColor", "phone", "role", "updatedAt", "userId", "website") SELECT "about", "createdAt", "email", "id", "image", "jobId", "location", "name", "nameColor", "phone", "role", "updatedAt", "userId", "website" FROM "BuilderResume";
DROP TABLE "BuilderResume";
ALTER TABLE "new_BuilderResume" RENAME TO "BuilderResume";
CREATE INDEX "BuilderResume_userId_idx" ON "BuilderResume"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BuilderVisibleSections_resumeId_key" ON "BuilderVisibleSections"("resumeId");
