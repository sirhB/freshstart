import { prisma } from "@/lib/db";
import type { Bureau, ClassifiedDisputeItem, ConsumerIdentity } from "@/lib/domain/types";
import { classifyTradelines } from "@/lib/dispute/classify";
import { matchEvidenceToItems } from "@/lib/dispute/evidence";
import { resolveFurnisherAddress } from "@/lib/dispute/furnishers";
import { buildDisputePacket } from "@/lib/dispute/letters";
import {
  classifyResponseText,
  itemStatusForOutcome,
  type OutcomeCode,
} from "@/lib/dispute/outcomes";
import type { TradelineInput } from "@/lib/domain/types";
import { getCaseBundle } from "@/lib/cases";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function notify(input: {
  consumerId: string;
  caseId: string;
  title: string;
  body: string;
  channel?: "in_app" | "email_stub";
}) {
  await prisma.notification.create({
    data: {
      consumerId: input.consumerId,
      caseId: input.caseId,
      title: input.title,
      body: input.body,
      channel: input.channel ?? "in_app",
    },
  });
  if (input.channel === "email_stub" || !input.channel) {
    // Stub: also write audit for email send
    await prisma.auditLog.create({
      data: {
        caseId: input.caseId,
        action: "notification_email_stub",
        actor: "system",
        detailJson: JSON.stringify({ title: input.title, body: input.body }),
      },
    });
  }
}

export async function createCaseFromTradelines(input: {
  consumer: ConsumerIdentity & { email?: string };
  /** Reuse an existing consumer (next wave) instead of creating a new one. */
  consumerId?: string;
  tradelines: TradelineInput[];
  title?: string;
  reportDate?: string;
  waveNumber?: number;
  parentCaseId?: string;
  asOf?: Date;
}) {
  const consumer = input.consumerId
    ? await prisma.consumer.update({
        where: { id: input.consumerId },
        data: {
          fullName: input.consumer.fullName,
          addressLine1: input.consumer.addressLine1,
          cityStateZip: input.consumer.cityStateZip,
        },
      })
    : await prisma.consumer.create({
        data: {
          fullName: input.consumer.fullName,
          addressLine1: input.consumer.addressLine1,
          cityStateZip: input.consumer.cityStateZip,
          dateOfBirth: input.consumer.dateOfBirth,
          phone: input.consumer.phone,
          email: input.consumer.email,
          ssnLast4: input.consumer.ssnLast4,
        },
      });

  const report = await prisma.creditReport.create({
    data: {
      consumerId: consumer.id,
      reportDate: input.reportDate ?? new Date().toLocaleDateString("en-US"),
      sourceLabel: "Uploaded / parsed report",
    },
  });

  for (const t of input.tradelines) {
    const resolved = t.furnisherName
      ? resolveFurnisherAddress(t.furnisherName)
      : resolveFurnisherAddress(t.creditor);
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
        furnisherName: t.furnisherName ?? resolved?.name ?? t.creditor,
        furnisherAddress:
          t.furnisherAddress ?? resolved?.addressLines.join("\n"),
        bureausJson: JSON.stringify(t.bureaus),
        rawNotes: t.rawNotes,
      },
    });
  }

  const classified = classifyTradelines(input.tradelines, {
    asOf: input.asOf ?? new Date(),
  });

  const disputeCase = await prisma.disputeCase.create({
    data: {
      consumerId: consumer.id,
      title: input.title ?? `Wave ${input.waveNumber ?? 1} — ${consumer.fullName}`,
      status: "pending_plan_approval",
      waveNumber: input.waveNumber ?? 1,
      parentCaseId: input.parentCaseId,
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
        evidenceNotes: item.evidenceNotes,
        riskFlagsJson: JSON.stringify(item.riskFlags),
        status: "proposed",
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

  // Draft packets for recommended set (operator rebuilds on plan approve)
  const letters = buildDisputePacket({
    consumer: input.consumer,
    items: classified.filter((c) => c.recommended),
    asOf: input.asOf ?? new Date(),
  });
  for (const letter of letters) {
    await prisma.letterPacket.create({
      data: {
        caseId: disputeCase.id,
        recipientType: letter.recipient.type,
        recipientName:
          letter.recipient.type === "cra"
            ? letter.recipient.bureau
            : letter.recipient.name,
        bureau: letter.recipient.type === "cra" ? letter.recipient.bureau : null,
        status: "draft",
        bodyText: letter.body,
        lintPassed: letter.lintPassed,
        lintIssuesJson: JSON.stringify(letter.lintIssues),
        itemIdsJson: JSON.stringify(letter.itemIds),
      },
    });
  }

  await notify({
    consumerId: consumer.id,
    caseId: disputeCase.id,
    title: "Dispute plan ready for review",
    body: `${classified.filter((c) => c.recommended).length} items recommended for wave ${disputeCase.waveNumber}.`,
  });

  await prisma.auditLog.create({
    data: {
      caseId: disputeCase.id,
      action: "case_created_from_tradelines",
      actor: "system",
      detailJson: JSON.stringify({
        tradelineCount: input.tradelines.length,
        recommended: classified.filter((c) => c.recommended).length,
      }),
    },
  });

  return getCaseBundle(disputeCase.id);
}

export async function attachEvidence(input: {
  consumerId: string;
  caseId: string;
  label: string;
  kind: string;
  storageKey: string;
  matchedAccountHint?: string;
  itemId?: string;
}) {
  const doc = await prisma.evidenceDocument.create({
    data: {
      consumerId: input.consumerId,
      caseId: input.caseId,
      itemId: input.itemId,
      label: input.label,
      kind: input.kind,
      storageKey: input.storageKey,
      matchedAccountHint: input.matchedAccountHint,
    },
  });

  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
    include: { items: true },
  });
  if (!disputeCase) return { doc, matches: [] };

  const items: ClassifiedDisputeItem[] = disputeCase.items.map((item) => ({
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
    riskFlags: parseJson(item.riskFlagsJson, []),
  }));

  const allEvidence = await prisma.evidenceDocument.findMany({
    where: { caseId: input.caseId },
  });
  const matches = matchEvidenceToItems(items, allEvidence);

  // Boost confidence slightly when strong evidence matches
  for (const m of matches) {
    if (m.score >= 0.4) {
      const item = disputeCase.items.find((i) => i.id === m.itemId);
      if (!item) continue;
      const boost = m.score >= 0.75 ? 0.08 : 0.04;
      await prisma.disputeItem.update({
        where: { id: item.id },
        data: {
          confidence: Math.min(0.99, item.confidence + boost),
          evidenceNotes: [item.evidenceNotes, ...m.notes].filter(Boolean).join(" · "),
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "evidence_attached",
      actor: "system",
      detailJson: JSON.stringify({ evidenceId: doc.id, matches }),
    },
  });

  return { doc, matches };
}

export async function recordOutcomes(input: {
  caseId: string;
  actor: string;
  results: { itemId: string; outcome: OutcomeCode; notes?: string }[];
  responseText?: string;
}) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
  });
  if (!disputeCase) throw new Error("Case not found");

  for (const r of input.results) {
    await prisma.outcomeEvent.create({
      data: {
        caseId: input.caseId,
        itemId: r.itemId,
        outcome: r.outcome,
        notes: r.notes,
      },
    });
    await prisma.disputeItem.update({
      where: { id: r.itemId },
      data: { status: itemStatusForOutcome(r.outcome) },
    });
  }

  await notify({
    consumerId: disputeCase.consumerId,
    caseId: input.caseId,
    title: "Investigation results recorded",
    body: `${input.results.length} item outcome(s) saved.`,
  });

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "outcomes_recorded",
      actor: input.actor,
      detailJson: JSON.stringify({
        results: input.results,
        responsePreview: input.responseText?.slice(0, 300),
      }),
    },
  });

  // Auto-open outcome exception gate for verified/frivolous
  const needsHuman = input.results.filter((r) =>
    ["verified", "frivolous", "reinserted"].includes(r.outcome),
  );
  if (needsHuman.length > 0) {
    await prisma.approvalGate.create({
      data: {
        caseId: input.caseId,
        gateType: "outcome_exception",
        status: "pending",
        payloadJson: JSON.stringify({ items: needsHuman }),
      },
    });
  }

  return getCaseBundle(input.caseId);
}

