import { prisma } from "@/lib/db";
import type { Bureau, ClassifiedDisputeItem, ConsumerIdentity } from "@/lib/domain/types";
import { classifyTradelines } from "@/lib/dispute/classify";
import { matchEvidenceToItems } from "@/lib/dispute/evidence";
import { buildEvidenceCoach } from "@/lib/dispute/evidence-coach";
import { resolveFurnisherAddress } from "@/lib/dispute/furnishers";
import { addDays } from "@/lib/dispute/investigation";
import { buildDisputePacket } from "@/lib/dispute/letters";
import {
  classifyResponseText,
  itemStatusForOutcome,
  type OutcomeCode,
} from "@/lib/dispute/outcomes";
import type { TradelineInput } from "@/lib/domain/types";
import { getCaseBundle } from "@/lib/cases";
import {
  createNotification,
  listNotifications,
  markNotificationRead,
} from "@/lib/notifications";

export { createNotification, listNotifications, markNotificationRead };

const REINSERTION_OFFSET_DAYS = [30, 60, 90] as const;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
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

  await createNotification({
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
  if (!disputeCase) return { doc, matches: [], coach: [] };

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

  const coach = buildEvidenceCoach(
    items,
    allEvidence.map((e) => ({
      id: e.id,
      label: e.label,
      kind: e.kind,
      matchedAccountHint: e.matchedAccountHint,
    })),
  );

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      action: "evidence_attached",
      actor: "system",
      detailJson: JSON.stringify({ evidenceId: doc.id, matches }),
    },
  });

  return { doc, matches, coach };
}

export async function scheduleReinsertionChecks(input: {
  caseId: string;
  itemIds: string[];
  from?: Date;
}) {
  const from = input.from ?? new Date();
  const created = [];

  for (const itemId of input.itemIds) {
    const item = await prisma.disputeItem.findUnique({ where: { id: itemId } });
    const creditor = item?.creditor ?? "account";
    for (const days of REINSERTION_OFFSET_DAYS) {
      const check = await prisma.reinsertionCheck.create({
        data: {
          caseId: input.caseId,
          itemId,
          label: `${days}-day reinsertion check — ${creditor}`,
          dueAt: addDays(from, days),
          status: "scheduled",
        },
      });
      created.push(check);
    }
  }

  if (created.length > 0) {
    await prisma.auditLog.create({
      data: {
        caseId: input.caseId,
        action: "reinsertion_checks_scheduled",
        actor: "system",
        detailJson: JSON.stringify({
          itemIds: input.itemIds,
          checkIds: created.map((c) => c.id),
          offsets: [...REINSERTION_OFFSET_DAYS],
        }),
      },
    });
  }

  return created;
}

export async function listReinsertionChecks(caseId?: string) {
  return prisma.reinsertionCheck.findMany({
    where: caseId ? { caseId } : undefined,
    orderBy: { dueAt: "asc" },
  });
}

export async function runDueReinsertionChecks(now = new Date()) {
  const due = await prisma.reinsertionCheck.findMany({
    where: {
      status: "scheduled",
      dueAt: { lte: now },
    },
    include: { case: true },
  });

  const updated = [];
  for (const check of due) {
    const row = await prisma.reinsertionCheck.update({
      where: { id: check.id },
      data: { status: "due" },
    });
    updated.push(row);

    await createNotification({
      consumerId: check.case.consumerId,
      caseId: check.caseId,
      title: "Reinsertion check due",
      body: check.label,
    });
  }

  if (updated.length > 0) {
    await prisma.auditLog.create({
      data: {
        caseId: updated[0].caseId,
        action: "reinsertion_checks_marked_due",
        actor: "system",
        detailJson: JSON.stringify({
          checkIds: updated.map((c) => c.id),
          count: updated.length,
        }),
      },
    });
  }

  return updated;
}

export async function markReinsertionHit(input: {
  checkId: string;
  actor: string;
  notes?: string;
}) {
  const check = await prisma.reinsertionCheck.findUnique({
    where: { id: input.checkId },
    include: { case: true },
  });
  if (!check) throw new Error("Reinsertion check not found");

  const updated = await prisma.reinsertionCheck.update({
    where: { id: input.checkId },
    data: {
      status: "hit",
      completedAt: new Date(),
      notes: input.notes,
    },
  });

  if (check.itemId) {
    await prisma.outcomeEvent.create({
      data: {
        caseId: check.caseId,
        itemId: check.itemId,
        outcome: "reinserted",
        notes: input.notes ?? "Reinsertion watchdog hit",
      },
    });
    await prisma.disputeItem.update({
      where: { id: check.itemId },
      data: { status: itemStatusForOutcome("reinserted") },
    });
  }

  await prisma.approvalGate.create({
    data: {
      caseId: check.caseId,
      gateType: "outcome_exception",
      status: "pending",
      payloadJson: JSON.stringify({
        reason: "reinsertion_hit",
        checkId: check.id,
        itemId: check.itemId,
        notes: input.notes,
      }),
    },
  });

  await createNotification({
    consumerId: check.case.consumerId,
    caseId: check.caseId,
    title: "Reinsertion detected — review required",
    body: check.label,
  });

  await prisma.auditLog.create({
    data: {
      caseId: check.caseId,
      action: "reinsertion_hit",
      actor: input.actor,
      detailJson: JSON.stringify({
        checkId: check.id,
        itemId: check.itemId,
        notes: input.notes,
      }),
    },
  });

  return { check: updated, case: await getCaseBundle(check.caseId) };
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

  const wins = input.results.filter((r) =>
    ["deleted", "corrected"].includes(r.outcome),
  );
  if (wins.length > 0) {
    await scheduleReinsertionChecks({
      caseId: input.caseId,
      itemIds: wins.map((w) => w.itemId),
    });
  }

  await createNotification({
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

  // Auto-open outcome exception gate for verified/frivolous/reinserted
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
    await createNotification({
      consumerId: disputeCase.consumerId,
      caseId: input.caseId,
      title: "Outcome exception needs review",
      body: `${needsHuman.length} item(s) require a human decision (verified / frivolous / reinserted).`,
    });
  }

  return getCaseBundle(input.caseId);
}

export async function classifyAndRecordResponse(input: {
  caseId: string;
  itemId: string;
  actor: string;
  responseText: string;
  /** When false, skip attaching response_letter evidence. Default true. */
  attachResponseLetter?: boolean;
  storageKey?: string;
}) {
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: input.caseId },
  });
  if (!disputeCase) throw new Error("Case not found");

  if (input.attachResponseLetter !== false) {
    await attachEvidence({
      consumerId: disputeCase.consumerId,
      caseId: input.caseId,
      itemId: input.itemId,
      label: "Bureau / furnisher response letter",
      kind: "response_letter",
      storageKey:
        input.storageKey ??
        `response://${input.caseId}/${input.itemId}/${Date.now()}`,
      matchedAccountHint: input.itemId,
    });
  }

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
    await createNotification({
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
