-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuilderResume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "website" TEXT,
    "about" TEXT,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT,
    CONSTRAINT "BuilderResume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BuilderResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BuilderResume" ("about", "createdAt", "email", "id", "image", "location", "name", "phone", "role", "updatedAt", "userId", "website") SELECT "about", "createdAt", "email", "id", "image", "location", "name", "phone", "role", "updatedAt", "userId", "website" FROM "BuilderResume";
DROP TABLE "BuilderResume";
ALTER TABLE "new_BuilderResume" RENAME TO "BuilderResume";
CREATE INDEX "BuilderResume_userId_idx" ON "BuilderResume"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
