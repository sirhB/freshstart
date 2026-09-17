import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildCfpbComplaintPack,
  buildConsumerStatement,
} from "@/lib/dispute/statements";
import { renderLetterPdf } from "@/lib/dispute/pdf";
import type { Bureau, ClassifiedDisputeItem } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

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
  riskFlagsJson: string;
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
    riskFlags: parseJson(item.riskFlagsJson, []),
  };
}

/** GET ?itemId=&format=txt|pdf — consumer statement for a verified item */
export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  const format = url.searchParams.get("format") ?? "txt";
  const pack = url.searchParams.get("pack"); // "cfpb" for complaint pack

  const disputeCase = await prisma.disputeCase.findUnique({
    where: { id: caseId },
    include: {
      consumer: true,
      items: true,
      auditLogs: { orderBy: { createdAt: "asc" }, take: 80 },
    },
  });
  if (!disputeCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const consumer = {
    fullName: disputeCase.consumer.fullName,
    addressLine1: disputeCase.consumer.addressLine1,
    cityStateZip: disputeCase.consumer.cityStateZip,
    phone: disputeCase.consumer.phone ?? undefined,
  };

  if (pack === "cfpb") {
    const items = disputeCase.items.map(toClassified);
    const text = buildCfpbComplaintPack({
      consumer,
      caseTitle: disputeCase.title,
      caseId: disputeCase.id,
      items,
      timeline: disputeCase.auditLogs.map((l) => ({
        at: l.createdAt.toISOString().slice(0, 10),
        action: l.action,
        detail: l.detailJson ?? undefined,
      })),
    });
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="cfpb-pack-${caseId}.txt"`,
      },
    });
  }

  if (!itemId) {
    return NextResponse.json({ error: "itemId or pack=cfpb required" }, { status: 400 });
  }

  const item = disputeCase.items.find((i) => i.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const verified =
    item.status === "resolved_verified" ||
    (await prisma.outcomeEvent.findFirst({
      where: { itemId, outcome: "verified" },
    }));
  if (!verified) {
    return NextResponse.json(
      { error: "Consumer statement is available after a verified outcome" },
      { status: 400 },
    );
  }

  const text = buildConsumerStatement({
    consumer,
    item: toClassified(item),
  });

  if (format === "pdf") {
    const pdf = await renderLetterPdf({
      recipientName: "Consumer file statement",
      recipientType: "cra",
      bodyText: text,
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement-${item.creditor.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"`,
      },
    });
  }

  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="statement-${itemId}.txt"`,
    },
  });
}
