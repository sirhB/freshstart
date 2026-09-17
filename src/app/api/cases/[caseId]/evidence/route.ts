import { NextResponse } from "next/server";
import { attachEvidence } from "@/lib/workflow";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const evidence = await prisma.evidenceDocument.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ evidence });
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
