import { prisma } from "@/lib/db";
import type { Bureau, ClassifiedDisputeItem, ConsumerIdentity } from "@/lib/domain/types";
import {
  canAutoApprovePacket,
  evaluateAutoApprove,
} from "@/lib/dispute/auto-approve";
import { renderAnnotatedExcerptPdf } from "@/lib/dispute/annotate";
import {
  buildEvidenceCoach,
  mailBlockedByEvidence,
  type EvidenceCoachItem,
} from "@/lib/dispute/evidence-coach";
import {
  addDays,
  investigationDueFromDelivery,
  simulateTrackingNumber,
} from "@/lib/dispute/investigation";
import { rankDisputeItems, suggestWave } from "@/lib/dispute/impact";
import { findCrossBureauConflicts } from "@/lib/dispute/furnishers";
import { applyLintToLetter, lintLetter } from "@/lib/dispute/lint";
import { buildDisputePacket } from "@/lib/dispute/letters";
import { createNotification } from "@/lib/notifications";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toClassified(item: {
  id: string;
  tradelineId: string | null;
  creditor: string;
  accountNumber: string | null;
  accountType: string;
  statusReported: string;
  balance: string | null;
  dateOpened: string | null;
  furnisherName: string | null;
  furnisherAddress: string | null;
  bureausJson: string;
  groundCode: string;
  groundRationale: string;
  remedy: string;
  confidence: number;
  recommended: boolean;
  evidenceNotes: string | null;
  riskFlagsJson?: string;
}): ClassifiedDisputeItem {
  return {
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
    recommended: item.recommended,
    evidenceNotes: item.evidenceNotes ?? undefined,
    riskFlags: parseJson(item.riskFlagsJson ?? "[]", []),
  };
}

async function loadEvidenceCoach(caseId: string, items: ClassifiedDisputeItem[]) {
  const evidence = await prisma.evidenceDocument.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
  const coach = buildEvidenceCoach(
    items,
    evidence.map((e) => ({
      id: e.id,
      label: e.label,
      kind: e.kind,
      matchedAccountHint: e.matchedAccountHint,
    })),
  );
  return { evidence, coach, mailGate: mailBlockedByEvidence(coach) };
}

function conflictRowsFromItems(items: ClassifiedDisputeItem[]) {
  const rows: {
    creditor: string;
    accountNumber?: string;
    status: string;
    balance?: string;
    dateOpened?: string;
    bureau: Bureau;
  }[] = [];
  for (const item of items) {
    for (const bureau of item.bureaus) {
      rows.push({
        creditor: item.creditor,
        accountNumber: item.accountNumber,
        status: item.statusReported,
        balance: item.balance,
        dateOpened: item.dateOpened,
        bureau,
      });
    }
  }
  return rows;
}

/** Ensure an annotated report-excerpt evidence doc exists for approved items. */
export async function ensureAnnotatedExcerptEvidence(input: {
  caseId: string;
  consumerId: string;
  consumer: ConsumerIdentity;
  items: ClassifiedDisputeItem[];
}) {
  if (input.items.length === 0) return null;

  const existing = await prisma.evidenceDocument.findFirst({
    where: { caseId: input.caseId, kind: "report_excerpt" },
  });
  if (existing) return existing;

  const pdf = await renderAnnotatedExcerptPdf({
    consumer: input.consumer,
    items: input.items,
  });
  const storageKey = `annotated://${input.caseId}/${Date.now()}.pdf`;

  // Store stub key; PDF is regenerated on download. Keep buffer size out of SQLite.
  void pdf;

  return prisma.evidenceDocument.create({
    data: {
      consumerId: input.consumerId,
      caseId: input.caseId,
      label: "Annotated credit report excerpt",
      kind: "report_excerpt",
      storageKey,
    },
  });
}

function relintPacketBody(input: {
  consumer: ConsumerIdentity;
  items: ClassifiedDisputeItem[];
  body: string;
  coach: EvidenceCoachItem[];
}) {
  const enclosureMatch = input.body.match(/Enclosures?:\n([\s\S]*?)(?:\n\n|$)/i);
  const enclosureList = enclosureMatch
    ? enclosureMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-•\d.)\s]+/, "").trim())
        .filter(Boolean)
    : ["Annotated credit report excerpt"];

  const lintIssues = lintLetter({
    consumer: input.consumer,
    items: input.items,
    body: input.body,
    enclosureList,
    evidenceCoach: input.coach,
  });
  return applyLintToLetter({
    recipient: { type: "cra", bureau: "Equifax" },
    subject: "",
    body: input.body,
    enclosureList,
    itemIds: input.items.map((i) => i.id),
    lintIssues,
    lintPassed: false,
  });
}

