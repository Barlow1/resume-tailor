/*
  Warnings:

  - A unique constraint covering the columns `[resumeId,employer,role]` on the table `Experience` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Experience_resumeId_employer_role_key" ON "Experience"("resumeId", "employer", "role");
