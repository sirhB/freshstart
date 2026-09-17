-- AlterTable
ALTER TABLE "DisputeCase" ADD COLUMN "closedReason" TEXT;
ALTER TABLE "DisputeCase" ADD COLUMN "parentCaseId" TEXT;

-- CreateTable
CREATE TABLE "OutcomeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "itemId" TEXT,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutcomeEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutcomeEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DisputeItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consumerId" TEXT NOT NULL,
    "caseId" TEXT,
    "itemId" TEXT,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "matchedAccountHint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceDocument_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EvidenceDocument_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DisputeItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consumerId" TEXT,
    "caseId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FurnisherAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "addressLines" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DisputeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "tradelineId" TEXT,
    "creditor" TEXT NOT NULL,
    "accountNumber" TEXT,
    "accountType" TEXT NOT NULL,
    "statusReported" TEXT NOT NULL,
    "balance" TEXT,
    "dateOpened" TEXT,
    "furnisherName" TEXT,
    "furnisherAddress" TEXT,
    "bureausJson" TEXT NOT NULL,
    "groundCode" TEXT NOT NULL,
    "groundRationale" TEXT NOT NULL,
    "remedy" TEXT NOT NULL DEFAULT 'delete',
    "correctedValues" TEXT,
    "confidence" REAL NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "evidenceNotes" TEXT,
    "riskFlagsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisputeItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DisputeItem_tradelineId_fkey" FOREIGN KEY ("tradelineId") REFERENCES "Tradeline" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DisputeItem" ("accountNumber", "accountType", "balance", "bureausJson", "caseId", "confidence", "correctedValues", "createdAt", "creditor", "dateOpened", "evidenceNotes", "furnisherAddress", "furnisherName", "groundCode", "groundRationale", "id", "recommended", "remedy", "status", "statusReported", "tradelineId", "updatedAt") SELECT "accountNumber", "accountType", "balance", "bureausJson", "caseId", "confidence", "correctedValues", "createdAt", "creditor", "dateOpened", "evidenceNotes", "furnisherAddress", "furnisherName", "groundCode", "groundRationale", "id", "recommended", "remedy", "status", "statusReported", "tradelineId", "updatedAt" FROM "DisputeItem";
DROP TABLE "DisputeItem";
ALTER TABLE "new_DisputeItem" RENAME TO "DisputeItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FurnisherAddress_name_key" ON "FurnisherAddress"("name");
