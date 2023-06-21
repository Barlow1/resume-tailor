/*
  Warnings:

  - A unique constraint covering the columns `[resumeId,school,field]` on the table `Education` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resumeId,name]` on the table `Skill` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Education_resumeId_school_field_key" ON "Education"("resumeId", "school", "field");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_resumeId_name_key" ON "Skill"("resumeId", "name");
