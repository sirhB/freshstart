import { NextResponse } from "next/server";
import { listCases } from "@/lib/cases";
import { buildExceptionInbox } from "@/lib/dispute/exceptions";
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

export async function GET() {
  const cases = await listCases();

  const withEvidence = await Promise.all(
    cases.map(async (c) => {
      const [items, evidence] = await Promise.all([
        prisma.disputeItem.findMany({ where: { caseId: c.id } }),
        prisma.evidenceDocument.findMany({ where: { caseId: c.id } }),
      ]);
      const classified: ClassifiedDisputeItem[] = items.map((item) => ({
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
      const coach = buildEvidenceCoach(classified, evidence);
      const mailGate = mailBlockedByEvidence(
        coach.filter((x) =>
          items.some(
            (i) =>
              i.id === x.itemId &&
              ["approved", "queued", "proposed"].includes(i.status),
          ),
        ),
      );
      return {
        id: c.id,
        title: c.title,
        consumerName: c.consumer.fullName,
        investigationDueAt: c.investigationDueAt,
        approvals: c.approvals.map((a) => ({
          id: a.id,
          gateType: a.gateType,
          status: a.status ?? "pending",
          createdAt: a.createdAt,
        })),
        evidenceBlocked:
          mailGate.blocked &&
          ["pending_packet_approval", "mailing"].includes(c.status),
      };
    }),
  );

  const exceptions = buildExceptionInbox({ cases: withEvidence });
  return NextResponse.json({ exceptions });
}