export async function getCaseBundle(caseId: string) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: caseId },
    include: {
      consumer: true,
      items: { orderBy: { confidence: "desc" } },
      packets: { orderBy: { createdAt: "asc" } },
      approvals: { orderBy: { createdAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 40 },
      evidence: { orderBy: { createdAt: "desc" } },
      outcomes: { orderBy: { createdAt: "desc" }, take: 40 },
      reinsertionChecks: { orderBy: { dueAt: "asc" } },
      notifications: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!disputeCase) return null;

  const items = disputeCase.items.map((item) => ({
    ...item,
    bureaus: parseJson<Bureau[]>(item.bureausJson, []),
    riskFlags: parseJson<string[]>(item.riskFlagsJson, []),
  }));

  const classified = items.map((i) =>
    toClassified({
      ...i,
      tradelineId: i.tradelineId ?? null,
      accountNumber: i.accountNumber ?? null,
      balance: i.balance ?? null,
      dateOpened: i.dateOpened ?? null,
      furnisherName: i.furnisherName ?? null,
      furnisherAddress: i.furnisherAddress ?? null,
      bureausJson: JSON.stringify(i.bureaus),
      evidenceNotes: i.evidenceNotes ?? null,
      riskFlagsJson: JSON.stringify(i.riskFlags ?? []),
    }),
  );

  const coach = buildEvidenceCoach(
    classified,
    disputeCase.evidence.map((e) => ({
      id: e.id,
      label: e.label,
      kind: e.kind,
      matchedAccountHint: e.matchedAccountHint,
    })),
  );
  // Only gate mailing on items that are in-play (recommended / approved / queued).
  const mailCoach = coach.filter((c) => {
    const row = disputeCase.items.find((x) => x.id === c.itemId);
    const status = row?.status ?? "proposed";
    const classifiedItem = classified.find((i) => i.id === c.itemId);
    return (
      Boolean(classifiedItem?.recommended) ||
      ["approved", "queued", "mailed", "investigating"].includes(status)
    );
  });
  const mailGate = mailBlockedByEvidence(mailCoach);
  const ranked = rankDisputeItems(classified, coach);
  const suggestedWave = suggestWave(ranked, 5);
  const conflicts = findCrossBureauConflicts(conflictRowsFromItems(classified));

  return {
    ...disputeCase,
    items,
    packets: disputeCase.packets.map((p) => ({
      ...p,
      lintIssues: parseJson(p.lintIssuesJson, []),
      itemIds: parseJson<string[]>(p.itemIdsJson, []),
    })),
    approvals: disputeCase.approvals.map((a) => ({
      ...a,
      payload: parseJson(a.payloadJson ?? "{}", {}),
    })),
    evidenceCoach: coach,
    mailBlocked: mailGate.blocked,
    mailBlockedMessages: mailGate.messages.slice(0, 5),
    mailBlockedCount: mailGate.messages.length,
    impactRanking: ranked.map((r) => ({
      itemId: r.item.id,
      impact: r.impact,
      winnability: r.winnability,
      evidenceStrength: r.evidenceStrength,
      score: r.score,
      rationale: r.rationale,
    })),
    suggestedWaveIds: suggestedWave.map((r) => r.item.id),
    conflicts,
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
        select: { id: true, gateType: true, createdAt: true, status: true },
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
  ).map(toClassified);

  const consumer: ConsumerIdentity = {
    fullName: disputeCase.consumer.fullName,
    addressLine1: disputeCase.consumer.addressLine1,
    cityStateZip: disputeCase.consumer.cityStateZip,
    dateOfBirth: disputeCase.consumer.dateOfBirth ?? undefined,
    phone: disputeCase.consumer.phone ?? undefined,
    ssnLast4: disputeCase.consumer.ssnLast4 ?? undefined,
  };

  await ensureAnnotatedExcerptEvidence({
    caseId: input.caseId,
    consumerId: disputeCase.consumerId,
    consumer,
    items: approvedItems,
  });

  const { coach } = await loadEvidenceCoach(input.caseId, approvedItems);

  // Rebuild packets from approved items only
  await prisma.letterPacket.deleteMany({ where: { caseId: input.caseId } });

  const letters = buildDisputePacket({
    consumer,
    items: approvedItems,
    includeFurnisherLetters: true,
  }).map((letter) => {
    const packetItems = approvedItems.filter((i) => letter.itemIds.includes(i.id));
    const relinted = relintPacketBody({
      consumer,
      items: packetItems,
      body: letter.body,
      coach,
    });
    return {
      ...letter,
      lintIssues: relinted.lintIssues,
      lintPassed: relinted.lintPassed,
    };
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

  if (mailBlockedByEvidence(coach).blocked) {
    await createNotification({
      consumerId: disputeCase.consumerId,
      caseId: input.caseId,
      title: "Evidence needed before mailing",
      body: mailBlockedByEvidence(coach).messages.join(" "),
    });
  }

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
    include: {
      case: { include: { consumer: true, items: true } },
    },
  });
  if (!packet) throw new Error("Packet not found");

  if (input.decision === "approved" && !packet.lintPassed) {
    throw new Error("Cannot approve a packet that failed the compliance linter");
  }

  if (input.decision === "approved") {
    const itemIds = parseJson<string[]>(packet.itemIdsJson, []);
    const items = packet.case.items
      .filter((i) => itemIds.includes(i.id))
      .map(toClassified);
    const { coach, mailGate } = await loadEvidenceCoach(packet.caseId, items);
    if (mailGate.blocked) {
      throw new Error(
        `Required evidence missing: ${mailGate.messages.join("; ")}`,
      );
    }
    // Refresh lint with coach (should pass if evidence complete)
    const consumer: ConsumerIdentity = {
      fullName: packet.case.consumer.fullName,
      addressLine1: packet.case.consumer.addressLine1,
      cityStateZip: packet.case.consumer.cityStateZip,
    };
    const relinted = relintPacketBody({
      consumer,
      items,
      body: packet.bodyText,
      coach,
    });
    if (!relinted.lintPassed) {
      await prisma.letterPacket.update({
        where: { id: packet.id },
        data: {
          lintPassed: false,
          lintIssuesJson: JSON.stringify(relinted.lintIssues),
          status: "draft",
        },
      });
      throw new Error("Cannot approve a packet that failed the compliance linter");
    }
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
  /** Simulate delivery N days after mail (default 3) for investigation clock. */
  simulateDeliveryDays?: number;
}) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
    include: { items: true, consumer: true },
  });
  if (!disputeCase) throw new Error("Case not found");

  const approved = await prisma.letterPacket.findMany({
    where: { caseId: input.caseId, status: "approved" },
  });

  if (approved.length === 0) {
    throw new Error("No approved packets to mail");
  }

  const queuedItems = disputeCase.items
    .filter((i) => i.status === "queued" || i.status === "approved" || i.status === "mailed")
    .map(toClassified);
  const { mailGate } = await loadEvidenceCoach(
    input.caseId,
    queuedItems.length > 0
      ? queuedItems
      : disputeCase.items.filter((i) => i.status !== "denied").map(toClassified),
  );
  if (mailGate.blocked) {
    await createNotification({
      consumerId: disputeCase.consumerId,
      caseId: input.caseId,
      title: "Mail blocked — evidence required",
      body: mailGate.messages.join(" "),
    });
    throw new Error(`Mail blocked: ${mailGate.messages.join("; ")}`);
  }

  const now = new Date();
  const deliveryDays = input.simulateDeliveryDays ?? 3;
  const deliveredAt = addDays(now, deliveryDays);
  const dueAt = investigationDueFromDelivery(deliveredAt);

  for (const packet of approved) {
    const trackingNumber = simulateTrackingNumber(packet.id);
    await prisma.letterPacket.update({
      where: { id: packet.id },
      data: {
        status: "mailed",
        trackingNumber,
        mailedAt: now,
      },
    });
  }

  await prisma.disputeItem.updateMany({
    where: { caseId: input.caseId, status: "queued" },
    data: { status: "mailed" },
  });

  await prisma.disputeCase.update({
    where: { id: input.caseId },
    data: {
      status: "investigating",
      investigationStartedAt: now,
      investigationDueAt: dueAt,
    },
  });

  await createNotification({
    consumerId: disputeCase.consumerId,
    caseId: input.caseId,
    title: "Letters queued for certified mail",
    body: `${approved.length} packet(s) mailed (simulated). Investigation due ${dueAt.toLocaleDateString()}.`,
  });

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "mail_queued_simulated",
      actor: input.actor,
      detailJson: JSON.stringify({
        packetIds: approved.map((p) => p.id),
        expectedDeliveryDays: deliveryDays,
        investigationDueAt: dueAt.toISOString(),
        note: "Certified mail via Lob is Phase 2 — tracking numbers are simulated.",
      }),
    },
  });

  return getCaseBundle(input.caseId);
}