export async function classifyAndRecordResponse(input: {
  caseId: string;
  itemId: string;
  actor: string;
  responseText: string;
}) {
  const classified = classifyResponseText(input.responseText);
  return recordOutcomes({
    caseId: input.caseId,
    actor: input.actor,
    responseText: input.responseText,
    results: [
      {
        itemId: input.itemId,
        outcome: classified.outcome,
        notes: `${classified.summary} (confidence ${(classified.confidence * 100).toFixed(0)}%)`,
      },
    ],
  });
}

/** Watch for reinsertion: deleted items that reappear on a new tradeline list. */
export function detectReinsertions(input: {
  previouslyDeleted: { creditor: string; accountNumber?: string | null }[];
  currentTradelines: TradelineInput[];
}): TradelineInput[] {
  return input.currentTradelines.filter((t) => {
    const last4 = t.accountNumber?.replace(/\D/g, "").slice(-4);
    return input.previouslyDeleted.some((d) => {
      const d4 = d.accountNumber?.replace(/\D/g, "").slice(-4);
      const sameCreditor =
        d.creditor.toLowerCase().includes(t.creditor.toLowerCase().slice(0, 8)) ||
        t.creditor.toLowerCase().includes(d.creditor.toLowerCase().slice(0, 8));
      return sameCreditor && (!!last4 && !!d4 ? last4 === d4 : sameCreditor);
    });
  });
}

