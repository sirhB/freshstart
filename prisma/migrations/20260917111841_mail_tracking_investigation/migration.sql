-- AlterTable
ALTER TABLE "DisputeCase" ADD COLUMN "investigationDueAt" DATETIME;
ALTER TABLE "DisputeCase" ADD COLUMN "investigationStartedAt" DATETIME;

-- AlterTable
ALTER TABLE "LetterPacket" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "LetterPacket" ADD COLUMN "mailedAt" DATETIME;
ALTER TABLE "LetterPacket" ADD COLUMN "returnReceiptAt" DATETIME;
ALTER TABLE "LetterPacket" ADD COLUMN "trackingNumber" TEXT;
