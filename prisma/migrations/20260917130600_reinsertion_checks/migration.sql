-- CreateTable
CREATE TABLE "ReinsertionCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "itemId" TEXT,
    "label" TEXT NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReinsertionCheck_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