export async function openNextWave(input: {
  caseId: string;
  actor: string;
  /** Optional fresh tradelines (e.g. after re-pull). Defaults to remaining unresolved from prior. */
  tradelines?: TradelineInput[];
}) {
  const prior = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
    include: { consumer: true, items: true },
  });
  if (!prior) throw new Error("Case not found");

  const remaining = prior.items.filter(
    (i) =>
      !["resolved_deleted", "resolved_corrected", "denied"].includes(i.status),
  );

  // Prefer items that were deferred or verified for a new strategy wave
  const seedTradelines: TradelineInput[] =
    input.tradelines ??
    prior.items
      .filter(
        (i) =>
          i.status === "resolved_verified" ||
          i.status === "proposed" ||
          parseJson<string[]>(i.riskFlagsJson, []).includes("deferred_to_next_wave"),
      )
      .map((i) => ({
        id: `wave${prior.waveNumber + 1}_${i.tradelineId ?? i.id}`,
        creditor: i.creditor,
        accountNumber: i.accountNumber ?? undefined,
        accountType: i.accountType,
        status: i.statusReported,
        balance: i.balance ?? undefined,
        dateOpened: i.dateOpened ?? undefined,
        furnisherName: i.furnisherName ?? undefined,
        furnisherAddress: i.furnisherAddress ?? undefined,
        bureaus: parseJson<Bureau[]>(i.bureausJson, []),
        signals: {
          hasSupportingEvidence: Boolean(i.evidenceNotes),
          paymentRecordsConflict: i.groundCode === "INACCURATE_STATUS",
          notMine: i.groundCode === "NOT_MINE",
          unauthorizedInquiry: i.groundCode === "UNAUTHORIZED_INQUIRY",
          medicalUnderThreshold: i.groundCode === "MEDICAL_SPECIAL",
        },
      }));

  if (seedTradelines.length === 0) {
    await prisma.disputeCase.update({
      where: { id: input.caseId },
      data: { status: "closed", closedReason: "No actionable items for next wave" },
    });
    await notify({
      consumerId: prior.consumerId,
      caseId: input.caseId,
      title: "Case closed",
      body: "No remaining actionable dispute items.",
    });
    return getCaseBundle(input.caseId);
  }

  await prisma.disputeCase.update({
    where: { id: input.caseId },
    data: { status: "closed", closedReason: `Superseded by wave ${prior.waveNumber + 1}` },
  });

  const next = await createCaseFromTradelines({
    consumerId: prior.consumerId,
    consumer: {
      fullName: prior.consumer.fullName,
      addressLine1: prior.consumer.addressLine1,
      cityStateZip: prior.consumer.cityStateZip,
      dateOfBirth: prior.consumer.dateOfBirth ?? undefined,
      phone: prior.consumer.phone ?? undefined,
      email: prior.consumer.email ?? undefined,
      ssnLast4: prior.consumer.ssnLast4 ?? undefined,
    },
    tradelines: seedTradelines,
    waveNumber: prior.waveNumber + 1,
    parentCaseId: prior.id,
    title: `Wave ${prior.waveNumber + 1} — ${prior.consumer.fullName}`,
  });

  await prisma.auditLog.create({
    data: {
      caseId: next?.id,
      action: "next_wave_opened",
      actor: input.actor,
      detailJson: JSON.stringify({
        fromCaseId: input.caseId,
        remainingHint: remaining.length,
      }),
    },
  });

  return next;
}

export async function listNotifications(consumerId: string) {
  return prisma.notification.findMany({
    where: { consumerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

export async function seedFurnisherDirectory() {
  const { FURNISHER_DIRECTORY } = await import("@/lib/dispute/furnishers");
  for (const f of FURNISHER_DIRECTORY) {
    await prisma.furnisherAddress.upsert({
      where: { name: f.name },
      create: {
        name: f.name,
        addressLines: f.addressLines.join("\n"),
        source: "manual",
        verifiedAt: new Date(),
      },
      update: {
        addressLines: f.addressLines.join("\n"),
        verifiedAt: new Date(),
      },
    });
  }
  return prisma.furnisherAddress.findMany({ orderBy: { name: "asc" } });
}

export async function listFurnishers() {
  return prisma.furnisherAddress.findMany({ orderBy: { name: "asc" } });
}

/** Apply evidence matching then optionally auto-decide plan for hands-free waves. */
export async function runHandsFreeWave(input: {
  caseId: string;
  actor: string;
  overrideFirstWave?: boolean;
}) {
  const { applyAutoApprovePlan, queueMail, simulateDeliver } = await import("@/lib/cases");
  const afterPlan = await applyAutoApprovePlan({
    caseId: input.caseId,
    actor: input.actor,
    overrideFirstWave: input.overrideFirstWave ?? true,
  });
  if (!afterPlan) return null;

  const approvedPackets = afterPlan.packets.filter((p) => p.status === "approved");
  if (approvedPackets.length === 0) return afterPlan;

  await queueMail({ caseId: afterPlan.id, actor: input.actor });
  return simulateDeliver({ caseId: afterPlan.id, actor: input.actor });
}