/** Mark mailed packets delivered and start/refresh the FCRA investigation clock. */
export async function simulateDeliver(input: {
  caseId: string;
  actor: string;
}) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
  });
  if (!disputeCase) throw new Error("Case not found");

  const mailed = await prisma.letterPacket.findMany({
    where: { caseId: input.caseId, status: "mailed" },
  });
  if (mailed.length === 0) {
    throw new Error("No mailed packets to mark delivered");
  }

  const now = new Date();
  const dueAt = investigationDueFromDelivery(now);

  for (const packet of mailed) {
    await prisma.letterPacket.update({
      where: { id: packet.id },
      data: {
        status: "delivered",
        deliveredAt: now,
        returnReceiptAt: now,
      },
    });
  }

  await prisma.disputeItem.updateMany({
    where: { caseId: input.caseId, status: "mailed" },
    data: { status: "investigating" },
  });

  await prisma.disputeCase.update({
    where: { id: input.caseId },
    data: {
      status: "investigating",
      investigationStartedAt: now,
      investigationDueAt: dueAt,
    },
  });

  await createNotification({
    consumerId: disputeCase.consumerId,
    caseId: input.caseId,
    title: "Mail delivered — investigation clock started",
    body: `FCRA investigation window ends ${dueAt.toLocaleDateString()}.`,
  });

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "mail_delivered_simulated",
      actor: input.actor,
      detailJson: JSON.stringify({
        packetIds: mailed.map((p) => p.id),
        investigationDueAt: dueAt.toISOString(),
      }),
    },
  });

  return getCaseBundle(input.caseId);
}

