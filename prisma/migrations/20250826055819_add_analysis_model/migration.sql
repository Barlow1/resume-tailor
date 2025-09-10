-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "jdText" TEXT NOT NULL DEFAULT '',
    "resumeTxt" TEXT NOT NULL,
    "fitPct" INTEGER,
    "feedback" TEXT,
    "peopleJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
