import { NextResponse } from "next/server";
import { decidePlan } from "@/lib/cases";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const body = (await request.json()) as {
    actor?: string;
    decisions?: { itemId: string; decision: "approved" | "denied"; reason?: string }[];
  };

  if (!body.decisions?.length) {
    return NextResponse.json({ error: "decisions required" }, { status: 400 });
  }

  try {
    const disputeCase = await decidePlan({
      caseId,
      actor: body.actor ?? "operator",
      decisions: body.decisions,
    });
    return NextResponse.json({ case: disputeCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
