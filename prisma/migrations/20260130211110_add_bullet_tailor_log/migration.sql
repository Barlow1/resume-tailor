-- AlterTable
ALTER TABLE "User" ADD COLUMN "activatedAt" DATETIME;

-- CreateTable
CREATE TABLE "BulletTailorLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "originalBullet" TEXT NOT NULL,
    "jobTitle" TEXT,
    "jobDescription" TEXT NOT NULL,
    "currentJobTitle" TEXT,
    "currentJobCompany" TEXT,
    "extractedKeywords" TEXT,
    "aiOutput" TEXT NOT NULL,
    "promptVersion" TEXT,
    "selectedOption" INTEGER,
    "userAction" TEXT,
    "actionAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BulletTailorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BulletTailorLog_userId_idx" ON "BulletTailorLog"("userId");

-- CreateIndex
CREATE INDEX "BulletTailorLog_createdAt_idx" ON "BulletTailorLog"("createdAt");
