import { prisma } from "@/lib/db";
import type { Bureau, ClassifiedDisputeItem, ConsumerIdentity } from "@/lib/domain/types";
import { buildDisputePacket } from "@/lib/dispute/letters";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getCaseBundle(caseId: string) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: caseId },
    include: {
      consumer: true,
      items: { orderBy: { confidence: "desc" } },
      packets: { orderBy: { createdAt: "asc" } },
      approvals: { orderBy: { createdAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!disputeCase) return null;

  return {
    ...disputeCase,
    items: disputeCase.items.map((item) => ({
      ...item,
      bureaus: parseJson<Bureau[]>(item.bureausJson, []),
    })),
    packets: disputeCase.packets.map((p) => ({
      ...p,
      lintIssues: parseJson(p.lintIssuesJson, []),
      itemIds: parseJson<string[]>(p.itemIdsJson, []),
    })),
    approvals: disputeCase.approvals.map((a) => ({
      ...a,
      payload: parseJson(a.payloadJson ?? "{}", {}),
    })),
  };
}

export async function listCases() {
  return prisma.disputeCase.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      consumer: true,
      _count: { select: { items: true, packets: true, approvals: true } },
      approvals: {
        where: { status: "pending" },
        select: { id: true, gateType: true },
      },
    },
  });
}

export async function decidePlan(input: {
  caseId: string;
  actor: string;
  decisions: { itemId: string; decision: "approved" | "denied"; reason?: string }[];
}) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
    include: { consumer: true, items: true },
  });
  if (!disputeCase) throw new Error("Case not found");

  for (const d of input.decisions) {
    await prisma.disputeItem.update({
      where: { id: d.itemId },
      data: {
        status: d.decision,
      },
    });
  }

  await prisma.approvalGate.updateMany({
    where: { caseId: input.caseId, gateType: "dispute_plan", status: "pending" },
    data: {
      status: "approved",
      actor: input.actor,
      decidedAt: new Date(),
      reason: "Plan decisions recorded",
      payloadJson: JSON.stringify({ decisions: input.decisions }),
    },
  });

  const approvedItems = (
    await prisma.disputeItem.findMany({
      where: { caseId: input.caseId, status: "approved" },
    })
  ).map(
    (item) =>
      ({
        id: item.id,
        tradelineId: item.tradelineId ?? item.id,
        creditor: item.creditor,
        accountNumber: item.accountNumber ?? undefined,
        accountType: item.accountType,
        statusReported: item.statusReported,
        balance: item.balance ?? undefined,
        dateOpened: item.dateOpened ?? undefined,
        furnisherName: item.furnisherName ?? undefined,
        furnisherAddress: item.furnisherAddress ?? undefined,
        bureaus: parseJson<Bureau[]>(item.bureausJson, []),
        groundCode: item.groundCode as ClassifiedDisputeItem["groundCode"],
        groundRationale: item.groundRationale,
        remedy: item.remedy as ClassifiedDisputeItem["remedy"],
        confidence: item.confidence,
        recommended: true,
        evidenceNotes: item.evidenceNotes ?? undefined,
        riskFlags: [],
      }) satisfies ClassifiedDisputeItem,
  );

  // Rebuild packets from approved items only
  await prisma.letterPacket.deleteMany({ where: { caseId: input.caseId } });

  const consumer: ConsumerIdentity = {
    fullName: disputeCase.consumer.fullName,
    addressLine1: disputeCase.consumer.addressLine1,
    cityStateZip: disputeCase.consumer.cityStateZip,
    dateOfBirth: disputeCase.consumer.dateOfBirth ?? undefined,
    phone: disputeCase.consumer.phone ?? undefined,
    ssnLast4: disputeCase.consumer.ssnLast4 ?? undefined,
  };

  const letters = buildDisputePacket({
    consumer,
    items: approvedItems,
    includeFurnisherLetters: true,
  });

  for (const letter of letters) {
    const recipientName =
      letter.recipient.type === "cra"
        ? letter.recipient.bureau
        : letter.recipient.name;
    const packet = await prisma.letterPacket.create({
      data: {
        caseId: input.caseId,
        recipientType: letter.recipient.type,
        recipientName,
        bureau: letter.recipient.type === "cra" ? letter.recipient.bureau : null,
        status: letter.lintPassed ? "pending_approval" : "draft",
        bodyText: letter.body,
        lintPassed: letter.lintPassed,
        lintIssuesJson: JSON.stringify(letter.lintIssues),
        itemIdsJson: JSON.stringify(letter.itemIds),
      },
    });

    await prisma.approvalGate.create({
      data: {
        caseId: input.caseId,
        packetId: packet.id,
        gateType: "packet_signoff",
        status: "pending",
      },
    });
  }

  await prisma.disputeCase.update({
    where: { id: input.caseId },
    data: { status: "pending_packet_approval" },
  });

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "dispute_plan_decided",
      actor: input.actor,
      detailJson: JSON.stringify({ decisions: input.decisions, packets: letters.length }),
    },
  });

  return getCaseBundle(input.caseId);
}

