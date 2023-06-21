-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fileId" TEXT,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Resume_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Resume_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Resume" ("city", "country", "createdAt", "email", "firstName", "id", "lastName", "ownerId", "phone", "state", "summary", "title", "updatedAt") SELECT "city", "country", "createdAt", "email", "firstName", "id", "lastName", "ownerId", "phone", "state", "summary", "title", "updatedAt" FROM "Resume";
DROP TABLE "Resume";
ALTER TABLE "new_Resume" RENAME TO "Resume";
CREATE UNIQUE INDEX "Resume_id_key" ON "Resume"("id");
CREATE UNIQUE INDEX "Resume_fileId_key" ON "Resume"("fileId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
