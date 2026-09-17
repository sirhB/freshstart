import { NextResponse } from "next/server";
import { getPacket } from "@/lib/cases";
import { renderAnnotatedExcerptPdf } from "@/lib/dispute/annotate";
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
  context: { params: Promise<{ packetId: string }> },
) {
  const { packetId } = await context.params;
  const packet = await getPacket(packetId);
  if (!packet || !packet.case) {
    return NextResponse.json({ error: "Packet not found" }, { status: 404 });
  }

  const itemIds = parseJson<string[]>(packet.itemIdsJson, []);
  const items: ClassifiedDisputeItem[] = packet.case.items
    .filter((i) => itemIds.includes(i.id))
    .map((item) => ({
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

  const pdf = await renderAnnotatedExcerptPdf({
    consumer: {
      fullName: packet.case.consumer.fullName,
      addressLine1: packet.case.consumer.addressLine1,
      cityStateZip: packet.case.consumer.cityStateZip,
      phone: packet.case.consumer.phone ?? undefined,
      ssnLast4: packet.case.consumer.ssnLast4 ?? undefined,
    },
    items,
  });

  const filename = `fresh-start-${packet.recipientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-annotated-excerpt.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
