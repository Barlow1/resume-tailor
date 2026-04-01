-- AlterTable
ALTER TABLE "BuilderResume" ADD COLUMN "blockTree" TEXT;
ALTER TABLE "BuilderResume" ADD COLUMN "sourceFormat" TEXT;
ALTER TABLE "BuilderResume" ADD COLUMN "sourceFileId" TEXT;
ALTER TABLE "BuilderResume" ADD COLUMN "templateHtml" TEXT;
ALTER TABLE "BuilderResume" ADD COLUMN "tailorSnapshot" TEXT;
ALTER TABLE "BuilderResume" ADD COLUMN "tailorSnapshotDate" DATETIME;