export async function decidePacket(input: {
  packetId: string;
  actor: string;
  decision: "approved" | "denied";
  reason?: string;
}) {
  const packet = await prisma.letterPacket.findUnique({
    where: { id: input.packetId },
  });
  if (!packet) throw new Error("Packet not found");

  if (input.decision === "approved" && !packet.lintPassed) {
    throw new Error("Cannot approve a packet that failed the compliance linter");
  }

  await prisma.letterPacket.update({
    where: { id: input.packetId },
    data: {
      status: input.decision === "approved" ? "approved" : "denied",
    },
  });

  await prisma.approvalGate.updateMany({
    where: {
      packetId: input.packetId,
      gateType: "packet_signoff",
      status: "pending",
    },
    data: {
      status: input.decision,
      actor: input.actor,
      reason: input.reason,
      decidedAt: new Date(),
    },
  });

  if (input.decision === "approved") {
    await prisma.disputeItem.updateMany({
      where: {
        id: { in: parseJson<string[]>(packet.itemIdsJson, []) },
      },
      data: { status: "queued" },
    });
  }

  const pending = await prisma.approvalGate.count({
    where: {
      caseId: packet.caseId,
      gateType: "packet_signoff",
      status: "pending",
    },
  });

  if (pending === 0) {
    const anyApproved = await prisma.letterPacket.count({
      where: { caseId: packet.caseId, status: "approved" },
    });
    await prisma.disputeCase.update({
      where: { id: packet.caseId },
      data: { status: anyApproved > 0 ? "mailing" : "draft" },
    });
  }

  await prisma.auditLog.create({
    data: {
      caseId: packet.caseId,
      action: `packet_${input.decision}`,
      actor: input.actor,
      detailJson: JSON.stringify({
        packetId: input.packetId,
        reason: input.reason,
      }),
    },
  });

  return getCaseBundle(packet.caseId);
}

export async function queueMail(input: {
  caseId: string;
  actor: string;
}) {
  const approved = await prisma.letterPacket.findMany({
    where: { caseId: input.caseId, status: "approved" },
  });

  for (const packet of approved) {
    await prisma.letterPacket.update({
      where: { id: packet.id },
      data: { status: "mailed" },
    });
  }

  await prisma.disputeItem.updateMany({
    where: { caseId: input.caseId, status: "queued" },
    data: { status: "mailed" },
  });

  await prisma.disputeCase.update({
    where: { id: input.caseId },
    data: { status: "investigating" },
  });

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "mail_queued_simulated",
      actor: input.actor,
      detailJson: JSON.stringify({
        packetIds: approved.map((p) => p.id),
        note: "Certified mail integration (Lob) is Phase 2 — status advanced for workflow demo.",
      }),
    },
  });

  return getCaseBundle(input.caseId);
}
