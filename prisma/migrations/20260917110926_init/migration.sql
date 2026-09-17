-- CreateTable
CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "cityStateZip" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "ssnLast4" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreditReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consumerId" TEXT NOT NULL,
    "bureau" TEXT,
    "reportDate" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditReport_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tradeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "accountNumber" TEXT,
    "accountType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "balance" TEXT,
    "dateOpened" TEXT,
    "dateOfFirstDelinquency" TEXT,
    "furnisherName" TEXT,
    "furnisherAddress" TEXT,
    "bureausJson" TEXT NOT NULL,
    "rawNotes" TEXT,
    CONSTRAINT "Tradeline_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CreditReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consumerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "waveNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisputeCase_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeItem" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisputeItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DisputeItem_tradelineId_fkey" FOREIGN KEY ("tradelineId") REFERENCES "Tradeline" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LetterPacket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "bureau" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "bodyText" TEXT NOT NULL,
    "lintPassed" BOOLEAN NOT NULL DEFAULT false,
    "lintIssuesJson" TEXT NOT NULL DEFAULT '[]',
    "itemIdsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LetterPacket_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalGate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "packetId" TEXT,
    "gateType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actor" TEXT,
    "reason" TEXT,
    "payloadJson" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalGate_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalGate_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "LetterPacket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detailJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
