import { NextResponse } from "next/server";
import {
  classifyAndRecordResponse,
  recordOutcomes,
} from "@/lib/workflow";
import type { OutcomeCode } from "@/lib/dispute/outcomes";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const body = (await request.json()) as {
    actor?: string;
    itemId?: string;
    responseText?: string;
    results?: { itemId: string; outcome: OutcomeCode; notes?: string }[];
  };

  try {
    if (body.itemId && body.responseText) {
      const disputeCase = await classifyAndRecordResponse({
        caseId,
        itemId: body.itemId,
        actor: body.actor ?? "operator",
        responseText: body.responseText,
      });
      return NextResponse.json({ case: disputeCase });
    }
    if (!body.results?.length) {
      return NextResponse.json(
        { error: "results or itemId+responseText required" },
        { status: 400 },
      );
    }
    const disputeCase = await recordOutcomes({
      caseId,
      actor: body.actor ?? "operator",
      results: body.results,
      responseText: body.responseText,
    });
    return NextResponse.json({ case: disputeCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
