import { NextResponse } from "next/server";
import { attachEvidence } from "@/lib/workflow";
import { prisma } from "@/lib/db";
import { buildEvidenceCoach, mailBlockedByEvidence } from "@/lib/dispute/evidence-coach";
import type { Bureau, ClassifiedDisputeItem } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: caseId },
    include: { items: true, evidence: { orderBy: { createdAt: "desc" } } },
  });
  if (!disputeCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

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

  const coach = buildEvidenceCoach(items, disputeCase.evidence);
  const mailGate = mailBlockedByEvidence(coach);

  return NextResponse.json({
    evidence: disputeCase.evidence,
    evidenceCoach: coach,
    mailBlocked: mailGate.blocked,
    mailBlockedMessages: mailGate.messages,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const body = (await request.json()) as {
    consumerId?: string;
    label?: string;
    kind?: string;
    storageKey?: string;
    matchedAccountHint?: string;
    itemId?: string;
  };

  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: caseId },
  });
  if (!disputeCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (!body.label || !body.kind) {
    return NextResponse.json({ error: "label and kind required" }, { status: 400 });
  }

  const result = await attachEvidence({
    consumerId: body.consumerId ?? disputeCase.consumerId,
    caseId,
    label: body.label,
    kind: body.kind,
    storageKey: body.storageKey ?? `stub://${body.label}`,
    matchedAccountHint: body.matchedAccountHint,
    itemId: body.itemId,
  });

  return NextResponse.json(result);
}
