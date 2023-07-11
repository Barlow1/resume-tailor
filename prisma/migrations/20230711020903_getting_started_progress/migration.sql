-- CreateTable
CREATE TABLE "GettingStartedProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hasSavedJob" BOOLEAN NOT NULL,
    "hasSavedResume" BOOLEAN NOT NULL,
    "hasTailoredResume" BOOLEAN NOT NULL,
    "hasGeneratedResume" BOOLEAN NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "GettingStartedProgress_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GettingStartedProgress_id_key" ON "GettingStartedProgress"("id");

-- CreateIndex
CREATE UNIQUE INDEX "GettingStartedProgress_ownerId_key" ON "GettingStartedProgress"("ownerId");
