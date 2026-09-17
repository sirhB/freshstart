import { NextResponse } from "next/server";
import { classifyTradelines } from "@/lib/dispute/classify";
import { buildDisputePacket } from "@/lib/dispute/letters";
import {
  SAMPLE_CONSUMER,
  SAMPLE_TRADELINES,
} from "@/lib/dispute/sample-data";

export const dynamic = "force-dynamic";

/** Stateless preview of the dispute engine using the sample report. */
export async function GET() {
  const items = classifyTradelines(SAMPLE_TRADELINES, {
    asOf: new Date("2026-09-17"),
  });
  const recommended = items.filter((i) => i.recommended);
  const letters = buildDisputePacket({
    consumer: SAMPLE_CONSUMER,
    items: recommended,
    asOf: new Date("2026-09-17"),
  });

  return NextResponse.json({
    consumer: SAMPLE_CONSUMER,
    items,
    recommendedCount: recommended.length,
    letters: letters.map((l) => ({
      recipient: l.recipient,
      subject: l.subject,
      lintPassed: l.lintPassed,
      lintIssues: l.lintIssues,
      enclosureList: l.enclosureList,
      itemIds: l.itemIds,
      body: l.body,
    })),
  });
}