/**
 * Apply auto-approve policy to a pending plan.
 * First wave defaults to human-required; later waves can clear high-confidence items.
 */
export async function applyAutoApprovePlan(input: {
  caseId: string;
  actor: string;
  /** Force evaluation even on wave 1 (operator override). */
  overrideFirstWave?: boolean;
}) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
    include: { items: true },
  });
  if (!disputeCase) throw new Error("Case not found");
  if (disputeCase.status !== "pending_plan_approval") {
    throw new Error("Case is not awaiting plan approval");
  }

  const classified = disputeCase.items.map(toClassified);

  const decisions = evaluateAutoApprove(classified, {
    waveNumber: input.overrideFirstWave ? 2 : disputeCase.waveNumber,
  });

  const planDecisions = decisions.map((d) => ({
    itemId: d.itemId,
    decision: (d.autoApprove ? "approved" : "denied") as "approved" | "denied",
    reason: d.reason,
  }));

  const result = await decidePlan({
    caseId: input.caseId,
    actor: input.actor,
    decisions: planDecisions,
  });

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "auto_approve_plan_applied",
      actor: input.actor,
      detailJson: JSON.stringify({ decisions, overrideFirstWave: input.overrideFirstWave }),
    },
  });

  // Auto-approve packets that clear policy + evidence
  if (result) {
    for (const packet of result.packets) {
      if (packet.status !== "pending_approval" || !packet.lintPassed) continue;
      const packetItems = result.items.filter((i) =>
        packet.itemIds.includes(i.id),
      );
      const classifiedPacket = packetItems.map((i) =>
        toClassified({
          ...i,
          tradelineId: i.tradelineId ?? null,
          accountNumber: i.accountNumber ?? null,
          balance: i.balance ?? null,
          dateOpened: i.dateOpened ?? null,
          furnisherName: i.furnisherName ?? null,
          furnisherAddress: i.furnisherAddress ?? null,
          bureausJson: JSON.stringify(i.bureaus),
          evidenceNotes: i.evidenceNotes ?? null,
          riskFlagsJson: JSON.stringify(i.riskFlags ?? []),
        }),
      );
      const packetCoach = (result.evidenceCoach ?? []).filter((c) =>
        packet.itemIds.includes(c.itemId),
      );
      const mailGate = mailBlockedByEvidence(packetCoach);
      const gate = canAutoApprovePacket({
        lintPassed: packet.lintPassed,
        items: classifiedPacket,
        waveNumber: input.overrideFirstWave ? 2 : disputeCase.waveNumber,
        evidenceBlocked: mailGate.blocked,
        evidenceMessages: mailGate.messages,
      });
      if (gate.ok) {
        await decidePacket({
          packetId: packet.id,
          actor: input.actor,
          decision: "approved",
          reason: gate.reason,
        });
      }
    }
  }

  return getCaseBundle(input.caseId);
}

export async function getPacket(packetId: string) {
  return prisma.letterPacket.findUnique({
    where: { id: packetId },
    include: {
      case: {
        include: {
          consumer: true,
          items: true,
        },
      },
    },
  });
}
