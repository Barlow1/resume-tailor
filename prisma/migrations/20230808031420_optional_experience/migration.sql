-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Experience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employer" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startDate" TEXT,
    "endDate" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "responsibilities" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "Experience_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Experience" ("city", "country", "createdAt", "employer", "endDate", "id", "responsibilities", "resumeId", "role", "startDate", "state", "updatedAt") SELECT "city", "country", "createdAt", "employer", "endDate", "id", "responsibilities", "resumeId", "role", "startDate", "state", "updatedAt" FROM "Experience";
DROP TABLE "Experience";
ALTER TABLE "new_Experience" RENAME TO "Experience";
CREATE UNIQUE INDEX "Experience_id_key" ON "Experience"("id");
CREATE UNIQUE INDEX "Experience_resumeId_employer_role_key" ON "Experience"("resumeId", "employer", "role");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
