-- CreateTable: ResumeScore
-- Stores historical scores for progress tracking and gamification

CREATE TABLE "ResumeScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "keywordScore" INTEGER NOT NULL DEFAULT 0,
    "metricsScore" INTEGER NOT NULL DEFAULT 0,
    "actionVerbsScore" INTEGER NOT NULL DEFAULT 0,
    "lengthScore" INTEGER NOT NULL DEFAULT 0,
    "formattingScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResumeScore_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResumeScore_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ResumeScore_resumeId_idx" ON "ResumeScore"("resumeId");
CREATE INDEX "ResumeScore_createdAt_idx" ON "ResumeScore"("createdAt");
CREATE UNIQUE INDEX "ResumeScore_resumeId_jobId_key" ON "ResumeScore"("resumeId", "jobId");
