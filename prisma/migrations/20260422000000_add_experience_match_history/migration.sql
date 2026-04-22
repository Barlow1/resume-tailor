-- CreateTable
CREATE TABLE "ExperienceMatchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "requirementsCovered" INTEGER NOT NULL,
    "requirementsTotal" INTEGER NOT NULL,
    "missingRequirements" TEXT NOT NULL,
    "coveredRequirements" TEXT NOT NULL,
    "bestMoves" TEXT NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperienceMatchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExperienceMatchRun_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExperienceMatchRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequirementFix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "triggeringRunId" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "bulletAction" TEXT NOT NULL,
    "previousBulletContent" TEXT,
    "finalBulletContent" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequirementFix_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequirementFix_triggeringRunId_fkey" FOREIGN KEY ("triggeringRunId") REFERENCES "ExperienceMatchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExperienceMatchRun_userId_createdAt_idx" ON "ExperienceMatchRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExperienceMatchRun_resumeId_jobId_createdAt_idx" ON "ExperienceMatchRun"("resumeId", "jobId", "createdAt");

-- CreateIndex
CREATE INDEX "RequirementFix_userId_createdAt_idx" ON "RequirementFix"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RequirementFix_triggeringRunId_idx" ON "RequirementFix"("triggeringRunId");

-- CreateIndex
CREATE INDEX "RequirementFix_resumeId_jobId_createdAt_idx" ON "RequirementFix"("resumeId", "jobId", "createdAt");
