/*
  Warnings:

  - A unique constraint covering the columns `[resumeId]` on the table `BuilderExperience` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resumeId]` on the table `BuilderHobby` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resumeId]` on the table `BuilderSkill` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BuilderExperience_resumeId_key" ON "BuilderExperience"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderHobby_resumeId_key" ON "BuilderHobby"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderSkill_resumeId_key" ON "BuilderSkill"("resumeId");
