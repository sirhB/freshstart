import { PrismaClient } from "@prisma/client";
import { classifyTradelines } from "../src/lib/dispute/classify";
import { buildDisputePacket } from "../src/lib/dispute/letters";
import {
  SAMPLE_CONSUMER,
  SAMPLE_REPORT_DATE,
  SAMPLE_TRADELINES,
} from "../src/lib/dispute/sample-data";
import { FURNISHER_DIRECTORY } from "../src/lib/dispute/furnishers";

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.outcomeEvent.deleteMany();
  await prisma.evidenceDocument.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.approvalGate.deleteMany();
  await prisma.letterPacket.deleteMany();
  await prisma.disputeItem.deleteMany();
  await prisma.tradeline.deleteMany();
  await prisma.creditReport.deleteMany();
  await prisma.disputeCase.deleteMany();
  await prisma.consumer.deleteMany();
  await prisma.furnisherAddress.deleteMany();

  for (const f of FURNISHER_DIRECTORY) {
    await prisma.furnisherAddress.create({
      data: {
        name: f.name,
        addressLines: f.addressLines.join("\n"),
        source: "manual",
        verifiedAt: new Date(),
      },
    });
  }

  const consumer = await prisma.consumer.create({
    data: {
      fullName: SAMPLE_CONSUMER.fullName,
      addressLine1: SAMPLE_CONSUMER.addressLine1,
      cityStateZip: SAMPLE_CONSUMER.cityStateZip,
      dateOfBirth: SAMPLE_CONSUMER.dateOfBirth,
      phone: SAMPLE_CONSUMER.phone,
      ssnLast4: SAMPLE_CONSUMER.ssnLast4,
      email: "jordan.hale@example.com",
    },
  });

  const report = await prisma.creditReport.create({
    data: {
      consumerId: consumer.id,
      reportDate: SAMPLE_REPORT_DATE,
      sourceLabel: "Sample tri-merge PDF",
    },
  });

  for (const t of SAMPLE_TRADELINES) {
    await prisma.tradeline.create({
      data: {
        id: t.id,
        reportId: report.id,
        creditor: t.creditor,
        accountNumber: t.accountNumber,
        accountType: t.accountType,
        status: t.status,
        balance: t.balance,
        dateOpened: t.dateOpened,
        dateOfFirstDelinquency: t.dateOfFirstDelinquency,
        furnisherName: t.furnisherName,
        furnisherAddress: t.furnisherAddress,
        bureausJson: JSON.stringify(t.bureaus),
        rawNotes: t.rawNotes,
      },
    });
  }

  const classified = classifyTradelines(SAMPLE_TRADELINES, {
    asOf: new Date("2026-09-17"),
    maxRecommended: 5,
  });

  const disputeCase = await prisma.disputeCase.create({
    data: {
      consumerId: consumer.id,
      title: `Wave 1 — ${SAMPLE_CONSUMER.fullName}`,
      status: "pending_plan_approval",
      waveNumber: 1,
    },
  });

  for (const item of classified) {
    await prisma.disputeItem.create({
      data: {
        id: item.id,
        caseId: disputeCase.id,
        tradelineId: item.tradelineId,
        creditor: item.creditor,
        accountNumber: item.accountNumber,
        accountType: item.accountType,
        statusReported: item.statusReported,
        balance: item.balance,
        dateOpened: item.dateOpened,
        furnisherName: item.furnisherName,
        furnisherAddress: item.furnisherAddress,
        bureausJson: JSON.stringify(item.bureaus),
        groundCode: item.groundCode,
        groundRationale: item.groundRationale,
        remedy: item.remedy,
        confidence: item.confidence,
        recommended: item.recommended,
        status: "proposed",
        evidenceNotes: item.evidenceNotes,
        riskFlagsJson: JSON.stringify(item.riskFlags),
      },
    });
  }

  await prisma.approvalGate.create({
    data: {
      caseId: disputeCase.id,
      gateType: "dispute_plan",
      status: "pending",
      payloadJson: JSON.stringify({
        recommendedIds: classified.filter((c) => c.recommended).map((c) => c.id),
      }),
    },
  });

  const recommended = classified.filter((c) => c.recommended);
  const letters = buildDisputePacket({
    consumer: SAMPLE_CONSUMER,
    items: recommended,
    asOf: new Date("2026-09-17"),
    includeFurnisherLetters: true,
  });

  for (const letter of letters) {
    const recipientName =
      letter.recipient.type === "cra"
        ? letter.recipient.bureau
        : letter.recipient.name;
    await prisma.letterPacket.create({
      data: {
        caseId: disputeCase.id,
        recipientType: letter.recipient.type,
        recipientName,
        bureau: letter.recipient.type === "cra" ? letter.recipient.bureau : null,
        status: "draft",
        bodyText: letter.body,
        lintPassed: letter.lintPassed,
        lintIssuesJson: JSON.stringify(letter.lintIssues),
        itemIdsJson: JSON.stringify(letter.itemIds),
      },
    });
  }

  await prisma.notification.create({
    data: {
      consumerId: consumer.id,
      caseId: disputeCase.id,
      title: "Welcome to Fresh Start",
      body: "Your sample dispute plan is ready for operator review.",
      channel: "in_app",
    },
  });

  await prisma.auditLog.create({
    data: {
      caseId: disputeCase.id,
      action: "case_seeded",
      actor: "system",
      detailJson: JSON.stringify({
        consumerId: consumer.id,
        recommendedCount: recommended.length,
        packetCount: letters.length,
      }),
    },
  });

  console.log(
    JSON.stringify(
      {
        consumerId: consumer.id,
        caseId: disputeCase.id,
        portal: `/cases/${disputeCase.id}`,
        recommended: recommended.length,
        packets: letters.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
