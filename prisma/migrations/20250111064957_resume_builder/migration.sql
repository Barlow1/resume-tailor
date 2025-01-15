-- CreateTable
CREATE TABLE "BuilderResume" (
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
    CONSTRAINT "BuilderResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuilderExperience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT,
    "company" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "description" TEXT,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "BuilderExperience_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuilderEducation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "school" TEXT,
    "degree" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "description" TEXT,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "BuilderEducation_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuilderSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "BuilderSkill_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuilderHobby" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "BuilderHobby_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuilderHeaders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experienceHeader" TEXT,
    "skillsHeader" TEXT,
    "hobbiesHeader" TEXT,
    "educationHeader" TEXT,
    "aboutHeader" TEXT,
    "detailsHeader" TEXT,
    "resumeId" TEXT NOT NULL,
    CONSTRAINT "BuilderHeaders_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "BuilderResume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BuilderResume_userId_idx" ON "BuilderResume"("userId");

-- CreateIndex
CREATE INDEX "BuilderExperience_resumeId_idx" ON "BuilderExperience"("resumeId");

-- CreateIndex
CREATE INDEX "BuilderEducation_resumeId_idx" ON "BuilderEducation"("resumeId");

-- CreateIndex
CREATE INDEX "BuilderSkill_resumeId_idx" ON "BuilderSkill"("resumeId");

-- CreateIndex
CREATE INDEX "BuilderHobby_resumeId_idx" ON "BuilderHobby"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderHeaders_resumeId_key" ON "BuilderHeaders"("resumeId");
